// Nightly Google Calendar sync: lists events from the last 60 days, keyword-
// matches therapy/physio, and upserts by event id (idempotent). Uses a service
// account with domain- or calendar-level read access — share the calendar with
// the service account's email once, no per-user OAuth.
//
// Secrets: GOOGLE_SERVICE_ACCOUNT_JSON (the key file, verbatim),
//          GOOGLE_CALENDAR_ID (usually your email address),
//          optional THERAPY_KEYWORDS / PHYSIO_KEYWORDS (comma-separated,
//          defaults below — adjust to whatever the events are named).

import { serviceClient, requireCronAuth, json, isoDate } from "../_shared/util.ts";

const DEFAULT_THERAPY = ["therapy", "therapist", "counselling", "counseling"];
const DEFAULT_PHYSIO = ["physio", "physiotherapy", "physical therapy", "pt session"];

function keywords(envName: string, fallback: string[]): string[] {
  const raw = Deno.env.get(envName);
  return raw ? raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) : fallback;
}

function classify(summary: string): "therapy" | "physio" | null {
  const s = summary.toLowerCase();
  if (keywords("THERAPY_KEYWORDS", DEFAULT_THERAPY).some((k) => s.includes(k))) return "therapy";
  if (keywords("PHYSIO_KEYWORDS", DEFAULT_PHYSIO).some((k) => s.includes(k))) return "physio";
  return null;
}

// --- minimal service-account JWT flow (no SDK needed) ---
function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function googleAccessToken(): Promise<string> {
  const sa = JSON.parse(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")!);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`)),
  );
  const assertion = `${header}.${claims}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`google token: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

Deno.serve(async (req) => {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const token = await googleAccessToken();
  const calendarId = encodeURIComponent(Deno.env.get("GOOGLE_CALENDAR_ID")!);
  const timeMin = new Date(Date.now() - 60 * 86400000).toISOString();

  const rows: Record<string, unknown>[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", new Date().toISOString());
    url.searchParams.set("singleEvents", "true"); // expands recurring events
    url.searchParams.set("maxResults", "250");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`google events: ${res.status} ${await res.text()}`);
    const body = await res.json();
    for (const e of body.items ?? []) {
      if (e.status === "cancelled" || !e.summary) continue;
      const type = classify(e.summary);
      if (!type) continue;
      rows.push({
        source_id: e.id,
        date: isoDate(e.start?.dateTime ?? e.start?.date),
        type,
      });
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  const db = serviceClient();
  if (rows.length) {
    const { error } = await db.from("calendar_events").upsert(rows, { onConflict: "source_id" });
    if (error) throw error;
  }
  return json({ ok: true, matched: rows.length });
});
