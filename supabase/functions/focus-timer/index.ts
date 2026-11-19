import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const PROJECT_URL = Deno.env.get("SUPABASE_URL") ?? "";
const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
const secretKeys = rawSecretKeys ? JSON.parse(rawSecretKeys) : {};
const ADMIN_KEY = secretKeys.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const rawPublishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
const publishableKeys = rawPublishableKeys ? Object.values(JSON.parse(rawPublishableKeys)) : [];
const allowedApiKeys = [
  ...publishableKeys,
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",
].filter((key) => typeof key === "string" && key.length > 0);

const admin = createClient(PROJECT_URL, ADMIN_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ALLOWED_ORIGINS = new Set([
  "https://nepsis-focus.github.io",
  "https://nepsis-focus.netlify.app",
]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === "https:" && hostname.endsWith("--nepsis-focus.netlify.app");
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey",
    "Vary": "Origin",
  };
  if (isAllowedOrigin(origin)) headers["Access-Control-Allow-Origin"] = origin as string;
  return headers;
}

function reply(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    if (origin && !isAllowedOrigin(origin)) return reply({ ok: false, error: "origin_not_allowed" }, 403, null);
    return new Response("ok", { status: 200, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") return reply({ ok: false, error: "method_not_allowed" }, 405, origin);
  if (origin && !isAllowedOrigin(origin)) return reply({ ok: false, error: "origin_not_allowed" }, 403, null);
  if (!PROJECT_URL || !ADMIN_KEY) return reply({ ok: false, error: "server_not_configured" }, 503, origin);

  const apiKey = req.headers.get("apikey") ?? "";
  if (!allowedApiKeys.includes(apiKey)) return reply({ ok: false, error: "invalid_api_key" }, 401, origin);
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return reply({ ok: false, error: "invalid_json" }, 400, origin); }

  const action = body.action;
  const token = body.token;
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) {
    return reply({ ok: false, error: "invalid_session_token" }, 400, origin);
  }
  const tokenHash = await hashToken(token);
  const sessionId = typeof body.session_id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.session_id)
    ? body.session_id
    : null;

  try {
    let rpcName: string;
    let rpcArgs: Record<string, unknown>;
    if (action === "start") {
      const stage = body.stage_minutes;
      if (typeof stage !== "number" || !Number.isInteger(stage) || stage < 5 || stage > 180) {
        return reply({ ok: false, error: "invalid_stage" }, 400, origin);
      }
      rpcName = "nepsis_timer_start";
      rpcArgs = { p_stage_minutes: stage, p_session_id: sessionId, p_token_hash: tokenHash };
    } else if (action === "pause" && sessionId) {
      rpcName = "nepsis_timer_pause";
      rpcArgs = { p_session_id: sessionId, p_token_hash: tokenHash };
    } else if ((action === "complete" || action === "status") && sessionId) {
      rpcName = "nepsis_timer_complete";
      rpcArgs = { p_session_id: sessionId, p_token_hash: tokenHash };
    } else {
      return reply({ ok: false, error: "invalid_action" }, 400, origin);
    }
    const { data, error } = await admin.rpc(rpcName, rpcArgs);
    if (error) {
      console.error("Timer RPC failed:", error.message);
      return reply({ ok: false, error: "timer_service_error" }, 500, origin);
    }
    return reply(data as Record<string, unknown>, 200, origin);
  } catch (error) {
    console.error("Timer request failed:", error);
    return reply({ ok: false, error: "timer_service_error" }, 500, origin);
  }
});
