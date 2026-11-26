# Component kit review (docs only)

Scope: map the code snippets reviewed on 2026-11-26 to their sources, and note what the Nepsis site already has. This PR changes no page, no CSS and no JavaScript.

## 1. Snippets reviewed → source

| Snippet (as pasted) | Source | Already in Nepsis? |
|---|---|---|
| `countdown` span with `--value` per unit (h / m / s) | daisyUI Countdown: https://daisyui.com/components/countdown/ | Partly. Exam countdown logic exists in the exam pages; no shared `countdown` component. |
| `avatar avatar-placeholder` with initials (D, SY, UI, AI) and `avatar-online` dot | daisyUI Avatar: https://daisyui.com/components/avatar/ | Partly. `my-nepsis.html` has a `.avatar` profile circle. No online-dot or size variants. |
| `hero min-h-screen` with `hero-overlay` and `hero-content` ("Hello there" demo) | daisyUI Hero: https://daisyui.com/components/hero/ | Yes, in a different form. `components.css` has `.hero-copy` for the home page. The daisyUI sample text and stock photo are demo content and should not be copied. |
| `mockup-window` (OS window frame) | daisyUI Window mockup: https://daisyui.com/components/mockup-window/ | Yes. `assets/css/window-chrome.css` already provides a macOS-style window with controls and a dock. |

Important: daisyUI needs Tailwind and its own theme variables. Nepsis uses plain CSS with `assets/css/theme.css` (Nunito, light tokens only). Adding daisyUI would clash with those tokens, so any port should be written in the Nepsis token style.

## 2. Origin Kit (https://www.originkit.dev/?sort=copied)

Only the list page was read (titles, previews, links). No component code was checked, and the components are not ported.

Possible fits for a calm study app (candidates to inspect, not approved):
- Scroll Text Highlight: https://www.originkit.dev/components/scroll-text-highlight (scroll)
- Weight Hover: https://www.originkit.dev/components/weight-hover (text and hover states)
- Radial Reveal Button: https://www.originkit.dev/components/radial-reveal-button (buttons)
- Glass Icon: https://www.originkit.dev/components/glass-icon (icons)
- Plush Tile: https://www.originkit.dev/components/plush-tile (cards)
- Vector Wordmark: https://www.originkit.dev/components/vector-wordmark (logo)

Probably too loud or redundant for this site:
- Globe: https://www.originkit.dev/components/globe (the site already has a 3D globe)
- Tornado, Particle Sphere, Snowfall, Glitter Cascade, Neon Border, Cursor Ring Field

Notes:
- Origin Kit code is React/Framer. Each candidate would need porting to plain HTML/CSS/JS.
- Fonts, select menus and dropdowns did not appear in the most-copied list. Ask for specific component links if these are needed.
- Every candidate must respect `prefers-reduced-motion` and keep the light palette.

## 3. Open questions for the owner

1. Pick at most two Origin Kit candidates to inspect in detail, for example Scroll Text Highlight and Plush Tile.
2. Confirm that the existing macOS window and hero are the intended visual direction, so no daisyUI port is needed.
