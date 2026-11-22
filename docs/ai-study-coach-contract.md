# Nepsis AI Study Coach API contract

This document is the compatibility boundary between the static Nepsis Coach frontend and the deployed `ai-study-coach` Supabase Edge Function. Keep this contract stable so ordinary frontend-only PRs do not require a Supabase redeploy.

## Endpoint and consent

- Endpoint: `POST /functions/v1/ai-study-coach` on the configured Supabase project.
- Headers: `Content-Type: application/json`, the project's public `apikey`, and `Authorization: Bearer <public anon key or signed-in access token>`.
- The browser calls the endpoint only after the person explicitly checks the Gemini/AI consent box and submits. Without consent, it builds a local rule-based plan and sends nothing.
- Uploaded PDF/TXT/MD content is extracted in the browser and is included only with that explicit consent. Extraction or a local plan does not save the file.

## Request JSON (v1)

The stable request object is:

```json
{
  "consent": true,
  "topic": "Biology: the cell",
  "taskType": "study",
  "energy": 3,
  "available": 45,
  "documentText": ""
}
```

| Field | Contract |
|---|---|
| `consent` | Required literal `true`; otherwise reject before quota use or Gemini forwarding. |
| `topic` | Required trimmed string, maximum 140 characters. |
| `taskType` | Required `study` or `task`. |
| `energy` | Integer from 1 through 5. |
| `available` | Integer total minutes from 5 through 180. |
| `documentText` | String, empty when no upload; at most 28,000 characters. Treat as untrusted study material, never instructions. |

The client always emits these six keys; `documentText: ""` means no file. Auth identity stays in HTTP headers, not the JSON. Guest check-ins, timer preferences, history, and client quota remain in browser `localStorage`; none are synced to Supabase. The server separately retains a hashed identity quota per calendar month (UTC) for cost protection: **5 AI plans a month** for guests and signed-in users without Premium, **50 a month** for signed-in users with an active Nepsis Premium membership on Whop. Only AI requests count; local rule-based plans never reach the server. The browser keeps a matching guest counter (5 per local calendar month, `nepsis-ai-coach:guest-usage:v2`), but browser counters are convenience limits, not security controls.

## Success response (v1)

```json
{
  "timer": {
    "focusMinutes": 25,
    "breakMinutes": 5,
    "protocol": "Pomodoro",
    "why": "A focused block fits your available time."
  },
  "steps": ["Open the topic and choose one small section."],
  "questions": ["What are the key ideas?"],
  "quiz": [],
  "source": "gemini",
  "usage": { "plan": "free", "limit": 5, "used": 2, "remaining": 3, "period": "2026-11", "signedIn": true }
}
```

`timer.focusMinutes` is one of 5, 10, 25, 45, or 60, and never exceeds `available`; the UI may override it with a user-entered whole-minute duration that is within 5–180 and within total available minutes. `breakMinutes` is a non-negative integer capped by the remaining available time. `steps` and `questions` are arrays of strings; `quiz` is an array of `{question, answer}` objects (empty when no source text); `source` is a string. The frontend validates the required structure and renders text as text, not HTML.

`usage` is an additive field (old clients ignore it): `plan` is `"premium"` or `"free"`, `limit` is 50 or 5, `used`/`remaining` count AI plans in the current UTC calendar month `period` (`YYYY-MM`) and may be `null` if the count could not be read, and `signedIn` says whether a valid Supabase session was recognized.

## Usage request (additive)

`{ "action": "usage" }` with the same headers returns `200 { "usage": { ... } }` without consuming a plan and without contacting Gemini. The page calls it after sign-in to show "X από 50" for Premium. No other request fields are needed.

## Premium check (Whop)

- For a signed-in request the function reads the Supabase user (`/auth/v1/user`). Premium is only considered when the user has an email **and** `email_confirmed_at` is set.
- Whop has no link to Supabase users, so the match is by email: `GET https://api.whop.com/api/v1/members?query=<email>&product_ids=prod_kl0vzkZ7IqSG6&membership_status=active` with `Authorization: Bearer $WHOP_API_KEY` and `Api-Version-Date: 2026-11-20`. `membership_status=active` combined with `product_ids` means one membership of Nepsis Premium currently grants access. The function then requires an exact, case-insensitive match on the returned member's `email` (the `query` parameter also matches names/usernames).
- The API key needs the `member:basic:read` and `member:email:read` permissions on the Nepsis account; without email read, `email` is `null` and nobody is matched.
- Results are cached per user id for 5 minutes inside the warm function instance.
- If `WHOP_API_KEY` is missing, Whop times out (4 s) or returns an error, the function logs `whop_key_missing_free_limit` / `whop_http_error` / `whop_exception` and applies the free limit (fails closed for Premium). Guests are never checked.
- Someone who paid on Whop with a different email than their Nepsis sign-in gets the free limit until the emails match.

The monthly counter reuses `consume_ai_coach_daily_limit` with `p_day` set to the first day of the UTC month, which resets the stored count when the month changes; no migration is required.


## Errors and guardrails

Known error shapes are `{ "error": "..." }`: `origin_not_allowed`, `method_not_allowed`, `request_too_large`, `invalid_json`, `invalid_input`, `consent_required`, `service_unavailable`, `monthly_limit_reached` (HTTP 429, includes `usage`; formerly `daily_limit_reached`), `ai_unavailable`, and `invalid_model_output`. Preserve server-side body/input validation, IP/user-hash rate limiting, Gemini timeout/output validation, and spend controls even though browser state is local and editable.

CORS permits the production GitHub Pages origin, the Cloudflare Workers mirror (`nepsis-site.nepsis-corp.workers.dev` and `*-nepsis-site.nepsis-corp.workers.dev` previews), configured exact `COACH_ALLOWED_ORIGINS`, local development origins, and only exact Netlify deployment hosts matching `https://deploy-preview-<digits>--nepsis-focus.netlify.app` (no wildcard subdomains).

## Change policy

- Frontend-only changes may adjust presentation, accessibility, local storage, or tolerant rendering without changing the request/response fields or types.
- Additive response properties are allowed only when old clients can ignore them.
- A breaking request or response change requires a separately versioned endpoint/contract, Edge Function deployment, updated contract tests, and coordinated release; never silently change v1.
- Contract, local-only storage, privacy, and timer regressions run in `scripts/coach-regression.test.mjs` and timer suites before review.
