# Nepsis analytics staging plan

## Current behavior

- The consent manager is loaded through `assets/js/analytics.js` on all site pages.
- Analytics providers are not loaded until the visitor explicitly accepts optional analytics. A rejection prevents provider loading; the visitor can reopen preferences from the persistent settings control.
- On the production GitHub Pages hostname, Umami is loaded only after consent. Its existing project ID is retained until PostHog staging has been verified and production activation is separately approved.
- On Netlify deploy previews matching `deploy-preview-N--nepsis-focus.netlify.app`, PostHog is loaded only after consent and only when a public `phc_` project token is configured.
- Local development and other hostnames do not load either provider.
- Session recording/replay is disabled. PostHog autocapture and automatic pageview capture are disabled; page views are sent explicitly with a page-name value only.
- The analytics module does not send diary text, email, account IDs, profile values, search text, quiz answers, or other free-text values.

## Event schema

Allowed names: `page_view`, `stage_selected`, `timer_started`, `timer_paused`, `timer_resumed`, `session_completed`, `quiz_started`, `quiz_completed`, `calendar_opened`, `login_started`, `library_searched`, `library_saved`.

Allowed properties: `stage`, `duration`, `result`, `section`, and `item_id`. Values are restricted to finite non-negative numbers, booleans, or short alphanumeric identifiers. Search terms, diary text, profile values, email, account identifiers, and quiz answers must never be passed.

## PostHog configuration

1. Use a dedicated PostHog project for staging. Add only its **Project API Key** (the public token beginning with `phc_`) to `POSTHOG_PROJECT_TOKEN` in `assets/js/analytics.js`.
2. Keep `POSTHOG_API_HOST` set to `https://eu.i.posthog.com` for the EU project.
3. Never put a Personal API Key or secret API key in browser code or the repository.
4. Restrict the staging project's authorized domains to the Netlify deploy-preview hostnames used for this repository.

## Verification before production

1. Open the PR deploy preview in a clean browser profile. Before consent, confirm that no requests go to Umami or PostHog.
2. Reject analytics and confirm that neither provider loads. Reopen settings, accept, and confirm that only PostHog loads on the deploy preview.
3. Inspect network payloads: confirm only the approved event names and properties are sent. Confirm that no search text, quiz answers, diary content, email, account ID, or profile fields appear.
4. Confirm that session recording/replay and autocapture remain disabled.
5. Confirm that the live GitHub Pages hostname continues to use Umami only after consent, and does not load PostHog.
6. Review provider retention settings and the bilingual privacy notice before any production PostHog activation. Production activation requires a separate approval; do not merge or deploy it as part of staging verification.
