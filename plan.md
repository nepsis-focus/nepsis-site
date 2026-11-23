# Nepsis 2.0 implementation plan

## Scope

Implement the first three requested features from the approved brief on branch `feature/nepsis-2-new-features`, preserving the existing static HTML/CSS/JavaScript architecture and the current visual identity:

1. Exam Planner 2.0 MVP: multiple subjects, exam dates, chapters/topics, study tasks, completion state, workload summary, and a simple focus-session handoff.
2. Smart Revision MVP: revision items created from study topics, adjustable spaced-repetition intervals, due-today view, upcoming revisions, mastered state, and a compact progress summary.
3. Focus Reflection MVP: optional post-session reflection with accomplishment, distraction, focus rating, and next step; local-first storage; no reflection text sent to analytics.

Focus Rooms remain out of implementation scope and will be documented as a later technical proposal.

## Design

Selected direction: **quiet editorial study desk**. The current warm Nepsis palette stays intact, with calm cream surfaces, copper/orange actions, generous whitespace, and compact utility cards. The planner uses a two-column “plan / today” composition rather than a dense project-management grid. Revision uses a vertical queue with clear due-state badges. Reflection is a short, low-friction overlay after a completed timer.

Core principles: small steps over dashboards; visible next action; private by default; bilingual Greek/English copy; mobile-first controls; no decorative complexity that competes with study.

Typography remains Nunito and the existing tokens from `theme.css`, with page-owned styles in `assets/css/pages/exams.css` and a small reflection layer in `assets/css/pages/practice.css`.

## Implementation structure

- `exams.html`: planner and revision interface, retaining the current exam countdown as a compact header feature.
- `assets/js/pages/exams-1.js`: local-first planner/revision state, rendering, language switching, and focus-session links.
- `assets/css/pages/exams.css`: planner/revision layout and responsive states.
- `practice.html` / `assets/js/pages/practice-1.js`: optional reflection dialog shown after a verified completed focus session.
- `assets/css/pages/practice.css`: reflection dialog styling.
- `manus-routes.json`: static route manifest update.

No database migration is required for the MVP. Private reflections and planner data remain local unless a later approved sync design is added. Analytics events exclude reflection text and sensitive free-form content.
