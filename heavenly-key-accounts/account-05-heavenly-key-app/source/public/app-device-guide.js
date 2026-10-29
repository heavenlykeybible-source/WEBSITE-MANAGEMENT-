/* Account 5: device-aware installation guidance and verified app destination. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const appId = params.get('app') || 'all-in-one';
  const open = document.getElementById('open');
  const install = document.getElementById('install');
  const info = document.querySelector('.small');
  const heading = document.querySelector('h1');
  const platform = location.pathname.split('/')[2] || 'your device';
  let promptEvent = null;
  // A scan is a navigation to this device guide. Start a real attachment download
  // only after HEAD verifies a signed and scanned package is published.
  // Never trigger a package for a different type of device.
  const agent = navigator.userAgent || '';
  function matchesDevice() {
    const isIPad = /iPad/i.test(agent) || (/Macintosh/i.test(agent) && navigator.maxTouchPoints > 1);
    if (platform === 'android') return /Android/i.test(agent);
    if (platform === 'iphone') return /iPhone|iPod/i.test(agent);
    if (platform === 'ipad') return isIPad;
    if (platform === 'windows') return /Windows NT/i.test(agent);
    if (platform === 'mac') return /Macintosh|Mac OS X/i.test(agent) && !isIPad && !/iPhone|iPod|iPad|Android/i.test(agent);
    return false;
  }
  function status(message) {
    if (info) { info.textContent = message; info.setAttribute('role', 'status'); info.setAttribute('aria-live', 'polite'); }
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    promptEvent = event;
    // A browser prompt on the directory/guide may install the directory, not the selected app.
    // Keep it hidden; users should open the selected app for its own installation prompt.
  });
  window.addEventListener('appinstalled', () => {
    promptEvent = null;
    if (install) install.hidden = true;
    status('The web app has been installed. Look for its icon on your device.');
  });
  if (install) {
    install.hidden = true;
    install.addEventListener('click', async () => {
      if (!promptEvent) {
        status('Your browser does not offer direct installation here. Open the app and use the browser installation menu.');
        return;
      }
      const event = promptEvent;
      promptEvent = null;
      install.hidden = true;
      try {
        await event.prompt();
        const choice = await event.userChoice;
        status(choice?.outcome === 'accepted'
          ? 'Installation accepted. Check your device for the installed app.'
          : 'Installation was cancelled. You can use the browser installation menu later.');
      } catch {
        status('The installation prompt was unavailable. Open the app and use the browser installation menu.');
      }
    });
  }
  async function initialize() {
    try {
      const response = await fetch('/app-downloads.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Catalogue unavailable');
      const apps = await response.json();
      if (!Object.prototype.hasOwnProperty.call(apps, appId)) throw new Error('Unknown app');
      const app = apps[appId];
      const destination = new URL(app.url, location.origin);
      if (destination.protocol !== 'https:' && !(destination.protocol === 'http:' && destination.hostname === 'localhost')) throw new Error('Invalid app URL');
      if (open) {
        open.href = destination.href;
        open.textContent = 'Open ' + app.name + ' Now';
      }
      if (heading) heading.textContent = app.name + ' for ' + platform;
      document.title = app.name + ' — Installation for ' + platform;
      const sameOrigin = destination.origin === location.origin;
      if (sameOrigin) {
        const manifest = document.createElement('link');
        manifest.rel = 'manifest';
        manifest.href = '/manifests/' + encodeURIComponent(appId) + '.webmanifest';
        document.head.append(manifest);
        // Browser install prompts are only valid on the app's own origin and scope.
        // A prompt received on this guide must not be presented as an install of another app.
        // The guide URL is never the selected application's installation scope.
      }
      let nativeAvailable = false;
      if (/^(android|windows|mac)$/.test(platform)) {
        const nativeLink = document.createElement('a');
        nativeLink.className = 'button';
        nativeLink.textContent = platform === 'android' ? 'Download Android APK' : 'Download native installation package';
        nativeLink.href = '/api/native-download/' + encodeURIComponent(appId) + '/' + platform;
        nativeLink.hidden = true;
        nativeLink.setAttribute('download', '');
        nativeLink.setAttribute('rel', 'noopener noreferrer');
        if (open) open.insertAdjacentElement('afterend', nativeLink);
        try {
          const available = await fetch(nativeLink.href, {method:'HEAD', cache:'no-store'});
          const contentType = (available.headers.get('content-type') || '').toLowerCase();
          const expectedTypes = {android:'application/vnd.android.package-archive',windows:'application/msix',mac:'application/x-apple-diskimage'};
          const size = Number(available.headers.get('content-length'));
          const digest = available.headers.get('x-release-sha256') || '';
          nativeAvailable = available.ok && contentType.includes(expectedTypes[platform]) && Number.isSafeInteger(size) && size > 0 && /^[a-f0-9]{64}$/i.test(digest);
          nativeLink.hidden = !nativeAvailable;
          if (nativeAvailable && matchesDevice()) {
            status('Your verified ' + platform + ' app download is starting. If your browser does not start it, use the Download button.');
            // Navigate to the official attachment response; do not silently
            // install software or fake an app-store/native download.
            window.location.assign(nativeLink.href);
            return;
          }
          if (nativeAvailable && platform === 'android') status('A native Android APK is available without a Heavenly Key account. Use Download Android APK or open the web app. Android may ask you to approve installation outside the Play Store.');
        } catch { nativeLink.hidden = true; }
      }
      if (!matchesDevice()) {
        status('This QR code is for a different device. Choose the installation guide for your own phone or computer, or use Open App above.');
      } else if (platform === 'iphone' || platform === 'ipad') {
        status('Open this app in Safari, tap Share, then Add to Home Screen. Native App Store installation is not available here.');
      } else if (nativeAvailable) {
        status('A verified native installation package is available. No Heavenly Key sign-in is required to download it. Choose Download above or open the web app.');
      } else if (!sameOrigin) {
        status('This app is hosted on another Heavenly Key website. Open it above and use installation options offered on that website. This page cannot install it directly.');
      } else if (!nativeAvailable) {
        status('Open the selected app first, then use your browser Install App or Add to Home Screen option when supported. Native installers are not available until verified releases are published.');
      }
    } catch {
      if (open) { open.href = '/downloads.html'; open.textContent = 'Return to the Apps directory'; }
      status('The requested app cannot be verified. Select an app from the directory.');
    }
  }
  // The install guide is a standalone entry point; initialize offline support here too.
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  initialize();
})();
