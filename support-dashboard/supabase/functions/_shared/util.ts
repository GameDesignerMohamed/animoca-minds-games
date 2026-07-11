import { createClient } from "npm:@supabase/supabase-js@2";

export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Every sync function is invoked by pg_cron with a shared secret. */
export function requireCronAuth(req: Request): Response | null {
  const secret = Deno.env.get("CRON_SECRET");
  const header = req.headers.get("authorization") ?? "";
  if (!secret || header !== `Bearer ${secret}`) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const isoDate = (d: string | number | Date) =>
  new Date(d).toISOString().slice(0, 10);
