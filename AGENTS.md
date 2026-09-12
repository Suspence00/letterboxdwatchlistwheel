# Project Guidance

This is a browser-only application built with HTML, CSS, and native ES modules. Keep the runtime dependency-free and avoid adding a build step unless the requested change clearly requires one; Playwright is development tooling.

## Code Conventions

- Use semantic HTML and accessible names, states, and ARIA attributes when native semantics are insufficient.
- Keep JavaScript within focused, modular ES modules under `js/` (and submodules under `js/ui/`).
- Place helpers near their callers, and avoid adding global state.
- Keep individual module sizes lean (< 500 lines target) to preserve AI model context quality and avoid edit collisions.
- Reference JSDoc types in `js/types.js` (`Movie`, `AppState`, `Workspace`, `WinnerContext`, etc.) for strict type awareness without build steps.
- Put component-specific styles in `css/components/`. Within each CSS rule, keep declarations alphabetized and group related rules together.
- Optimize new media for web delivery and store it with the existing static assets of the same type.

## Architecture & Module Directory

| Feature Area | Primary File(s) | Notes |
| :--- | :--- | :--- |
| **Data Contracts & Types** | `js/types.js` | JSDoc `@typedef` annotations for `Movie`, `AppState`, etc. |
| **UI Orchestrator & Barrel** | `js/ui.js` | Main UI entry point; preserves public feature exports while keeping component internals private. |
| **Movie List Coordination** | `js/ui/movie-list.js` | Filtering, sorting, and list/wheel/editor updates. |
| **Movie Row Controls** | `js/ui/movie-list-item.js` | Row markup and selection, weight, color, and boost controls. |
| **Movie List Viewport** | `js/ui/movie-list-viewport.js` | List rendering and virtualization for large lists. |
| **Winner Dialog & Radarr** | `js/ui/winner-modal.js` | Winner celebration, Radarr export, runtime/synopsis, trailers. |
| **Knockout Stage & Contenders** | `js/ui/knockout-ui.js` | Knockout eliminations, contenders box, stage launch effects. |
| **Slice Editor & Odds** | `js/ui/slice-editor.js` | Slice color picker, weight slider, live odds calculation display. |
| **Boost Station & Tags** | `js/ui/boost-station.js` | Booster names, contributor tags, boost/unboost arithmetic. |
| **Workspace & Boards** | `js/ui/boards-ui.js` | Board switcher dropdown, create/rename/delete boards modal. |
| **History Modal** | `js/ui/history-modal.js` | Winner history log rendering and clearing. |
| **Generic Modals & Dialogs** | `js/ui/modals.js` | Reusable confirm modal, prompt modal, fairness audit report. |
| **Confetti Animation** | `js/ui/confetti.js` | Canvas-free lightweight CSS/DOM confetti particle burst. |
| **Canvas Wheel Physics** | `js/wheel.js` | 2D Canvas rendering, slice geometry, physics simulation, easing. |
| **3D VHS Wheel** | `js/vhs-wheel.js` | 3D cassette tape lineup, animations, cassette shaders. |
| **Import & Scraping** | `js/import.js` | CSV parsing, Letterboxd web scraping via CORS proxy, sync. |
| **Audio & Wheel.FM** | `js/audio.js` | Web Audio synthesizer effects and Wheel.FM radio player. |
| **State Persistence** | `js/state.js` | `localStorage` state management, migrations, debounced persistence. |

## Relevant Documentation

- Use `wiki/Developer-Guide.md` when changing the application architecture or local development workflow.
- Consult the matching `wiki/Feature-*.md` file only when changing that feature. Update documentation when user-facing behavior or contributor workflow materially changes.

## Verification

Match verification to the change:

- After changing JavaScript modules, run `node health_check.js`.
- For interactive behavior, run the affected Playwright spec or test. Use `sample-watchlist.csv` for import and wheel flows.
- The Playwright setup serves the repository locally and mocks covered external import and metadata requests. Run relevant tests, fix failures caused by the requested change, and rerun them without pausing for routine approval.

For implementation tasks, finish the requested change, inspect the resulting diff, and run the relevant checks before handing it back. Report any check that could not be run.
