# Agent Instructions

## Scope
These instructions apply to the entire repository.

## General Guidelines
- Prefer semantic, self-documenting HTML and accessible ARIA attributes when editing markup.
- Keep JavaScript in `script.js` modular by organizing helper functions near their usage and avoid introducing global variables when possible.
- Maintain consistent formatting in CSS: order declarations alphabetically within a rule and group related rules together.
- Update both `README.md` and `readme.md` only when documentation changes are substantial; otherwise leave them untouched.

## Testing
- When code changes affect interactive behavior, manually verify the change using the sample data in `sample-watchlist.csv`.

## Repository Hygiene
- Keep the project dependency-free unless absolutely necessary. If a library is required, document the reason in the README files.
- Ensure any new assets are optimized for web delivery and placed alongside existing static files.
