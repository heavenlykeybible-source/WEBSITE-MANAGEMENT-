/* Single Heavenly Key copyright credit, in the page footer only. */
(function () {
  "use strict";
  var source = document.currentScript;
  var stylesheetUrl = source && source.src ? new URL("hk-standard-footer.css", source.src).href : "";
  function install() {
    if (!document.body) return;
    if (stylesheetUrl && !document.querySelector('link[data-hk-standard-footer]')) {
      var stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = stylesheetUrl;
      stylesheet.setAttribute("data-hk-standard-footer", "1");
      document.head.appendChild(stylesheet);
    }
    var excluded = 'aside, [role="complementary"], [role="dialog"], .sidebar, #sidebar, .side-bar, .left-sidebar, .right-sidebar';
    var footers = Array.prototype.filter.call(document.querySelectorAll("footer"), function (element) {
      return !element.closest(excluded) && element.id !== "heavenlykey-standard-footer";
    });
    var footer = footers.find(function (element) {
      return element.matches("footer.site-footer, footer.hkem-footer, footer[role='contentinfo']");
    }) || footers[footers.length - 1];
    if (!footer) {
      footer = document.createElement("footer");
      footer.id = "hk-standard-copyright-footer";
      footer.setAttribute("role", "contentinfo");
      document.body.appendChild(footer);
    }
    footer.hidden = false;
    footer.classList.remove("hk-replaced-legacy-footer");
    /* Remove obsolete credits, including any mistakenly placed in sidebars. */
    document.querySelectorAll(".talkmoney-design-credit, #heavenlykey-standard-footer, #hk-footer-credit").forEach(function (node) {
      if (node !== footer) node.remove();
    });
    document.querySelectorAll("footer p, footer div, footer span, footer small, aside p, aside div, aside span, .sidebar p, .sidebar div, .sidebar span").forEach(function (node) {
      if (!node.isConnected || node === footer || node.querySelector("button, form, input, select, textarea, [role='button']")) return;
      var label = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (label.length > 180) return;
      var designed = /^Designed by\s+(?:TALKMONEY|TalkMoney Ecosystem)\s*\.?$/i.test(label);
      var copyright = /^Copyright\s*©\s*Heavenly Key Evangelistic Movement\s*2012\s*[-–]\s*2026\.?$/i.test(label) ||
        /^(?:Copyright\s*)?©\s*2026\s*Heavenly Key Evangelistic Movement\b/i.test(label);
      if (designed || copyright) node.remove();
    });
    var block = document.createElement("div");
    block.id = "hk-footer-credit";
    var copyrightLine = document.createElement("p");
    copyrightLine.textContent = "Copyright © Heavenly Key Evangelistic Movement 2012-2026.";
    block.appendChild(copyrightLine);
    var designedLine = document.createElement("p");
    designedLine.appendChild(document.createTextNode("Designed by "));
    var link = document.createElement("a");
    link.href = "https://talkmoney.uk/";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "TALKMONEY";
    designedLine.appendChild(link);
    block.appendChild(designedLine);
    footer.appendChild(block);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();

/* One approved primary footer and an Eternity invitation below it. */
(function(){'use strict';function footer(){if(document.querySelector('footer[data-hk-primary-footer]'))return;var existing=Array.from(document.querySelectorAll('aside[aria-label="Eternity in View"]'));var holder=document.createElement('div');holder.innerHTML="<footer data-hk-primary-footer=\"true\" class=\"site-footer\"><div class=\"wrap hk-primary-footer\"><section class=\"hk-footer-column hk-footer-app\" aria-labelledby=\"footer-app-heading\"><h2 id=\"footer-app-heading\">Heavenly Key App</h2><div class=\"hk-footer-app-showcase\"><div class=\"hk-footer-app-emblem\" aria-hidden=\"true\"><span class=\"hk-footer-app-spark\">\u2726</span><span class=\"hk-footer-app-mark\" style=\"font-size:clamp(38px,5vw,68px);line-height:1\">\ud83d\udcd6</span><span class=\"hk-footer-app-label\">APP</span></div><p><strong>Discipleship and Global Christian Community</strong></p><a class=\"hk-footer-cta\" href=\"https://apps.heavenlykey.org/\" target=\"_blank\" rel=\"noopener noreferrer\">Explore the App \u2197</a></div></section><nav class=\"hk-footer-column\" aria-labelledby=\"footer-links-heading\"><h2 id=\"footer-links-heading\">Quick Links</h2><a href=\"pages/about.html\">About the Ministry</a><a href=\"pages/meet-the-pastor.html\">Meet the Pastor</a><a href=\"pages/steps-to-salvation.html\">Steps to Salvation</a><a href=\"pages/partner.html\">Partner With Us</a><a href=\"pages/contact.html\">Contact Us</a></nav><nav class=\"hk-footer-column\" aria-labelledby=\"footer-resources-heading\"><h2 id=\"footer-resources-heading\">Ministry Resources</h2><a href=\"pages/radio.html\">Heavenly Key Radio</a><a href=\"pages/grdpc.html\">Global Revival &amp; Destiny Prayer Cry</a><a href=\"https://onlinebible.heavenlykey.org/\" target=\"_blank\" rel=\"noopener noreferrer\">Heavenly Key Bible \u2197</a><a href=\"https://global.heavenlykey.org/\" target=\"_blank\" rel=\"noopener noreferrer\">Global Christian Community \u2197</a></nav><section class=\"hk-footer-column\" aria-labelledby=\"footer-posts-heading\"><h2 id=\"footer-posts-heading\">Recent Blog Posts</h2><div id=\"hk-footer-recent-posts\" class=\"hk-footer-recent-posts\"><p>Visit our ministry blog for recent messages.</p></div><a class=\"hk-footer-all\" href=\"https://blog.heavenlykey.org/\" target=\"_blank\" rel=\"noopener noreferrer\">View All Posts \u2197</a></section><section class=\"hk-footer-column hk-footer-community\" aria-labelledby=\"footer-community-heading\"><h2 id=\"footer-community-heading\">Global Christian Community</h2><div class=\"hk-community-network\" aria-hidden=\"true\"><span>\u25cf</span><span>\u2726</span><span>\u25cf</span><span>\u25ce</span><span>\u25cf</span></div><p class=\"hk-community-kicker\">Connecting Believers Across the Nations</p><h3>Join the Community of God's People!</h3><p>Become part of a global Christian family where believers connect, share the Word of God, encourage one another, build godly friendships, and grow together in faith.</p><p class=\"hk-community-tagline\">One Faith \u2022 One Family \u2022 One Body in Christ</p><a class=\"hk-footer-cta hk-community-join\" href=\"https://global.heavenlykey.org/\" target=\"_blank\" rel=\"noopener noreferrer\">JOIN OUR GLOBAL COMMUNITY \u2197</a></section></div><div class=\"copyright-strip\"><div id=\"hk-footer-credit\" class=\"wrap copyright-inner\"><p>Copyright \u00a9 Heavenly Key Evangelistic Movement 2022\u20132026.</p><div class=\"social-links\" aria-label=\"Follow the ministry\"><a href=\"https://www.youtube.com/@heavenlykeyministry\" class=\"social youtube\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"YouTube\">\u25b6</a><a href=\"https://www.facebook.com/heavenlykey\" class=\"social facebook\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Facebook\">f</a><a href=\"https://www.instagram.com/heavenlykey247\" class=\"social instagram\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Instagram\">\u25ce</a><a href=\"https://twitter.com/EAdiohwo\" class=\"social twitter\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"X\">\ud835\udd4f</a></div><p>Designed by <a href=\"https://talkmoney.uk/\" target=\"_blank\" rel=\"noopener noreferrer\">TALKMONEY ECOSYSTEM \u2197</a></p></div></div><nav class=\"hk-footer-bottom-legal\" aria-label=\"Legal information\"><a href=\"pages/terms.html\">Terms of Use</a><a href=\"pages/privacy.html\">Privacy Policy</a></nav></footer>";var primary=holder.firstElementChild;primary.querySelectorAll('a[href]').forEach(function(a){var href=a.getAttribute('href');if(href&&/^(?:\/?pages\/)/.test(href))a.href=new URL(href.replace(/^\//,''),'https://heavenlykey.org/').href;});document.querySelectorAll('body>footer,footer.site-footer,footer.footer,footer.hk-clean-footer,body>#hk-standard-footer,body>#hk-footer-credit').forEach(function(old){old.remove()});var style=document.createElement('style');style.textContent="footer[data-hk-primary-footer]{position:relative!important;inset:auto!important;display:block!important;clear:both;box-sizing:border-box;width:100%;max-width:none!important;margin:30px 0 0!important;padding:28px 18px 18px!important;background:#fff9ee;color:#172d52;text-align:left;overflow-wrap:anywhere;font:14px/1.6 system-ui,sans-serif}footer[data-hk-primary-footer] *{box-sizing:border-box}footer[data-hk-primary-footer] .hk-primary-footer{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:24px;max-width:1400px;margin:auto}footer[data-hk-primary-footer] .hk-footer-column{display:flex;flex-direction:column;min-width:0;gap:7px}footer[data-hk-primary-footer] h2{font-size:18px;line-height:1.3;margin:0 0 10px}footer[data-hk-primary-footer] a{color:#173b78;white-space:normal}footer[data-hk-primary-footer] img{max-width:100%;height:auto}footer[data-hk-primary-footer] .copyright-strip,footer[data-hk-primary-footer] .hk-footer-bottom-legal{padding:16px 0;border-top:1px solid #dfd5c3;margin-top:20px;text-align:center}footer[data-hk-primary-footer] .hk-footer-bottom-legal a{display:inline-block;margin:5px 12px}footer[data-hk-primary-footer] [data-hk-eternity]{display:block!important;position:relative!important;inset:auto!important;margin:24px auto 0;padding:22px 16px;max-width:1400px;background:#102b40;color:#fff;text-align:center;border-radius:12px}footer[data-hk-primary-footer] [data-hk-eternity] a{display:inline-block;background:#f1ce82;color:#172333;padding:10px 18px;border-radius:24px;margin:10px;text-decoration:none;font-weight:700}@media(max-width:540px){footer[data-hk-primary-footer] .hk-primary-footer{grid-template-columns:1fr}footer[data-hk-primary-footer]{padding-bottom:calc(22px + env(safe-area-inset-bottom,0px))!important}}";document.head.appendChild(style);var invitation=existing[0]||document.createElement('aside');existing.slice(1).forEach(function(n){n.remove()});invitation.removeAttribute('style');invitation.setAttribute('aria-label','Eternity in View');invitation.setAttribute('data-hk-eternity','true');if(!invitation.textContent.trim())invitation.innerHTML='<strong>ETERNITY IN VIEW PORTAL</strong><p>Where will you spend eternity?</p><a href="https://heavenlykey.org/eternity-in-view/">I SAY YES TO JESUS →</a>';primary.appendChild(invitation);document.body.appendChild(primary)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',footer);else footer()})();
