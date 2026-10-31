/* Account 5: device-aware installation guidance and verified app destination. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const suppliedAppIds = params.getAll('app');
  const appId = suppliedAppIds.length ? suppliedAppIds[0] : 'all-in-one';
  const validAppId = /^[a-z0-9-]{1,64}$/.test(appId) && suppliedAppIds.length <= 1;
  const open = document.getElementById('open');
  const install = document.getElementById('install');
  const info = document.querySelector('.small');
  const heading = document.querySelector('h1');
  const platform = location.pathname.split('/')[2] || 'your device';
  let promptEvent = null;
  // A scan opens installation guidance only. Native package metadata is inspected
  // before showing a platform-matched download button; no signature is verified here.
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
      if (!validAppId) throw new Error('Invalid app selection');
      const response = await fetch('/app-downloads.json', { cache: 'no-store', credentials: 'omit', redirect: 'error' });
      if (!response.ok) throw new Error('Catalogue unavailable');
      const apps = await response.json();
      if (!Object.prototype.hasOwnProperty.call(apps, appId)) throw new Error('Unknown app');
      const app = apps[appId];
      if (!app || typeof app.name !== 'string' || !app.name.trim() || typeof app.url !== 'string') throw new Error('Invalid catalogue entry');
      const destination = new URL(app.url, location.origin);
      const localDevelopment = location.hostname === 'localhost' && destination.protocol === 'http:' && destination.hostname === 'localhost';
      const trustedHosts = new Set(['apps.heavenlykey.org', 'onlinebible.heavenlykey.org', 'global.heavenlykey.org', 'radio.heavenlykey.org', 'meeting.heavenlykey.org', 'heavenlykey.org', 'www.heavenlykey.org']);
      if ((!localDevelopment && (destination.protocol !== 'https:' || !trustedHosts.has(destination.hostname) || destination.port || !/^https:\/\//i.test(app.url))) || destination.username || destination.password) throw new Error('Invalid app URL');
      if (open) {
        open.href = destination.href;
        open.textContent = 'Open ' + app.name + ' Now';
      }
      if (heading) heading.textContent = app.name + ' for ' + platform;
      document.title = app.name + ' — Installation for ' + platform;
      const sameOrigin = destination.origin === location.origin;
      // Installation guides must never advertise their own manifest as the selected app.
      // Users open the destination app, whose actual page owns its install identity.
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
          const available = await fetch(nativeLink.href, {method:'HEAD', cache:'no-store', credentials:'omit', redirect:'error'});
          const contentType = (available.headers.get('content-type') || '').toLowerCase();
          const expectedTypes = {android:'application/vnd.android.package-archive',windows:'application/msix',mac:'application/x-apple-diskimage'};
          const size = Number(available.headers.get('content-length'));
          const digest = available.headers.get('x-release-sha256') || '';
          nativeAvailable = available.status === 200 && !available.headers.has('content-range') && contentType.split(';',1)[0].trim() === expectedTypes[platform] && Number.isSafeInteger(size) && size > 0 && /^[a-f0-9]{64}$/i.test(digest);
          // Do not initiate software downloads on QR scans or page navigation.
          // Show the package only on the matching platform and require a click.
          nativeLink.hidden = !(nativeAvailable && matchesDevice());
          if (nativeAvailable && platform === 'android') status('A native Android APK is available without a Heavenly Key account. Use Download Android APK or open the web app. Android may ask you to approve installation outside the Play Store.');
        } catch { nativeLink.hidden = true; }
      }
      if (!matchesDevice()) {
        status('This QR code is for a different device. Choose the installation guide for your own phone or computer, or use Open App above.');
      } else if (platform === 'iphone' || platform === 'ipad') {
        status('Open this app in Safari, tap Share, then Add to Home Screen. Native App Store installation is not available here.');
      } else if (nativeAvailable) {
        status('A native installation package is listed by the official server. Confirm its publisher signature before installing. No Heavenly Key sign-in is required to download it. Choose Download above or open the web app.');
      } else if (!sameOrigin) {
        status('This app is hosted on another Heavenly Key website. Open it above and use installation options offered on that website. This page cannot install it directly.');
      } else if (!nativeAvailable) {
        status('Open the selected app first, then use your browser Install App or Add to Home Screen option when supported. Native installers are not available until official releases are published.');
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
