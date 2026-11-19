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

The client always emits these six keys; `documentText: ""` means no file. Auth identity stays in HTTP headers, not the JSON. Guest check-ins, timer preferences, history, and client quota remain in browser `localStorage`; none are synced to Supabase. The server separately retains a hashed identity/day quota for cost protection (2 guest / 30 signed-in requests per day). Browser counters are convenience limits, not security controls.

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
  "source": "gemini"
}
```

`timer.focusMinutes` is one of 5, 10, 25, 45, or 60, and never exceeds `available`; the UI may override it with a user-entered whole-minute duration that is within 5–180 and within total available minutes. `breakMinutes` is a non-negative integer capped by the remaining available time. `steps` and `questions` are arrays of strings; `quiz` is an array of `{question, answer}` objects (empty when no source text); `source` is a string. The frontend validates the required structure and renders text as text, not HTML.

## Errors and guardrails

Known error shapes are `{ "error": "..." }`: `origin_not_allowed`, `method_not_allowed`, `request_too_large`, `invalid_json`, `invalid_input`, `consent_required`, `service_unavailable`, `daily_limit_reached`, `ai_unavailable`, and `invalid_model_output`. Preserve server-side body/input validation, IP/user-hash rate limiting, Gemini timeout/output validation, and spend controls even though browser state is local and editable.

CORS permits the production site, configured exact `COACH_ALLOWED_ORIGINS`, local development origins, and only exact Netlify deployment hosts matching `https://deploy-preview-<digits>--nepsis-focus.netlify.app` (no wildcard subdomains).

## Change policy

- Frontend-only changes may adjust presentation, accessibility, local storage, or tolerant rendering without changing the request/response fields or types.
- Additive response properties are allowed only when old clients can ignore them.
- A breaking request or response change requires a separately versioned endpoint/contract, Edge Function deployment, updated contract tests, and coordinated release; never silently change v1.
- Contract, local-only storage, privacy, and timer regressions run in `scripts/coach-regression.test.mjs` and timer suites before review.
