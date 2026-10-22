/**
 * Heavenly Key Ecosystem — API Client
 * Talks to AI 1's Cloudflare Workers API (see /API-INTEGRATION.md).
 * Vanilla JS, no dependencies.
 *
 * Design: every dynamic homepage component keeps its curated static
 * markup in the page as a fallback. On load, this client tries to fetch
 * live data and replace it. If API_BASE is unset (true today — AI 1
 * hasn't published a live endpoint yet) or the request fails, the
 * original static content stays exactly as it is. Nothing is ever left
 * blank because of a network failure.
 */
const HKEcosystem = (function () {
  "use strict";

  // Set once AI 1 deploys the Workers API. Left null intentionally —
  // see /API-INTEGRATION.md for why nothing is hard-coded here.
  const API_BASE = "https://heavenlykey.alldaywow247.workers.dev";

  /**
   * SECURITY STANDARD (see RELEASE-CANDIDATE-AUDIT.md H1):
   * Every value returned by the API is untrusted until validated.
   *
   * escapeHTML() is safe ONLY for text-node interpolation
   * (`<p>${escapeHTML(x)}</p>`) — the browser's text-node serializer
   * escapes & < > but NOT quote characters, so it must never be used
   * to build an attribute value via string concatenation
   * (`href="${escapeHTML(x)}"` is unsafe even though it looks escaped).
   *
   * For any API-derived value that becomes an href, src, action, or
   * data-* attribute, do NOT string-concatenate it into HTML at all.
   * Build the element with document.createElement and assign the
   * property directly (el.href = safeURL(value)), after validating
   * with sanitizeURL(). This is the standard pattern for this
   * frontend going forward, not just a fix for the three locations
   * the audit found.
   */
  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = String(str == null ? "" : str);
    return div.innerHTML;
  }

  /**
   * Validates a URL before it is ever assigned to href/src/action.
   * Only http:, https:, mailto:, and tel: schemes are allowed;
   * everything else (javascript:, data:, vbscript:, malformed input)
   * is rejected. Returns the safe URL string, or fallback (default "#")
   * if the value is missing or fails validation.
   */
  function sanitizeURL(value, fallback) {
    fallback = fallback === undefined ? "#" : fallback;
    if (!value || typeof value !== "string") return fallback;
    try {
      const url = new URL(value, window.location.origin);
      const allowed = ["http:", "https:", "mailto:", "tel:"];
      return allowed.includes(url.protocol) ? url.href : fallback;
    } catch (e) {
      return fallback;
    }
  }

  async function get(endpoint, params) {
    if (!API_BASE) throw new Error("API_BASE not configured yet");
    const url = new URL(API_BASE + endpoint);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("Request failed: " + res.status);
    return res.json();
  }

  async function post(endpoint, data) {
    if (!API_BASE) throw new Error("API_BASE not configured yet");
    const res = await fetch(API_BASE + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Request failed: " + res.status);
    return res.json();
  }

  /**
   * Wires one container to one API-driven component.
   *
   * @param {Object} opts
   * @param {HTMLElement} opts.container - element whose innerHTML will be replaced
   * @param {string} opts.endpoint - e.g. "/api/testimonies"
   * @param {Object} [opts.params] - query params, e.g. { status: "approved", limit: 3 }
   * @param {(items:any[]) => string} opts.render - turns fetched items into HTML
   * @param {(item:any) => any} [opts.unwrap] - extracts an array from a non-array response
   */
  function renderComponent(opts) {
    const { container, endpoint, params, render, unwrap } = opts;
    if (!container) return;

    // Preserve whatever the page already shipped with, before touching anything.
    if (container.dataset.fallback === undefined) {
      container.dataset.fallback = container.innerHTML;
    }
    container.setAttribute("data-api-state", "loading");

    if (!API_BASE) {
      // No live backend yet — keep the curated static content as-is.
      // This is a deliberate, documented fallback, not a bug.
      container.setAttribute("data-api-state", "static-fallback");
      return;
    }

    container.classList.add("is-loading");
    get(endpoint, params)
      .then((data) => {
        const items = unwrap ? unwrap(data) : Array.isArray(data) ? data : data.items || data.results || [];
        if (!items || !items.length) {
          if (opts.preserveFallbackOnEmpty) {
            container.innerHTML = container.dataset.fallback;
            container.setAttribute("data-api-state", "static-fallback");
            return;
          }
          container.setAttribute("data-api-state", "empty");
          container.innerHTML = '<p class="empty-state">Nothing here yet — check back soon.</p>';
          return;
        }
        // render() may return a plain HTML string (safe only for pure
        // text content — see escapeHTML's doc comment above) OR a DOM
        // Node/DocumentFragment (required whenever the output includes
        // an href/src/action/data-* built from API data — see
        // sanitizeURL above). Both are supported so callers pick the
        // right one per field, not per component.
        const output = render(items);
        if (output instanceof Node) {
          container.replaceChildren(output);
        } else {
          container.innerHTML = output;
        }
        container.setAttribute("data-api-state", "loaded");
      })
      .catch(() => {
        // Network/API failure — fall back to the original static markup
        // rather than showing a broken or blank section.
        container.innerHTML = container.dataset.fallback;
        container.setAttribute("data-api-state", "error-fallback");
      })
      .finally(() => {
        container.classList.remove("is-loading");
      });
  }

  return { API_BASE, get, post, renderComponent, escapeHTML, sanitizeURL };
})();

