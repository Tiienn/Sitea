---
name: review
description: Review a built feature against its spec in specs/ — code quality, spec compliance, browser verification — producing a verdict and fix list. Use after /build, before deploying.
---

# /review — review an implementation against its spec

Spec to review (name, path, or empty): $ARGUMENTS

## Resolve the spec

- If $ARGUMENTS names a spec, use `specs/<name>.md`.
- If empty: list specs with status `built`; if exactly one, use it; if several, ask.
- If nothing is `built`, say so and stop.

## Review process

Review the implementation **adversarially** — your job is to find what's wrong, not to confirm it's fine. Three passes:

### 1. Spec compliance
- Re-read the spec's happy path, UX details, scope, and edge cases.
- Diff the relevant commits (`git log` / `git diff` scoped to the build's commits) and confirm each acceptance criterion is genuinely implemented — not just checked off.
- Hunt for scope creep (things built that the spec excluded) and silent omissions (spec'd behavior that's missing).

### 2. Code quality
Read every changed file in full and check:
- Root-cause fixes vs band-aids; simplicity (CLAUDE.md rules 6, 8, 9); minimal blast radius.
- Bugs: state races, missing cleanup (event listeners, intervals, three.js disposals), stale closures, broken edge cases.
- Scene work: FAST vs BEST budgets respected, no per-frame allocations or React re-renders in hot paths, instancing preserved.
- UI: DESIGN.md spacing/typography/color rules, mobile touch targets, no layout shift.
- Conventions: matches surrounding code style; no leftover debug logs, dead code, or commented-out blocks.

### 3. Behavior in the browser
- Run the dev server and walk the spec's happy path yourself with the browser tools (use `?qaTime` to drive time of day if relevant).
- Probe at least two edge cases from the spec.
- Check the console for errors/warnings introduced by the change.
- Screenshot evidence to `tasks/screenshots/<spec-name>/review-*.jpeg`.
- Run `npx eslint` on the changed files and `npm run build`.

## Verdict

Append to the spec file:

```markdown
## Review — <date>
Verdict: approved | changes-requested

### Verified
- <criterion> — how it was verified (screenshot/console/code path)

### Findings
- [severity: blocker|major|minor] <file:line> — issue, why it matters, suggested fix
```

Update the spec status: `approved` or `changes-requested`.

Report to the user: the verdict first, then findings ordered by severity, each with a concrete suggested fix. Do not fix anything yourself unless the user asks — except: if you find a **blocker** that takes under ~5 lines to fix safely, you may fix it, verify it, and note that in the review.

If verdict is `changes-requested`, suggest the user run /build again (it should read the review findings) or ask you to apply the fixes.
