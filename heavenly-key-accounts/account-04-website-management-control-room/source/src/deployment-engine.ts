/** Account 4 deployment control engine, phase 1: safe plans only.
 * Never accepts arbitrary account IDs, commands, URLs, or credentials.
 * Deployment execution requires a separate authenticated, audited adapter.
 */
export const SITES = {
 account1: {role:"Main website", hostname:"heavenlykey.org"},
 account2: {role:"Media and broadcast", hostname:"media.heavenlykey.org"},
 account3: {role:"Global community", hostname:"global.heavenlykey.org"},
 account4: {role:"Central control room", hostname:""},
 account5: {role:"Applications", hostname:"app.heavenlykey.org"},
 account6: {role:"Holy Bible", hostname:"bible.heavenlykey.org"}
} as const;
export type SiteId=keyof typeof SITES;
export function planDeployment(input:unknown){
 if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Invalid deployment request");
 const data=input as Record<string,unknown>;
 if(typeof data.site!=="string"||!Object.prototype.hasOwnProperty.call(SITES,data.site))throw new Error("Unknown account");
 if(Object.keys(data).some(k=>!["site","reason"].includes(k)))throw new Error("Unexpected deployment parameters");
 if(typeof data.reason!=="string"||!data.reason.trim()||data.reason.length>500)throw new Error("Provide a short deployment reason");
 const site=data.site as SiteId;
 return {
  site, ...SITES[site], status:"planning_only", executable:false,
  approvalRequired:true,
  checks:["Verify correct Cloudflare account ID","Verify Git revision and site-specific Wrangler config","Check secrets and resource bindings without exposing them","Build and test in staging","Require explicit administrator approval","Deploy with scoped Cloudflare API token","Probe health and public URL","Record deployment audit and rollback revision"],
  warning:"No Cloudflare API credentials or deployment executor are configured. No deployment has been initiated."
 };
}

