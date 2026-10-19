import type { Env } from "../services/auth-service";
import { requireMinimumRole } from "../middleware/rbac";
import { withSecurityHeaders } from "./auth";

type ContentMap = Record<string, string>;

const DEFAULTS: ContentMap = {
  ticker_text: "LATEST • REVIVAL • HOLINESS • POWER • GLOBAL CHRISTIAN COMMUNITY • WATCH WEBCAST LIVE • TAKING CHRIST TO THE NATIONS",
  hero_eyebrow: "WELCOME TO",
  hero_title_line1: "HEAVENLY KEY",
  hero_title_highlight: "EVANGELISTIC MOVEMENT",
  hero_identity: "End-Time, Interdenominational, Apostolic and Evangelistic Movement",
  hero_tagline: "Taking Christ to the Nations of the World",
  hero_powerline: "Revival • Holiness • Power",
  hero_community_cta: "Join Global Christian Community",
  hero_radio_cta: "Listen to Revival Online Radio",
  hero_tv_cta: "Watch Webcast Live",
  hero_scripture: "Go ye into all the world, and preach the gospel to every creature.",
  hero_scripture_ref: "Mark 16:15 KJV",
  hero_slide_1_image: "assets/ministry/outreach-1.jpg",
  hero_slide_1_alt: "Heavenly Key evangelistic outreach gathering",
  hero_slide_2_image: "assets/ministry/outreach-2.jpg",
  hero_slide_2_alt: "Heavenly Key revival outreach",
  hero_slide_3_image: "assets/ministry/outreach-3.jpg",
  hero_slide_3_alt: "Prayer and evangelistic gathering",
  hero_slide_4_image: "assets/ministry/outreach-4.jpg",
  hero_slide_4_alt: "Community evangelism",
  hero_slide_5_image: "assets/ministry/outreach-5.jpg",
  hero_slide_5_alt: "Taking Christ to the nations",
  hero_slide_6_image: "assets/ministry/outreach-6.png",
  hero_slide_6_alt: "Heavenly Key global mission vision",

  mission_overline: "OUR MISSION & VISION",
  mission_title: "A Global Movement for Christ in the End-Time",
  mission_body: "Heavenly Key Evangelistic Movement is an End-Time, Interdenominational, Apostolic and Evangelistic Movement preaching the undiluted Word of God, earnestly contending for the faith once delivered unto the saints, bringing sinners to Christ, equipping believers and taking revival across churches, communities and nations.",
  revival_title: "Revival",
  revival_body: "A fresh awakening of hearts to Christ, genuine repentance, salvation and transformed lives.",
  holiness_title: "Holiness",
  holiness_body: "A people set apart for God, living by His Word in righteousness, purity and wholehearted consecration.",
  power_title: "Power",
  power_body: "The Gospel of Jesus Christ demonstrated by the power of the Holy Ghost to save, deliver, heal and transform.",
  army_title: "RAISING AN END-TIME ARMY OF CHRIST",
  army_roles: "Apostles • Pastors • Prophets • Evangelists • Teachers • Kingdom Financiers • Sound Believers",
  army_programs: "Revival Programs • End-Time Harvest",

  grdpc_title: "GLOBAL REVIVAL & DESTINY PRAYER CRY (GRDPC)",
  grdpc_subtitle: "A Global Prayer Program of Heavenly Key Evangelistic Movement",
  grdpc_image: "assets/ministry/pastor-emmanuel-adiohwo.jpg",
  grdpc_solution_title: "CALLED UPON GOD SOLUTION HOUR",
  grdpc_solution_time: "Sunday 8:00 PM",
  grdpc_midnight_title: "MIDNIGHT CRY",
  grdpc_midnight_time: "Monday 12:00 AM",
  grdpc_scripture: "And Jabez called on the God of Israel, and God granted him that which he requested.",
  grdpc_scripture_ref: "1 Chronicles 4:10 KJV",

  community_eyebrow: "OUR COMMUNITY",
  community_title_line1: "Be Part of a",
  community_title_line2: "Global Christian Family",
  community_title_highlight: "Connect. Pray. Share. Learn. Grow Together.",
  community_intro: "Join our global Christian social network community of believers from different Bible-believing churches and ministries across the nations of the world.",
  community_image: "assets/ministry/global-community-network.svg",
  community_cta: "Join the Global Christian Community",

  radio_title: "REVIVAL ONLINE RADIO",
  radio_body: "Messages • Prayers • Revival • Global Impact",
  tv_title: "FAITH OF OUR FATHERS TV",
  tv_body: "Inspiring • Equipping • Transforming Nations",

  testimony_title: "Testimony",
  testimony_body: "Share what God has done in your life.",
  prayer_title: "Prayer Request",
  prayer_body: "Let us stand with you in prayer.",
  support_title: "Support Us",
  support_body: "Help us take the Gospel to the nations.",
  events_title: "Events",
  events_body: "Join upcoming crusades, revival meetings, conferences and programmes.",
  events_image: "assets/ministry/outreach-3.jpg",
  resources_title: "Resources",
  resources_body: "Sermons, Bible teaching, prayer materials, articles and ministry resources.",
  resources_image: "assets/ministry/sermons-header.jpg",
  prayer_card_image: "assets/ministry/outreach-5.jpg",
  support_card_image: "assets/ministry/partnership-header.jpeg",

  ministry_intro_title: "Explore the Ministry",
  africa_title: "Africa Must Be Saved!",
  partner_title: "Partner With Us",
  stay_connected_title: "Stay Connected"
};

