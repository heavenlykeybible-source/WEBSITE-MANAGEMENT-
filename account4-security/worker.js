/* Account 4 security API. Fail-closed internal service; deploy only after configuring bindings/secrets.
   All participating site backends MUST check /v1/enforcement before protected actions. */
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  }
});
const id = () => crypto.randomUUID();
const allowed = new Set(["open", "on_hold", "verification_pending", "restored", "suspended", "dismissed"]);

async function validKey(request, secret) {
  if (!secret || typeof secret !== "string" || secret.length < 32) return false;
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const received = auth.slice(7);
  const enc = new TextEncoder();
  const digest = async (x) => new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(x)));
  const a = await digest(received), b = await digest(secret);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const body = async (req) => {
  if (Number(req.headers.get("content-length") || 0) > 8192) throw Error("Payload too large");
  const raw = await req.text();
  if (raw.length > 8192) throw Error("Payload too large");
  return JSON.parse(raw || "{}");
};

const str = (v, max = 150) => typeof v === "string" && v.length > 0 && v.length <= max && /^[a-zA-Z0-9_.:@/-]+$/.test(v);

export default {
  async fetch(request, env) {
    try {
      if (!env.SECURITY_DB || !await validKey(request, env.SECURITY_SERVICE_KEY)) {
        return json({ error: "Unauthorized" }, 401);
      }

      const url = new URL(request.url);
      const path = url.pathname;

      if (path === "/v1/enforcement" && request.method === "POST") {
        const b = await body(request);
        if (!str(b.site) || !str(b.user_id)) return json({ error: "Invalid subject" }, 400);

        const row = await env.SECURITY_DB.prepare(
          "SELECT status, reason_code FROM security_cases WHERE subject_site=? AND subject_user_id=? AND status IN ('on_hold','verification_pending','suspended') ORDER BY updated_at DESC LIMIT 1"
        ).bind(b.site, b.user_id).first();

        return json({ allowed: !row, status: row?.status || "clear", reason_code: row?.reason_code || null });
      }

      if (path === "/v1/cases" && request.method === "POST") {
        const b = await body(request);
        if (!str(b.site) || !str(b.user_id) || !str(b.reason_code, 70) || !["low", "medium", "high", "critical"].includes(b.risk_level) || !str(b.actor_id) || !["on_hold", "verification_pending"].includes(b.status)) {
          return json({ error: "Invalid payload" }, 400);
        }

        const existing = await env.SECURITY_DB.prepare(
          "SELECT id FROM security_cases WHERE subject_site=? AND subject_user_id=? AND status IN ('on_hold','verification_pending','suspended') LIMIT 1"
        ).bind(b.site, b.user_id).first();

        if (existing) return json({ case_id: existing.id, already_active: true }, 200);

        const caseId = id();
        const auditId = id();

        await env.SECURITY_DB.batch([
          env.SECURITY_DB.prepare("INSERT INTO security_cases(id,subject_site,subject_user_id,status,reason_code,risk_level,evidence_summary) VALUES(?,?,?,?,?,?,?)")
            .bind(caseId, b.site, b.user_id, b.status, b.reason_code, b.risk_level, b.evidence_summary || ""),
          env.SECURITY_DB.prepare("INSERT INTO security_audit_log(id,actor_id,action,case_id,reason) VALUES(?,?,?,?,?)")
            .bind(auditId, b.actor_id, "create_case", caseId, b.reason_code)
        ]);

        return json({ case_id: caseId, status: b.status }, 201);
      }

      if (path === "/v1/cases/decision" && request.method === "POST") {
        const b = await body(request);
        if (!str(b.case_id) || !str(b.actor_id) || !["restored", "suspended", "dismissed", "verification_pending", "on_hold"].includes(b.status) || typeof b.reason !== "string" || b.reason.trim().length < 5 || !allowed.has(b.status)) {
          return json({ error: "Invalid payload" }, 400);
        }

        const existing = await env.SECURITY_DB.prepare("SELECT id,status FROM security_cases WHERE id=?").bind(b.case_id).first();
        if (!existing) return json({ error: "Case not found" }, 404);

        await env.SECURITY_DB.batch([
          env.SECURITY_DB.prepare("UPDATE security_cases SET status=?,updated_at=datetime('now'),reviewed_by=? WHERE id=?").bind(b.status, b.actor_id, b.case_id),
          env.SECURITY_DB.prepare("INSERT INTO security_audit_log(id,actor_id,action,case_id,reason) VALUES(?,?,?,?,?)").bind(id(), b.actor_id, "decision:" + b.status, b.case_id, b.reason)
        ]);

        return json({ case_id: b.case_id, status: b.status });
      }

      if (path === "/v1/cases" && request.method === "GET") {
        const rows = await env.SECURITY_DB.prepare(
          "SELECT id,subject_site,subject_user_id,status,reason_code,risk_level,created_at,updated_at FROM security_cases ORDER BY updated_at DESC LIMIT 100"
        ).all();
        return json({ cases: rows.results || [] });
      }

      return json({ error: "Not found" }, 404);
    } catch (e) {
      return json({ error: e instanceof SyntaxError ? "Invalid JSON" : "Request failed" }, 400);
    }
  }
};
