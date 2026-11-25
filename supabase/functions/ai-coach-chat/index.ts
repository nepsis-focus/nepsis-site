// Free-form chat with the Nepsis Coach. Separate from ai-study-coach-v2 (the
// structured plan flow): it only answers study and focus questions, stops for
// crisis language, and counts messages per day. Gemini output is plain text.
const MAX_BODY = 12000;
const MAX_MESSAGE_CHARS = 1000;
const MAX_TURNS = 10;
const DAILY_MESSAGE_LIMIT = 10;
const IP_WINDOW_MS = 10 * 60 * 1000;
const IP_REQUEST_LIMIT = 20;
const CRISIS_PATTERN = /(crisis|mental health crisis|panic attack|having a panic attack|κρίση|κρίση πανικού|βρίσκομαι σε κρίση|δεν είμαι ασφαλής|suicid|kill myself|end my life|end it all|hurt myself|self[- ]harm|want to die|don't want to live|do not want to live|can't go on|\bin crisis\b|\bunsafe\b|\bnot safe\b|need help now|αυτοκτον|αυτοτραυματισ|κρίση|κινδυνεύω|δεν είμαι ασφαλής|δεν νιώθω ασφαλής|να κάνω κακό στον εαυτό μου|να βλάψω τον εαυτό μου|να βάλω τέλος στη ζωή μου|να τελειώσω τη ζωή μου|δεν θέλω να ζω|δεν θέλω να υπάρχω|θέλω να πεθάνω|δεν αντέχω άλλο)/i;
const DEFAULT_ORIGINS = [
  "https://nepsis-focus.github.io",
  "https://nepsis-site.nepsis-corp.workers.dev",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];
