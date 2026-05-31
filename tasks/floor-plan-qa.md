# Scanned Floor Plan QA Loop

## Goal
Make floor-plan accuracy measurable before changing prompts, CV filtering, or 3D conversion. A fixture is demo-ready only when Sitea detects enough walls, doors, windows, rooms, and stairs, and the generated building can be placed in the 3D scene without obvious structural misses.

## Fixture Setup
1. Add three representative scanned PDFs to `fixtures/floor-plan-qa/samples/`.
2. Update `fixtures/floor-plan-qa/manifest.json` if the expected counts differ from the default fixture slots.
3. Use scanned PDFs that cover:
   - Clear single-storey plan.
   - Low-contrast phone scan.
   - Dimensioned plan with stairs.

For a deterministic baseline before real customer scans are available, run:

```bash
npm run qa:floor-plans:fixtures
```

This creates three scan-like PDFs matching the manifest. Replace them with real scans when available.

## Run Procedure
1. Start the app and sign in with a paid test account.
2. Open the unified upload flow or AI assistant upload.
3. Upload the fixture PDF.
4. For multi-page PDFs, choose the page listed in `manifest.json`.
5. Skip room labeling for the baseline run unless the fixture says otherwise.
6. Run the AI floor-plan analysis.
7. Inspect the detected walls, doors, windows, rooms, stairs, scale, and final 3D placement.
8. Record the detected counts:

```bash
npm run qa:floor-plans:record -- single-storey-clear-scan --walls 18 --doors 6 --windows 7 --rooms 5 --stairs 0 --note "baseline run"
```

For the local analyzer fixture runner, load a local env file with `OPENAI_API_KEY` for the OpenAI-first path or `GEMINI_API_KEY` for the legacy fallback, then run:

```bash
npm run qa:floor-plans:run
```

This uses the same `api/analyze-floor-plan.js` handler with a local-only QA subscription bypass. The bypass is disabled on Vercel.
If `vercel env pull` writes empty placeholders for sensitive values, manually set a non-empty `OPENAI_API_KEY` or `GEMINI_API_KEY` in `.env.qa.local`, or export it in the shell before running the fixtures.
Optional model overrides: `OPENAI_FLOOR_PLAN_MODEL` controls OpenAI vision/structured output, and `OPENAI_IMAGE_MODEL` controls the GPT Image wall-mask stage.

9. Generate the report:

```bash
npm run qa:floor-plans
```

10. Use the pass/fail table in `tasks/floor-plan-qa-results.md` to choose the next analyzer fix.

## Demo-Ready Criteria
- Walls: at least 95% of expected count.
- Doors: at least 90% of expected count.
- Windows: at least 90% of expected count.
- Rooms: at least 80% of expected count.
- Stairs: 100% of expected count.
- No critical misses from the fixture checklist.
- Generated building can be placed, moved, rotated, and inspected in 3D.

## Critical Miss Examples
- Exterior perimeter is open or badly shifted.
- Door openings are interpreted as walls.
- Windows are missing from most exterior walls.
- Furniture, fixtures, text, or dimension lines become walls.
- Stairs are missed or classified as a room.
- Scale is obviously wrong when printed dimensions are visible.

## Result Files
Each result lives at `fixtures/floor-plan-qa/results/<fixture-id>.json`. The QA script can read either:
- A manual result recorded with `npm run qa:floor-plans:record`.
- A raw analyzer JSON response containing `walls`, `doors`, `windows`, `rooms`, and `stairs`.

Keep screenshots or rendered previews under `fixtures/floor-plan-qa/results/artifacts/` and reference them with `--artifact preview=...` when recording.
