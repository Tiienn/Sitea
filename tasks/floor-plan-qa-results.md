# Floor Plan QA Results

Generated: 2026-05-31T19:20:51.363Z

Demo-ready fixtures: 3/3
Review-only real fixtures with results: 3/3

| Fixture | Source | Status | Walls | Doors | Windows | Rooms | Stairs | Notes |
|---|---|---|---:|---:|---:|---:|---:|---|
| single-storey-clear-scan | samples/single-storey-clear-scan.pdf | Demo-ready | 39/18 (100%) | 12/6 (100%) | 7/7 (100%) | 14/5 (100%) | 0/0 (100%) | local analyzer fixture run; scale: assumed 0.9m single-door width ~70px, 78.0 px/m, 40% confidence |
| low-contrast-phone-scan | samples/low-contrast-phone-scan.pdf | Demo-ready | 23/22 (100%) | 13/7 (100%) | 8/8 (100%) | 10/6 (100%) | 0/0 (100%) | local analyzer fixture run; scale: assumed standard 0.9m single-door opening ~ 90 px, 100.0 px/m, 40% confidence |
| dimensioned-plan-with-stairs | samples/dimensioned-plan-with-stairs.pdf | Demo-ready | 80/28 (100%) | 10/9 (100%) | 10/10 (100%) | 10/8 (100%) | 1/1 (100%) | local analyzer fixture run; scale: dimension_label, 43.8 px/m, 93% confidence |
| real-wide-40x30 | samples/real/real-wide-40x30.webp | Review-only | 45 detected | 7 detected | 9 detected | 10 detected | 0 detected | local analyzer fixture run; scale: dimension_label, 147.6 px/m, 95% confidence |
| real-site-ground-floor | samples/real/real-site-ground-floor.png | Review-only | 35 detected | 5 detected | 5 detected | 7 detected | 1 detected | local analyzer fixture run; scale: dimension_label, 33.7 px/m, 95% confidence |
| real-site-upper-floor | samples/real/real-site-upper-floor.png | Review-only | 48 detected | 7 detected | 4 detected | 10 detected | 1 detected | local analyzer fixture run; scale: dimension_label, 41.0 px/m, 93% confidence |

## Demo Readiness Rules

- Walls: 95% or better.
- Doors: 90% or better.
- Windows: 90% or better.
- Rooms: 80% or better.
- Stairs: 100% or better.
- No critical misses.
- The generated building must be placeable in the 3D scene.
- Review-only real fixtures report detected counts and notes, but do not affect demo-ready scoring.

## Next Action

All scored fixtures are demo-ready. Review real fixture raw outputs and 3D placement before analyzer changes.