const NETLIFY_PREVIEW_ORIGIN = new RegExp("^https://deploy-preview-[0-9]+--nepsis-focus[.]netlify[.]app$");
const WORKERS_PREVIEW_ORIGIN = new RegExp("^https://[a-z0-9-]+-nepsis-site[.]nepsis-corp[.]workers[.]dev$");
const SYSTEM_EL = [
  "Είσαι ο Nepsis Coach: ένας ήρεμος, σύντομος βοηθός για μελέτη, συγκέντρωση και μικρά βήματα.",
  "Απάντα στα ελληνικά, σε 2 έως 5 σύντομες προτάσεις, χωρίς πίεση και χωρίς μεγάλες λίστες.",
  "Πρότεινε πάντα ένα μικρό επόμενο βήμα, για παράδειγμα ένα στάδιο 5 ή 10 λεπτών.",
  "Μην προτείνεις να παραλείψει τα διαλείμματα ή τον ύπνο για να δουλέψει περισσότερο.",
  "Μην δίνεις ιατρικές συμβουλές και μην κάνεις διαγνώσεις.",
  "Αν η ερώτηση δεν έχει σχέση με μελέτη ή συγκέντρωση, ευγενικά πες ότι βοηθάς μόνο σε αυτά και ρώτα τι μελετάει ο χρήστης.",
  "Μην αναφέρεις ότι είσαι μοντέλο τρίτου παρόχου."
].join(" ");
const SYSTEM_EN = [
  "You are the Nepsis Coach: a calm, brief helper for study, focus and small steps.",
  "Answer in English, in 2 to 5 short sentences, with no pressure and no long lists.",
  "Always suggest one small next step, for example a 5 or 10 minute stage.",
  "Never suggest skipping breaks or sleep to work more.",
  "Do not give medical advice or diagnoses.",
  "If the question is unrelated to study or focus, kindly say you only help with those and ask what they are studying.",
  "Do not mention which model or provider you run on."
].join(" ");
const CRISIS_EL = "Είμαι AI, όχι υπηρεσία έκτακτης ανάγκης. Σταματάω τη συζήτηση εδώ επειδή μπορεί να χρειάζεσαι υποστήριξη τώρα. Στην Ελλάδα μπορείς να καλέσεις το 1018 (ΚΛΙΜΑΚΑ, 24/7) ή το 112 αν είσαι σε άμεσο κίνδυνο. Μίλα με κάποιον που εμπιστεύεσαι και ζήτα του να μείνει μαζί σου.";
const CRISIS_EN = "I’m an AI, not an emergency service. I’m stopping the chat here because you may need support now. In Greece, call 1018 (Klimaka, 24/7), or 112 if you are in immediate danger. Please contact someone you trust and ask them to stay with you.";

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").trim().slice(0, max) : "";
}
function reply(status: number, data: Record<string, unknown>, origin: string | null, ok: boolean) {
  const h = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "vary": "Origin" });
  if (origin && ok) h.set("access-control-allow-origin", origin);
  return new Response(JSON.stringify(data), { status, headers: h });
}
function workersPreview(origin: string) {
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === "https:" && hostname.endsWith("-nepsis-site.nepsis-corp.workers.dev");
  } catch { return false; }
}
async function digest(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function askGemini(language: string, history: { role: string; content: string }[]) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("provider_not_configured");
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 20000);
  try {
    const result = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      signal: abort.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: language === "en" ? SYSTEM_EN : SYSTEM_EL }] },
        contents: history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.5, maxOutputTokens: 400 }
      })
    });
    if (!result.ok) throw new Error("gemini_http_" + result.status);
    const raw = await result.json();
    const text = raw?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("").trim() || "";
    if (!text) throw new Error("empty_answer");
    return text;
  } finally { clearTimeout(timeout); }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const extra = (Deno.env.get("COACH_ALLOWED_ORIGINS") || "").split(",").map((x) => x.trim()).filter(Boolean);
  const allowed = !origin || DEFAULT_ORIGINS.includes(origin) || extra.includes(origin) || NETLIFY_PREVIEW_ORIGIN.test(origin) || WORKERS_PREVIEW_ORIGIN.test(origin) || workersPreview(origin);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: allowed && origin ? { "access-control-allow-origin": origin, "access-control-allow-headers": "authorization, apikey, content-type, x-client-info", "access-control-allow-methods": "POST, OPTIONS", "access-control-max-age": "600", vary: "Origin" } : { vary: "Origin" } });
  }
  if (!allowed) return reply(403, { error: "origin_not_allowed" }, origin, false);
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" }, origin, allowed);
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY) return reply(413, { error: "request_too_large" }, origin, allowed);
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY) return reply(413, { error: "request_too_large" }, origin, allowed);
    body = JSON.parse(raw);
  } catch { return reply(400, { error: "invalid_json" }, origin, allowed); }
  if (!body || typeof body !== "object" || !Array.isArray(body.messages)) return reply(400, { error: "invalid_input" }, origin, allowed);

  const language = body.language === "en" ? "en" : "el";
  const history = (body.messages as unknown[])
    .map((m) => (m && typeof m === "object" ? m as Record<string, unknown> : null))
    .filter((m): m is Record<string, unknown> => !!m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role as string, content: clean(m.content, MAX_MESSAGE_CHARS) }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_TURNS);
  const last = history[history.length - 1];
  if (!last || last.role !== "user") return reply(400, { error: "invalid_input" }, origin, allowed);
  if (((body.messages as unknown[]).some((m) => typeof (m as Record<string, unknown>)?.content === "string" && Array.from((m as Record<string, string>).content).length > MAX_MESSAGE_CHARS))) {
    return reply(413, { error: "input_too_long", maxCharacters: MAX_MESSAGE_CHARS }, origin, allowed);
  }
  if (CRISIS_PATTERN.test(last.content)) {
    return reply(200, { crisis: true, reply: language === "en" ? CRISIS_EN : CRISIS_EL }, origin, allowed);
  }
  if (body.consent !== true) return reply(403, { error: "consent_required" }, origin, allowed);

  const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return reply(503, { error: "service_unavailable" }, origin, allowed);
  const svc = { apikey: serviceKey, authorization: "Bearer " + serviceKey, "content-type": "application/json" };
  const requestIp = (req.headers.get("cf-connecting-ip") || "").trim() || "unknown";

  // Short burst limit per IP, the same RPC the plan flow uses.
  try {
    const ipHash = await digest(serviceKey, "chat-ip:" + requestIp);
    const windowStart = new Date(Math.floor(Date.now() / IP_WINDOW_MS) * IP_WINDOW_MS).toISOString();
    const limitedIp = await fetch(url + "/rest/v1/rpc/consume_ai_coach_ip_limit", { method: "POST", headers: svc, body: JSON.stringify({ p_ip_hash: ipHash, p_window_start: windowStart, p_request_limit: IP_REQUEST_LIMIT }), signal: AbortSignal.timeout(5000) });
    if (!limitedIp.ok) return reply(503, { error: "rate_limit_service_unavailable" }, origin, allowed);
    if (await limitedIp.json() !== true) return reply(429, { error: "ip_rate_limit_reached", retryAfterSeconds: 600 }, origin, allowed);
  } catch { return reply(503, { error: "rate_limit_service_unavailable" }, origin, allowed); }

  // Daily count per signed-in user, or per IP for guests. The quota RPC resets when p_day changes,
  // so the UTC date gives a daily counter.
  let identity = "guest:" + requestIp;
  const bearer = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) {
    try {
      const auth = await fetch(url + "/auth/v1/user", { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY") || "", authorization: "Bearer " + bearer }, signal: AbortSignal.timeout(5000) });
      if (auth.ok) {
        const user = await auth.json();
        if (typeof user.id === "string") identity = "user:" + user.id;
      }
    } catch { /* a stale session counts as a guest */ }
  }
  const today = new Date().toISOString().slice(0, 10);
  try {
    const subjectHash = await digest(serviceKey, "chat:" + identity);
    const limited = await fetch(url + "/rest/v1/rpc/consume_ai_coach_daily_limit", { method: "POST", headers: svc, body: JSON.stringify({ p_subject_hash: subjectHash, p_daily_limit: DAILY_MESSAGE_LIMIT, p_day: today }), signal: AbortSignal.timeout(5000) });
    if (!limited.ok) return reply(503, { error: "service_unavailable" }, origin, allowed);
    if (await limited.json() !== true) {
      return reply(429, { error: "daily_limit_reached", limit: DAILY_MESSAGE_LIMIT, resetsAt: "UTC midnight" }, origin, allowed);
    }
  } catch { return reply(503, { error: "service_unavailable" }, origin, allowed); }

  try {
    const text = await askGemini(language, history);
    return reply(200, { reply: text }, origin, allowed);
  } catch {
    return reply(503, { error: "provider_unavailable" }, origin, allowed);
  }
});
