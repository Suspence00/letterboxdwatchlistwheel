# Project Guidance

This is a browser-only application built with HTML, CSS, and native ES modules. Keep the runtime dependency-free and avoid adding a build step unless the requested change clearly requires one; Playwright is development tooling.

## Code Conventions

- Use semantic HTML and accessible names, states, and ARIA attributes when native semantics are insufficient.
- Keep JavaScript within the modules under `js/`, place helpers near their callers, and avoid adding global state.
- Put component-specific styles in `css/components/`. Within each CSS rule, keep declarations alphabetized and group related rules together.
- Optimize new media for web delivery and store it with the existing static assets of the same type.

## Relevant Documentation

- Use `wiki/Developer-Guide.md` when changing the application architecture or local development workflow.
- Consult the matching `wiki/Feature-*.md` file only when changing that feature. Update documentation when user-facing behavior or contributor workflow materially changes.

## Verification

Match verification to the change:

- After changing JavaScript modules, run `node health_check.js`.
- For interactive behavior, run the affected Playwright spec or test. Use `sample-watchlist.csv` for import and wheel flows.
- The Playwright setup serves the repository locally and mocks covered external import and metadata requests. Run relevant tests, fix failures caused by the requested change, and rerun them without pausing for routine approval.

For implementation tasks, finish the requested change, inspect the resulting diff, and run the relevant checks before handing it back. Report any check that could not be run.
