/**
 * Homepage API-driven components.
 * Each entry maps a container id to an endpoint + a render function.
 * Uses the live Heavenly Key API contracts and keeps curated HTML fallback
 * content visible if a dynamic endpoint is temporarily unavailable.
 */
(function () {
  "use strict";

  // Text-node-safe escaping only — see js/api-client.js for why this
  // must never be used to build an attribute value via concatenation.
  const escapeHTML = HKEcosystem.escapeHTML;

  function loadEditableHomepageContent() {
    HKEcosystem.get("/api/site-content/homepage")
      .then((payload) => {
        const content = payload && payload.content;
        if (!content || typeof content !== "object") return;
        document.querySelectorAll("[data-site-content]").forEach((element) => {
          const key = element.getAttribute("data-site-content");
          const value = key && content[key];
          if (typeof value === "string" && value.trim()) element.textContent = value;
        });
        document.querySelectorAll("[data-site-image]").forEach((element) => {
          const key = element.getAttribute("data-site-image");
          const value = key && content[key];
          if (element instanceof HTMLImageElement && typeof value === "string" && value.trim()) element.src = value;
        });
        document.querySelectorAll("[data-site-alt]").forEach((element) => {
          const key = element.getAttribute("data-site-alt");
          const value = key && content[key];
          if (element instanceof HTMLImageElement && typeof value === "string" && value.trim()) element.alt = value;
        });
        document.querySelectorAll("[data-site-background]").forEach((element) => {
          const key = element.getAttribute("data-site-background");
          const value = key && content[key];
          if (typeof value === "string" && value.trim()) element.style.backgroundImage = `url("${value.replace(/"/g, "%22")}")`;
        });
      })
      .catch(() => {
        // Keep the curated HTML fallback if the API is unavailable.
      });
  }

  function initHomepageComponents() {
    const byId = (id) => document.getElementById(id);
    loadEditableHomepageContent();

    // Today's Scripture
    HKEcosystem.renderComponent({
      container: byId("hk-scripture-of-day"),
      endpoint: "/api/bible/verse-of-day",
      preserveFallbackOnEmpty: true,
      render: (items) => {
        const v = items[0];
        return `
          <p class="verse-text">"${escapeHTML(v.text)}"</p>
          <span class="verse-ref">${escapeHTML(v.reference)}</span>
          <a class="btn btn-gold" href="pages/resources.html#bible">Read Chapter</a>`;
      },
    });

    // Bible Verse of the Day card (mid-page)
    HKEcosystem.renderComponent({
      container: byId("hk-verse-of-day"),
      endpoint: "/api/bible/verse-of-day",
      preserveFallbackOnEmpty: true,
      render: (items) => {
        const v = items[0];
        return `
          <span class="eyebrow">Bible Verse of the Day</span>
          <h3 id="devotional-heading" class="visually-hidden">Bible Verse of the Day</h3>
          <p class="verse-text" style="color:var(--color-charcoal);font-style:italic">"${escapeHTML(v.text)}"</p>
          <p style="font-weight:700;color:var(--color-wine)">${escapeHTML(v.reference)}</p>
          <a href="pages/resources.html#bible">Read in Context →</a>`;
      },
    });

    // Weekly Memory Verse is wired site-wide in js/ui-components.js
    // (footer appears identically on every page, not just home).

    // Latest Testimonies
    HKEcosystem.renderComponent({
      container: byId("hk-latest-testimonies"),
      endpoint: "/api/testimonies",
      params: { status: "approved", limit: 3 },
      render: (items) =>
        items
          .map(
            (t) => `
        <div class="card testimony-card">
          <div class="avatar" aria-hidden="true">${escapeHTML((t.displayName || "HK").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase())}</div>
          <div>
            <p style="color:var(--color-charcoal)">"${escapeHTML(t.story)}"</p>
            <strong>${escapeHTML(t.displayName || "Anonymous")}</strong>
          </div>
        </div>`
          )
          .join(""),
    });

    // Daily Devotional
    HKEcosystem.renderComponent({
      container: byId("hk-daily-devotional"),
      endpoint: "/api/devotionals",
      params: { limit: 1, sort: "recent" },
      render: (items) => {
        const d = items[0];
        return `
          <span class="eyebrow">Daily Devotional</span>
          <h3>${escapeHTML(d.title)}</h3>
          <p>${escapeHTML(d.excerpt || d.body)}</p>
          <a href="pages/resources.html#devotional">Read Today's Devotional →</a>`;
      },
    });

    // Upcoming Events
    HKEcosystem.renderComponent({
      container: byId("hk-upcoming-events"),
      endpoint: "/api/events",
      params: { status: "published", when: "upcoming", limit: 3 },
      render: (items) =>
        items
          .map((e) => {
            const d = e.start_time ? new Date(e.start_time) : null;
            const dayLabel = d
              ? d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }).toUpperCase()
              : "";
            return `
        <article class="card">
          <span class="badge-live" style="background:var(--color-royal-blue)">${escapeHTML(dayLabel)}</span>
          <h3>${escapeHTML(e.title)}</h3>
          <p>${escapeHTML(e.description || e.location || "")}</p>
        </article>`;
          })
          .join(""),
    });

    // Featured Sermon and Latest Ministry Updates intentionally remain
    // static for now. The backend has no authoritative sermon/blog data
    // model yet, so production must not issue requests to invented endpoints.
    // The curated HTML fallback remains visible until those contracts exist.
  }

  document.addEventListener("DOMContentLoaded", initHomepageComponents);
})();

