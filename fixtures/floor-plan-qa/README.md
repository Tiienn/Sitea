# Floor Plan QA Fixtures

Place scanned floor-plan PDFs or rendered plan images in `samples/`.

To generate the deterministic baseline sample PDFs:

```bash
npm run qa:floor-plans:fixtures
```

Each fixture in `manifest.json` needs:
- `sourceFile`: relative path under this directory.
- `pageNumber`: PDF page to analyze.
- `expected`: expected wall, door, window, room, and stair counts.
- `criticalChecks`: plan-specific things that must not fail even if counts look good.

Record each run into `results/<fixture-id>.json` with:

```bash
npm run qa:floor-plans:record -- single-storey-clear-scan --walls 18 --doors 6 --windows 7 --rooms 5 --stairs 0 --note "good perimeter"
```

Then generate the summary:

```bash
npm run qa:floor-plans
```
