/**
 * Heavenly Key — shared UI component library.
 * Loaded on every page (see COMPONENT-LIBRARY.md).
 * Vanilla JS, no dependencies. Each component is opt-in via a data
 * attribute so plain markup keeps working with JS disabled.
 */
(function () {
  "use strict";

  /* ================= Toast Notifications ================= */
  // Usage: HKUI.toast("Message", { type: "success" | "error" | "info" })
  function ensureToastRegion() {
    let region = document.getElementById("hk-toast-region");
    if (!region) {
      region = document.createElement("div");
      region.id = "hk-toast-region";
      region.className = "toast-region";
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "true");
      document.body.appendChild(region);
    }
    return region;
  }

  function toast(message, opts) {
    opts = opts || {};
    const region = ensureToastRegion();
    const el = document.createElement("div");
    el.className = "toast toast-" + (opts.type || "info");
    el.setAttribute("role", "status");
    el.textContent = message;
    region.appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-visible"));
    const duration = opts.duration || 5000;
    setTimeout(() => {
      el.classList.remove("is-visible");
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  /* ================= Modal Windows ================= */
  // Trigger: <button data-modal-open="my-modal-id">
  // Markup:  <div class="modal" id="my-modal-id" hidden> ... <button data-modal-close>Close</button> </div>
  let lastFocusedBeforeModal = null;

  function openModal(modal) {
    if (!modal) return;
    lastFocusedBeforeModal = document.activeElement;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    const focusable = modal.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) focusable.focus();

    function trap(e) {
      if (e.key === "Escape") {
        closeModal(modal);
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    modal._trap = trap;
    modal.addEventListener("keydown", trap);
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (modal._trap) modal.removeEventListener("keydown", modal._trap);
    if (lastFocusedBeforeModal) lastFocusedBeforeModal.focus();
  }

  function initModals() {
    document.addEventListener("click", (e) => {
      const openTrigger = e.target.closest("[data-modal-open]");
      if (openTrigger) {
        const id = openTrigger.getAttribute("data-modal-open");
        openModal(document.getElementById(id));
        return;
      }
      const closeTrigger = e.target.closest("[data-modal-close]");
      if (closeTrigger) {
        closeModal(closeTrigger.closest(".modal"));
        return;
      }
      if (e.target.classList.contains("modal-backdrop")) {
        closeModal(e.target.closest(".modal"));
      }
    });
  }

  /* ================= Accordion ================= */
  // Markup: <div class="accordion"> repeated <div class="accordion-item">
  //   <h3><button class="accordion-trigger" aria-expanded="false" aria-controls="panel-id">Q</button></h3>
  //   <div class="accordion-panel" id="panel-id" hidden>A</div>
  // </div>
  function initAccordions() {
    document.querySelectorAll(".accordion-trigger").forEach((btn) => {
      btn.addEventListener("click", () => {
        const expanded = btn.getAttribute("aria-expanded") === "true";
        const panel = document.getElementById(btn.getAttribute("aria-controls"));
        btn.setAttribute("aria-expanded", String(!expanded));
        if (panel) panel.hidden = expanded;
      });
    });
  }

  /* ================= Tabs ================= */
  // Markup: <div class="tabs" role="tablist">
  //   <button class="tab" role="tab" aria-selected="true" aria-controls="panel-1" id="tab-1">Label</button>...
  // </div>
  // <div class="tab-panel" role="tabpanel" id="panel-1" aria-labelledby="tab-1"></div>...
  function initTabs() {
    document.querySelectorAll('[role="tablist"]').forEach((tablist) => {
      const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
      tabs.forEach((tab, i) => {
        tab.addEventListener("click", () => selectTab(tab));
        tab.addEventListener("keydown", (e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            selectTab(tabs[(i + 1) % tabs.length]);
            tabs[(i + 1) % tabs.length].focus();
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            selectTab(tabs[(i - 1 + tabs.length) % tabs.length]);
            tabs[(i - 1 + tabs.length) % tabs.length].focus();
          }
        });
      });

      function selectTab(selected) {
        tabs.forEach((t) => {
          const isSelected = t === selected;
          t.setAttribute("aria-selected", String(isSelected));
          t.tabIndex = isSelected ? 0 : -1;
          const panel = document.getElementById(t.getAttribute("aria-controls"));
          if (panel) panel.hidden = !isSelected;
        });
      }
    });
  }

  /* ================= Site-wide: Weekly Memory Verse ================= */
  function initMemoryVerse() {
    const container = document.getElementById("hk-memory-verse");
    if (!container || typeof HKEcosystem === "undefined") return;
    HKEcosystem.renderComponent({
      container,
      endpoint: "/api/bible/memory-verse",
      preserveFallbackOnEmpty: true,
      unwrap: (data) => data.item ? [data.item] : [],
      render: (items) => {
        const v = items[0];
        return `"${HKEcosystem.escapeHTML(v.text)}" — ${HKEcosystem.escapeHTML(v.reference)}`;
      },
    });
  }

  window.HKUI = { toast, openModal, closeModal };

  document.addEventListener("DOMContentLoaded", () => {
    initModals();
    initAccordions();
    initTabs();
    initMemoryVerse();
  });
})();

