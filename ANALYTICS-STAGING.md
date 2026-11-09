# Nepsis analytics staging plan

## Current behavior

- Umami remains embedded and active where it was already configured.
- `assets/js/analytics.js` defines the event names and filters event properties. It emits a local `nepsis:analytics` browser event only; it does not send events to Umami or PostHog.
- No PostHog SDK, session recording, replay, diary content, email, account ID, or free-text value is added by this module.

## Event schema

Allowed names: `stage_selected`, `timer_started`, `timer_paused`, `timer_resumed`, `session_completed`, `quiz_started`, `quiz_completed`, `calendar_opened`, `login_started`, `library_searched`, `library_saved`.

Allowed properties: `stage`, `duration`, `result`, `section`, and `item_id`, containing only a string, number, or boolean. Callers must use opaque catalog IDs; never pass search text, diary text, profile values, email, or other personal data.

## Staging and consent

1. Deploy the branch to an isolated preview and configure a separate staging analytics project and hostname allowlist. Keep production Umami configuration unchanged.
2. Add a clear opt-in consent control and persist the choice before wiring any transport. Consent must default to off in regions where required; provide withdrawal and a privacy-policy description of providers, purpose, retention, and identifiers.
3. Send only validated schema events after consent. Verify payloads in browser network tools and confirm no free text, diary data, email, or account identifiers are present.
4. Keep PostHog disabled in production unless a separate approval covers privacy review and production configuration. Session recording remains disabled.
5. Review the privacy notice and retention settings before any analytics transport is enabled.
