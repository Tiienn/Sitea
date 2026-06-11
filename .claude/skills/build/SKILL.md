---
name: build
description: Implement a feature from a spec in specs/ (created by /spec), following CLAUDE.md rules, with incremental commits and browser verification. Use when the user wants to build a spec'd feature.
---

# /build — implement a spec

Spec to build (name, path, or empty): $ARGUMENTS

## Resolve the spec

- If $ARGUMENTS names a spec, use `specs/<name>.md` (fuzzy-match kebab-case).
- If empty: list specs with status `ready-to-build`; if exactly one, use it; if several, ask the user which one.
- If the spec's status is not `ready-to-build`, ask the user before proceeding (it may be built already or still in interview).

## Build loop

1. **Read the spec fully.** Also read every file it lists under "Technical approach" plus CLAUDE.md (and DESIGN.md for UI work, COMPARE-OBJECTS.md for comparison objects).
2. **Plan**: add a task list for this spec to `tasks/todo.md` (top of file, following the existing "## Active Plan:" convention) — one checkbox per coherent step, derived from the spec's happy path and acceptance criteria.
3. **Implement step by step**, checking off todo items as you go:
   - Keep every change as small and simple as possible (CLAUDE.md rules 6, 8, 9 — root causes, no temporary hacks).
   - Match surrounding code style; scene work must respect FAST vs BEST quality budgets.
   - Commit after each coherent step with a clear message (do not bundle unrelated concurrent changes — stage files explicitly, never `git add -A`).
4. **Verify after every user-visible step**, not just at the end:
   - `npx eslint` on changed files (0 errors required).
   - `npm run build` must pass.
   - For anything visual: run the dev server, drive the app with the browser tools (use `?qaTime` in dev to unlock the time slider), and screenshot to `tasks/screenshots/<spec-name>/`. Actually look at the screenshots and iterate until they match the spec's UX details.
5. **Acceptance criteria**: walk the spec's checklist one by one, verifying each in the browser. Check them off in the spec file itself.

## Finish

- Update the spec: status `built`, add a short "## Build notes" section (what shipped, deviations from the spec and why, screenshots paths).
- Mark the todo.md items done and add the review section per CLAUDE.md rule 7.
- Push the branch. Do NOT deploy to production unless the user asks in this conversation.
- Tell the user: what was built, what you verified, any deviation from the spec, and suggest running /review.

If the spec turns out to be ambiguous or wrong mid-build (missing case, contradicts the codebase), do not guess silently: make the smallest reasonable call, record it under "## Build notes > Deviations", and flag it to the user at the end. If it's a genuine fork in the road, stop and ask.
