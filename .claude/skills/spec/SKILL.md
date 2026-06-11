---
name: spec
description: Interview the user about a feature until it is understood in detail, then write a build-ready spec to specs/. Use when the user wants to define, scope, or plan a feature before building it.
---

# /spec — feature specification through interview

The user wants to spec out a feature. Their initial description (may be empty or vague): $ARGUMENTS

## Your job

Understand the feature **in detail** by interviewing the user, then write a spec file that /build can implement without needing to ask anything.

## Phase 1 — Investigate before asking

Before asking the user anything, spend a moment grounding yourself:
- Read the relevant parts of the codebase the feature would touch (search for related components, state, APIs).
- Check `specs/` for related or conflicting specs.
- Check CLAUDE.md rules (simplicity, DESIGN.md for UI, COMPARE-OBJECTS.md for comparison objects).

Never ask the user something the codebase can answer.

## Phase 2 — Interview in rounds

Use the AskUserQuestion tool in **rounds of 2-4 questions**. Keep asking follow-up rounds until you could write the spec with no significant guesses left. Typical areas to cover (skip what's already clear, dig into what's not):

1. **Job to be done** — what should the user of Sitea be able to do after this ships? What problem does it solve for them?
2. **Entry point & flow** — where does it start (button, agent command, automatic)? Walk the happy path step by step.
3. **Scope boundaries** — what is explicitly OUT of scope? What's the smallest version worth shipping?
4. **UX specifics** — desktop AND mobile behavior, view modes affected (Walk/3D/2D), free vs Pro gating.
5. **Data & state** — what persists (save/share payloads), what's session-only?
6. **Edge cases** — empty states, conflicting features, error paths.
7. **Success criteria** — how do we know it works? What would the user check on sitea.live?

Rules for the interview:
- Each question must offer concrete options with trade-offs, not open-ended essays (the user can always pick "Other").
- When the user's answer opens a new ambiguity, ask about it in the next round.
- Recommend an option when you have an informed opinion — mark it "(Recommended)".
- Stop when another round would not change what you'd build. Do not pad rounds; 2-3 rounds is typical, 1 is fine for small features.

## Phase 3 — Write the spec

Write to `specs/<kebab-case-feature-name>.md` (create the directory if needed):

```markdown
# <Feature name>

Status: ready-to-build
Created: <date>

## Summary
One paragraph: what this is and why it matters to Sitea users.

## User story
As a <land buyer / homeowner / visitor>, I want <...> so that <...>.

## Happy path
Numbered walkthrough of the exact flow, written so someone who has never seen the conversation can follow it.

## Scope
### In
- ...
### Out (explicitly)
- ...

## UX details
- Desktop: ...
- Mobile: ...
- View modes affected: Walk / 3D / 2D
- Free vs Pro: ...

## Technical approach
- Files expected to change (with paths)
- New components/state/utilities
- Data/persistence changes
- Performance notes (FAST vs BEST quality if scene-related)

## Edge cases
- ...

## Acceptance criteria
- [ ] Concrete, verifiable checks (each one testable in the browser or by build/lint)

## Open questions
Anything deliberately deferred (should be empty or trivial).
```

## Phase 4 — Confirm

Show the user a tight summary of the spec (not the whole file) and the path where it was saved. If they want changes, edit the spec, keep status `ready-to-build`. Do NOT start building — that's /build's job.
