// Nightly RSS poll: fetches the blog feed and inserts any new essays, keyed by
// URL so re-polling is idempotent. If the blog has no feed, skip deploying
// this function — the "Essay shipped" form covers paste-per-ship.
//
// Secret: BLOG_FEED_URL (RSS 2.0 or Atom).

import { serviceClient, requireCronAuth, json, isoDate } from "../_shared/util.ts";

function textBetween(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!m) return null;
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1").trim();
}

function parseFeed(xml: string): { date: string; url: string; title: string }[] {
  const out: { date: string; url: string; title: string }[] = [];
  // RSS 2.0 <item> or Atom <entry>
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const item of items) {
    const title = textBetween(item, "title");
    // Atom links are attributes; RSS links are text content
    const atomLink = item.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i) ??
      item.match(/<link[^>]*href="([^"]+)"/i);
    const url = textBetween(item, "link") || atomLink?.[1] || null;
    const dateRaw = textBetween(item, "pubDate") ?? textBetween(item, "published") ??
      textBetween(item, "updated");
    if (!title || !url || !dateRaw) continue;
    const parsed = new Date(dateRaw);
    if (isNaN(parsed.getTime())) continue;
    out.push({ date: isoDate(parsed), url, title });
  }
  return out;
}

Deno.serve(async (req) => {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const feedUrl = Deno.env.get("BLOG_FEED_URL");
  if (!feedUrl) return json({ ok: true, skipped: "BLOG_FEED_URL not set" });

  const res = await fetch(feedUrl, { headers: { "user-agent": "trend-watcher-rss/1.0" } });
  if (!res.ok) throw new Error(`feed: ${res.status}`);
  const essays = parseFeed(await res.text());

  const db = serviceClient();
  if (essays.length) {
    const { error } = await db.from("essays").upsert(essays, {
      onConflict: "url",
      ignoreDuplicates: true,
    });
    if (error) throw error;
  }
  return json({ ok: true, seen: essays.length });
});
