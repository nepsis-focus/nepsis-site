import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const [coach,html,edge,migration,config]=await Promise.all([
 readFile(new URL("../assets/js/pages/coach.js",import.meta.url),"utf8"),
 readFile(new URL("../coach.html",import.meta.url),"utf8"),
 readFile(new URL("../supabase/functions/ai-study-coach/index.ts",import.meta.url),"utf8"),
 readFile(new URL("../supabase/migrations/20261124130000_coach_ip_rate_limit_and_custom_stage.sql",import.meta.url),"utf8"),
 readFile(new URL("../supabase/config.toml",import.meta.url),"utf8")
]);
test("browser code sends Coach requests only to the Supabase Edge Function",()=>{
 assert.match(coach,/\/functions\/v1\/ai-study-coach/);
 assert.doesNotMatch(coach,/GEMINI_API_KEY|x-goog-api-key|AIza/);assert.doesNotMatch(html,/GEMINI_API_KEY|x-goog-api-key|AIza/);
 assert.match(edge,/Deno\.env\.get\("GEMINI_API_KEY"\)/);assert.match(edge,/gemini: geminiAdapter/);
 assert.match(edge,/Deno\.env\.get\("AI_PROVIDER"\) \|\| "gemini"/);
 assert.doesNotMatch(edge,/Grok|xai\.com|api\.x\.ai/i);
});
test("provider key is read only by the server adapter and never logged or returned",()=>{
 assert.match(edge,/async function geminiAdapter/);assert.match(edge,/"x-goog-api-key": key/);
 assert.doesNotMatch(edge,/console\.(log|error).*geminiKey|return reply\([^\n]*geminiKey/);
});
test("IP limiter is server-side, hashed, and fail-closed",()=>{
 assert.match(edge,/const ipHash = await digest\(serviceKey, "ip:" \+ ip\)/);
 assert.match(edge,/consume_ai_coach_ip_limit/);assert.match(edge,/if \(!limitedIp\.ok\) return reply\(503/);
 assert.match(edge,/if \(await limitedIp\.json\(\) !== true\) return reply\(429/);
 assert.match(migration,/enable row level security/i);
 assert.match(migration,/revoke all on public\.ai_coach_ip_limits from public, anon, authenticated/i);
 assert.match(migration,/grant execute on function public\.consume_ai_coach_ip_limit[^;]*to service_role/i);
});
test("function has explicit in-function authorization and user consent",()=>{
 assert.match(config,/\[functions\.ai-study-coach\]\s+verify_jwt = false/);
 assert.match(edge,/if \(!allowed\) return reply\(403/);assert.match(edge,/body\.consent !== true/);
 assert.match(html,/Συμφωνώ να σταλούν οι απαντήσεις μου/);
});
test("crisis responses are bilingual and link to verified Greece services",()=>{
 assert.match(edge,/1018 \(Klimaca, 24\/7\)/);assert.match(edge,/10306 \(free and anonymous psychosocial support, 24\/7\)/);
 assert.match(html,/https:\/\/10306\.gr\//);assert.match(html,/https:\/\/www\.klimaka\.org\.gr\//);
});
