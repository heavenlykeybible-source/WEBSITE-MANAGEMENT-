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