const LIMITS: Record<string, number> = Object.fromEntries(
  Object.keys(DEFAULTS).map((key) => [key, key.endsWith("_image") ? 500 : key.endsWith("_body") || key.endsWith("_intro") || key.includes("scripture") ? 700 : 220])
);

const IMAGE_KEYS = new Set(Object.keys(DEFAULTS).filter((key) => key.endsWith("_image")));

function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  }));
}

function safeImageValue(value: string): boolean {
  const normalized = value.trim();
  if (/^(?:javascript|data):/i.test(normalized)) return false;
  if (normalized.toLowerCase().startsWith("https://")) return true;
  if (normalized.includes("..")) return false;
  const lower = normalized.toLowerCase();
  return ["png","jpg","jpeg","webp","gif","svg"].some((ext) => lower.endsWith("." + ext))
    && /^[A-Za-z0-9_./-]+$/.test(normalized);
}

async function readContent(env: Env): Promise<ContentMap> {
  const rows = await env.DB.prepare("SELECT content_key, content_value FROM site_content")
    .all<{ content_key: string; content_value: string }>();
  const content = { ...DEFAULTS };
  for (const row of rows.results || []) {
    if (Object.prototype.hasOwnProperty.call(DEFAULTS, row.content_key)) content[row.content_key] = row.content_value;
  }
  return content;
}

export async function handlePublicSiteContent(_request: Request, env: Env): Promise<Response> {
  return json({ success: true, content: await readContent(env) });
}

export async function handleAdminSiteContent(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return json({ error: { message: "Administrator access required." } }, 403);

  if (request.method === "GET") {
    return json({ success: true, content: await readContent(env), defaults: DEFAULTS, imageKeys: [...IMAGE_KEYS] });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return json({ error: { message: "Send a valid JSON object." } }, 400); }

  const input = (body && typeof body === "object" && !Array.isArray(body)) ? body as Record<string, unknown> : {};
  const updates = input.content && typeof input.content === "object" && !Array.isArray(input.content)
    ? input.content as Record<string, unknown> : input;

  const statements = [];
  const saved: ContentMap = {};
  for (const key of Object.keys(DEFAULTS)) {
    if (!(key in updates)) continue;
    if (typeof updates[key] !== "string") return json({ error: { message: `${key} must be text.` } }, 400);
    const value = updates[key].trim();
    if (!value) return json({ error: { message: `${key} cannot be empty.` } }, 400);
    if (value.length > LIMITS[key]) return json({ error: { message: `${key} is too long (maximum ${LIMITS[key]} characters).` } }, 400);
    if (IMAGE_KEYS.has(key) && !safeImageValue(value)) return json({ error: { message: `${key} must be a safe site image path or HTTPS image URL.` } }, 400);

    saved[key] = value;
    statements.push(env.DB.prepare(
      `INSERT INTO site_content(content_key, content_value, updated_by, updated_at)
       VALUES(?,?,?,CURRENT_TIMESTAMP)
       ON CONFLICT(content_key) DO UPDATE SET
         content_value=excluded.content_value,
         updated_by=excluded.updated_by,
         updated_at=CURRENT_TIMESTAMP`
    ).bind(key, value, actor.userId));
  }

  if (!statements.length) return json({ error: { message: "No supported homepage fields were supplied." } }, 400);
  await env.DB.batch(statements);
  return json({ success: true, saved, content: await readContent(env) });
}


