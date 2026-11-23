# Auth audit: Google-only sign-in

Status: **audit only. No code was removed.** The email magic-link removal needs a decision from the owner first (see section 4).

## 1. What the code does today

| Area | Location | Behaviour |
|---|---|---|
| Google sign-in | `assets/js/google-oauth.js` (`signInWithOAuth`, lines ~485 and ~506) | Primary sign-in on all pages. Same-tab redirect on mobile and in-app browsers, popup on desktop. |
| Code exchange on return | `assets/js/google-oauth.js` (`exchangeCodeForSession`, line ~351) | Handles `?code=` and `#error=` returns. Covered by `scripts/google-oauth-return.test.mjs`. |
| Email magic link, homepage | `assets/js/pages/index-1.js` (~line 1227, `signInWithOtp`), form `#accEmail` in the account modal | Sends a one-time link to an email address. |
| Email magic link, dashboard | `assets/js/pages/my-nepsis-1.js` (line 99, `signInWithOtp`), form `#emailSignInForm` in `my-nepsis.html` (line ~208) | Same flow, with its own UI. |
| Password login / sign-up / password reset | none found | `signInWithPassword`, `signUp`, `resetPasswordForEmail` are not called anywhere. |
| Sign-out | `index-1.js` (~1238), `practice-1.js` (~2156), `my-nepsis-1.js` (line 100) | All use `signOut({ scope: "local" })` or `signOut()`. |
| Account data isolation | `supabase/migrations/*` | 5 migrations enable RLS. **The policies were not audited in this pass.** |

Conclusion: the only email-based sign-in is magic link. There is no password to remove.

## 2. Dependencies on email

- Magic link is the only email dependency. Nothing else in the repo sends email on the user's behalf. No notifications or verification flow were found.
- Supabase sends the magic-link email. Changing the Email provider or the redirect URL is a Supabase dashboard change and is **out of scope** without approval.

## 3. Risks to existing users if the email UI is removed

1. **Users who only ever signed in with email lose their way in.** Their account is tied to their email login. Once the form is gone, they can sign in only if their Google account is linked to the same account. Whether Supabase links automatically depends on project settings I have not verified. This must be checked in the dashboard before any removal.
2. **Encrypted diary.** The diary is encrypted with a passphrase (`diaryPassphrase`, migration `20261115230037`). Losing login does not delete the data, but a user who cannot sign in cannot reach their diary.
3. **Guest data.** Local notes stay on the device, so guests are not affected.
4. **Mismatched email.** If a user's Google email differs from the one used for magic link, they will get a second, empty account unless they link the two first.

## 4. Decision needed before removal

Options:

- **A (recommended):** keep magic link in the code, hide it from new visitors, and keep it visible only to accounts whose only identity is email. This needs a check of `auth.identities` in Supabase.
- **B:** remove both forms now. Do this only after confirming in the Supabase dashboard that accounts with email identities can link Google with the same email, and after telling affected users.
- **C:** keep both forms. Google stays the default and is shown first.

Please choose A, B or C. I will not change Supabase dashboard settings, providers, redirect URLs or secrets without your explicit approval.

## 5. Not verified in this pass

- Google sign-in end to end (the OAuth browser test needs GitHub Actions, where the Supabase CDN is reachable).
- RLS policies per table.
- Whether Supabase auto-links identities by email in this project.
- Sign-out across pages in a real browser session.
