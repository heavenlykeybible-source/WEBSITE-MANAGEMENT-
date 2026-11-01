/**
 * Cloudflare domain-management adapter for Account 4.
 * NOT exposed as a public route. Import only from an authenticated owner-approval handler.
 * The token is supplied by the existing encrypted connection vault; never by browser input.
 */
const API = "https://api.cloudflare.com/client/v4";
function validateHost(host, zone) {
  const h = String(host || "").toLowerCase().trim();
  const z = String(zone || "").toLowerCase().trim();
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(h) || !/^[a-z0-9.-]+$/.test(z) || !h.endsWith("." + z) || h === z) throw new Error("Invalid subdomain for selected zone");
  return h;
}
function validateWorker(name) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(String(name || ""))) throw new Error("Invalid Worker name");
  return name;
}
async function cloudflare(token, path, method = "GET", body) {
  const res = await fetch(API + path, {method, headers: {"Authorization": "Bearer " + token, ...(body ? {"Content-Type":"application/json"} : {})}, body: body ? JSON.stringify(body) : undefined});
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.success) throw new Error("Cloudflare API failed: " + (payload.errors || []).map(e => e.message).join("; "));
  return payload.result;
}
/**
 * Worker Custom Domains API handles hostname routing; do not create a duplicate
 * A/CNAME record blindly. DNS zone and Worker account must be explicitly selected.
 *
 * caller MUST verify the approval is current, bound to this exact connection,
 * zone, hostname and worker; this module never accepts a caller-provided token.
 */
export async function attachApprovedWorkerDomain({vaultToken, accountId, zoneId, zoneName, hostname, workerName, approval}) {
  if (!approval || approval.status !== "approved" || approval.operation !== "worker_custom_domain" ||
      approval.accountId !== accountId || approval.zoneId !== zoneId ||
      approval.hostname !== hostname || approval.workerName !== workerName ||
      approval.used === true) throw new Error("Exact owner approval required");
  const host = validateHost(hostname, zoneName);
  const worker = validateWorker(workerName);
  if (!/^[a-f0-9]{32}$/.test(accountId) || !/^[a-f0-9]{32}$/.test(zoneId)) throw new Error("Invalid Cloudflare identifiers");
  const existing = await cloudflare(vaultToken, "/accounts/" + accountId + "/workers/domains?zone_id=" + zoneId + "&hostname=" + encodeURIComponent(host));
  const domains = Array.isArray(existing) ? existing : (existing?.result || []);
  const conflict = domains.find(x => x.hostname === host && x.service !== worker);
  if (conflict) throw new Error("Domain already attached to another Worker; manual review required");
  if (domains.some(x => x.hostname === host && x.service === worker)) return {status:"already_attached", hostname:host};
  const result = await cloudflare(vaultToken, "/accounts/" + accountId + "/workers/domains", "PUT", {hostname:host, service:worker, zone_id:zoneId, environment:"production"});
  return {status:"submitted", hostname:host, domainId:result?.id || null};
}
export async function readWorkerDomainStatus({vaultToken, accountId, zoneId, hostname}) {
  const list = await cloudflare(vaultToken, "/accounts/" + accountId + "/workers/domains?zone_id=" + zoneId + "&hostname=" + encodeURIComponent(hostname));
  return (Array.isArray(list) ? list : []).filter(x => x.hostname === hostname).map(x => ({hostname:x.hostname, service:x.service, status:x.status}));
}
