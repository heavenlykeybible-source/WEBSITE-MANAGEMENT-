import { withSecurityHeaders } from "./auth";
import type { Env } from "../services/auth-service";

function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
}

export async function handleHomepageUpdates(_request: Request, env: Env): Promise<Response> {
  const testimony = await env.DB.prepare(
    `SELECT title, substr(story, 1, 240) AS excerpt
     FROM testimonies WHERE approval_status = 'approved'
     ORDER BY featured_on_homepage DESC, created_at DESC LIMIT 1`
  ).first<{ title: string; excerpt: string }>();

  const event = await env.DB.prepare(
    `SELECT title, scheduled_at AS date
     FROM broadcast_campaigns
     WHERE status = 'scheduled' AND scheduled_at IS NOT NULL
     ORDER BY scheduled_at ASC LIMIT 1`
  ).first<{ title: string; date: string }>();

  const nation = await env.DB.prepare(
    `SELECT country_name AS name, COALESCE(prayer_focus, 'Pray for the salvation and spiritual awakening of this nation.') AS focus
     FROM nations WHERE is_featured_today = 1
     ORDER BY featured_date DESC LIMIT 1`
  ).first<{ name: string; focus: string }>();

  return json({
    testimony: testimony ?? { title: 'Testimonies of Grace', excerpt: 'What God has done in the lives of His people.' },
    event: event ?? { title: 'Upcoming Heavenly Key Program', date: 'Details coming soon' },
    nation: nation ?? { name: 'the nations', focus: 'Pray for revival, salvation and the fulfilment of God’s purpose.' },
    article: { title: 'Taking Christ to the nations', excerpt: 'Making Jesus known to a dying generation.' },
  });
}

export async function handleLivesTransformedStats(_request: Request, env: Env): Promise<Response> {
  const decisions = await env.DB.prepare("SELECT COUNT(*) AS c FROM decisions").first<{ c: number }>();
  const testimonies = await env.DB.prepare("SELECT COUNT(*) AS c FROM testimonies WHERE approval_status = 'approved'").first<{ c: number }>();
  return json({ decisions: decisions?.c ?? 0, testimonies: testimonies?.c ?? 0 });
}


export async function handleWebsiteEvents(_request: Request, env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT campaign_id, title, scheduled_at, body
       FROM broadcast_campaigns
      WHERE status = 'scheduled'
        AND scheduled_at IS NOT NULL
        AND datetime(scheduled_at) >= datetime('now')
      ORDER BY datetime(scheduled_at) ASC
      LIMIT 10`
  ).all<{
    campaign_id: number;
    title: string;
    scheduled_at: string;
    body: string | null;
  }>();

  return json({
    success: true,
    items: rows.results.map((row) => ({
      id: row.campaign_id,
      title: row.title,
      description: row.body ?? "",
      start_time: row.scheduled_at,
      location: "",
    })),
  });
}