type PageFieldType = "text" | "image" | "alt";
type PageOverride = { type: PageFieldType; value: string };

const PAGE_KEYS = new Set([
  "about","community","contact","events","grdpc","i-said-yes","legal-requests",
  "ministries","missions","partner","privacy","radio","resources","terms","video"
]);

function requestedPage(request: Request): string | null {
  const page = new URL(request.url).searchParams.get("page")?.trim().toLowerCase() || "";
  return PAGE_KEYS.has(page) ? page : null;
}

function safePageFieldKey(value: string): boolean {
  return /^[ati]_[a-z0-9]{6,16}$/i.test(value);
}

async function readPageOverrides(env: Env, page: string): Promise<Record<string, PageOverride>> {
  const rows = await env.DB.prepare(
    "SELECT field_key, field_type, content_value FROM site_page_content WHERE page_key=? ORDER BY field_key"
  ).bind(page).all<{ field_key: string; field_type: PageFieldType; content_value: string }>();
  const content: Record<string, PageOverride> = {};
  for (const row of rows.results || []) {
    if (safePageFieldKey(row.field_key) && ["text","image","alt"].includes(row.field_type)) {
      content[row.field_key] = { type: row.field_type, value: row.content_value };
    }
  }
  return content;
}

export async function handlePublicPageContent(request: Request, env: Env): Promise<Response> {
  const page = requestedPage(request);
  if (!page) return json({ error: { message: "Unknown editable page." } }, 404);
  return json({ success: true, page, content: await readPageOverrides(env, page) });
}

export async function handleAdminPageContent(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return json({ error: { message: "Administrator access required." } }, 403);
  const page = requestedPage(request);
  if (!page) return json({ error: { message: "Unknown editable page." } }, 404);

  if (request.method === "GET") {
    return json({ success: true, page, content: await readPageOverrides(env, page) });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return json({ error: { message: "Send valid JSON." } }, 400); }

  const input = body && typeof body === "object" && !Array.isArray(body)
    ? body as { reset?: unknown; changes?: unknown }
    : {};

  if (input.reset === true) {
    await env.DB.prepare("DELETE FROM site_page_content WHERE page_key=?").bind(page).run();
    return json({ success: true, page, reset: true, content: {} });
  }

  if (!Array.isArray(input.changes)) {
    return json({ error: { message: "Send a changes array." } }, 400);
  }
  if (input.changes.length > 600) {
    return json({ error: { message: "Too many page changes in one save." } }, 400);
  }

  const statements = [];
  for (const raw of input.changes) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return json({ error: { message: "Each change must be an object." } }, 400);
    }
    const change = raw as Record<string, unknown>;
    const key = typeof change.key === "string" ? change.key.trim() : "";
    const type = typeof change.type === "string" ? change.type.trim() as PageFieldType : "text";
    const rawValue = typeof change.value === "string" ? change.value : "";
    const value = type === "text" ? rawValue : rawValue.trim();

    if (!safePageFieldKey(key)) return json({ error: { message: "Invalid editable field key." } }, 400);
    if (!["text","image","alt"].includes(type)) return json({ error: { message: "Invalid editable field type." } }, 400);
    if (type === "text" && value.length > 5000) return json({ error: { message: "Edited text is too long." } }, 400);
    if (type === "alt" && value.length > 500) return json({ error: { message: "Image description is too long." } }, 400);
    if (type === "image" && (!value || !safeImageValue(value))) {
      return json({ error: { message: "Images must use a safe site path or HTTPS image URL." } }, 400);
    }

    statements.push(env.DB.prepare(
      `INSERT INTO site_page_content(page_key, field_key, field_type, content_value, updated_by, updated_at)
       VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)
       ON CONFLICT(page_key, field_key) DO UPDATE SET
         field_type=excluded.field_type,
         content_value=excluded.content_value,
         updated_by=excluded.updated_by,
         updated_at=CURRENT_TIMESTAMP`
    ).bind(page, key, type, value, actor.userId));
  }

  if (statements.length) await env.DB.batch(statements);
  return json({ success: true, page, saved: statements.length, content: await readPageOverrides(env, page) });
}
