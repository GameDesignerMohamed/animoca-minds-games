// Nightly Whoop sync: refreshes the OAuth token, pulls the last 14 days of
// cycles, recoveries, sleeps and workouts, and upserts them. 14 days of
// overlap makes the job self-healing after downtime.
//
// One-time bootstrap (also handled here): open
//   https://<PROJECT_REF>.supabase.co/functions/v1/whoop-sync?authorize=1
// to be redirected to Whoop's consent page; the ?code= callback stores the
// first token pair. Requires WHOOP_CLIENT_ID / WHOOP_CLIENT_SECRET /
// WHOOP_REDIRECT_URI secrets (from the Whoop developer app).

import { serviceClient, requireCronAuth, json, isoDate } from "../_shared/util.ts";

const WHOOP_API = "https://api.prod.whoop.com/developer/v1";
const WHOOP_OAUTH = "https://api.prod.whoop.com/oauth/oauth2";

const clientId = () => Deno.env.get("WHOOP_CLIENT_ID")!;
const clientSecret = () => Deno.env.get("WHOOP_CLIENT_SECRET")!;
const redirectUri = () => Deno.env.get("WHOOP_REDIRECT_URI")!;

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(`${WHOOP_OAUTH}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      ...params,
    }),
  });
  if (!res.ok) throw new Error(`whoop token: ${res.status} ${await res.text()}`);
  return res.json();
}

async function storeTokens(db: ReturnType<typeof serviceClient>, t: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}) {
  const { error } = await db.from("whoop_tokens").upsert({
    id: true,
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function freshAccessToken(db: ReturnType<typeof serviceClient>) {
  const { data, error } = await db.from("whoop_tokens").select("*").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("no whoop tokens — run the ?authorize=1 bootstrap first");
  if (new Date(data.expires_at).getTime() > Date.now() + 60_000) return data.access_token;
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: data.refresh_token });
  await storeTokens(db, t);
  return t.access_token as string;
}

async function* paged(token: string, path: string, params: Record<string, string>) {
  let nextToken: string | undefined;
  do {
    const url = new URL(`${WHOOP_API}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("limit", "25");
    if (nextToken) url.searchParams.set("nextToken", nextToken);
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`whoop ${path}: ${res.status} ${await res.text()}`);
    const body = await res.json();
    yield* body.records ?? [];
    nextToken = body.next_token;
  } while (nextToken);
}

function classifySport(sportId: number): "lift" | "run" | "other" {
  // Whoop sport ids: 0 = running, 45 = weightlifting, 63 = walking, …
  if (sportId === 0) return "run";
  if (sportId === 45 || sportId === 48) return "lift"; // weightlifting, functional fitness
  return "other";
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const db = serviceClient();

  // --- one-time OAuth bootstrap ---
  if (url.searchParams.get("authorize")) {
    const consent = new URL(`${WHOOP_OAUTH}/auth`);
    consent.searchParams.set("client_id", clientId());
    consent.searchParams.set("redirect_uri", redirectUri());
    consent.searchParams.set("response_type", "code");
    consent.searchParams.set("scope", "read:cycles read:recovery read:sleep read:workout offline");
    consent.searchParams.set("state", crypto.randomUUID());
    return Response.redirect(consent.toString(), 302);
  }
  const code = url.searchParams.get("code");
  if (code) {
    const t = await tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    });
    await storeTokens(db, t);
    return json({ ok: true, message: "Whoop connected. Nightly sync will take it from here." });
  }

  // --- nightly sync (cron) ---
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const token = await freshAccessToken(db);
  const start = new Date(Date.now() - 14 * 86400000).toISOString();
  const range = { start, end: new Date().toISOString() };

  const cyclesByDate = new Map<string, Record<string, unknown>>();
  for await (const c of paged(token, "/cycle", range)) {
    const date = isoDate(c.start);
    cyclesByDate.set(date, { date, strain: c.score?.strain ?? null });
  }
  for await (const r of paged(token, "/recovery", range)) {
    const date = isoDate(r.created_at);
    const row = cyclesByDate.get(date) ?? { date };
    row.recovery = r.score?.recovery_score ?? null;
    row.hrv = r.score?.hrv_rmssd_milli ? Math.round(r.score.hrv_rmssd_milli) : null;
    cyclesByDate.set(date, row);
  }
  for await (const s of paged(token, "/activity/sleep", range)) {
    if (s.nap) continue;
    const date = isoDate(s.end);
    const row = cyclesByDate.get(date) ?? { date };
    const ms = s.score?.stage_summary
      ? s.score.stage_summary.total_light_sleep_time_milli +
        s.score.stage_summary.total_slow_wave_sleep_time_milli +
        s.score.stage_summary.total_rem_sleep_time_milli
      : null;
    row.sleep_hours = ms ? Math.round((ms / 3600000) * 10) / 10 : null;
    cyclesByDate.set(date, row);
  }

  const workouts: Record<string, unknown>[] = [];
  for await (const w of paged(token, "/activity/workout", range)) {
    workouts.push({
      whoop_id: String(w.id),
      date: isoDate(w.start),
      sport: classifySport(w.sport_id),
      strain: w.score?.strain ?? null,
      duration_min: Math.round((new Date(w.end).getTime() - new Date(w.start).getTime()) / 60000),
    });
  }

  const cycles = [...cyclesByDate.values()];
  if (cycles.length) {
    const { error } = await db.from("whoop_cycles").upsert(cycles, { onConflict: "date" });
    if (error) throw error;
  }
  if (workouts.length) {
    const { error } = await db.from("whoop_workouts").upsert(workouts, { onConflict: "whoop_id" });
    if (error) throw error;
  }

  return json({ ok: true, cycles: cycles.length, workouts: workouts.length });
});
