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
  function status(message) {
    if (info) { info.textContent = message; info.setAttribute('role', 'status'); info.setAttribute('aria-live', 'polite'); }
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    promptEvent = event;
    if (install && /^(android|windows|mac)$/.test(platform) && document.querySelector('link[rel="manifest"]')) install.hidden = false;
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
        if (promptEvent && install && /^(android|windows|mac)$/.test(platform)) install.hidden = false;
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
          nativeAvailable = available.ok && contentType.includes(expectedTypes[platform]) && Number.isSafeInteger(size) && size > 0;
          nativeLink.hidden = !nativeAvailable;
          if (available.ok && platform === 'android') status('A native Android APK is available. Use the APK download button, or open the web app instead. Android may ask you to approve installation outside the Play Store.');
        } catch { nativeLink.hidden = true; }
      }
      if (platform === 'iphone' || platform === 'ipad') {
        status('Open this app in Safari, tap Share, then Add to Home Screen. Native App Store installation is not available here.');
      } else if (nativeAvailable) {
        status('A native installation package is available for this app and device. Choose Download above, or open the web app.');
      } else if (!sameOrigin) {
        status('This app is hosted on another Heavenly Key website. Open it above and use installation options offered on that website. This page cannot install it directly.');
      } else if (!nativeAvailable) {
        status('This is an installable web app when supported by your browser. Open the app or use the Install button when offered; this is not an APK or native store download.');
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
