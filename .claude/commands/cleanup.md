Scan the codebase for dead code, cleanup opportunities, and code quality improvements before a PR. Look for:

1. **Unused imports** in Python and JS/JSX files
2. **Dead functions** — defined but never called anywhere
3. **Commented-out code blocks** — large blocks of dead code left in comments
4. **Unused packages** in `backend/requirements.txt` — cross-reference against actual imports in `backend/src/`
5. **Hardcoded test values or placeholder strings** left in production code
6. **DRY violations** — duplicated logic in 2+ places that could be extracted into a shared helper or utility
7. **Missing reusable helpers** — repeated patterns (API calls, data transformations, error handling) that belong in a shared utility
8. **Frontend component duplication** — JSX patterns repeated across components that could become a shared component in `frontend/src/components/common-components/`
9. **Backend route duplication** — repeated logic across route handlers that could move to `backend/src/api/routes/helpers.py` or a service
10. **Modularity gaps** — large functions or route handlers doing too many things that should be split

For each finding report: file path, line number, what the issue is, and a suggested fix.

Then ask the user which findings they want applied.
