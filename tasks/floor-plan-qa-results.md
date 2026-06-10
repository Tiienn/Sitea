# Floor Plan QA Results

Generated: 2026-06-10T14:32:49.321Z

Demo-ready fixtures: 3/3
Review-only real fixtures with results: 3/3

| Fixture | Source | Status | Walls | Doors | Windows | Rooms | Stairs | Notes |
|---|---|---|---:|---:|---:|---:|---:|---|
| single-storey-clear-scan | samples/single-storey-clear-scan.pdf | Demo-ready | 28/18 (100%) | 8/6 (100%) | 7/7 (100%) | 12/5 (100%) | 0/0 (100%) | local analyzer fixture run; scale: assumedDoorWidth0.9m, 88.9 px/m, 50% confidence |
| low-contrast-phone-scan | samples/low-contrast-phone-scan.pdf | Demo-ready | 59/22 (100%) | 12/7 (100%) | 9/8 (100%) | 11/6 (100%) | 0/0 (100%) | local analyzer fixture run; scale: total_area_label, 72.0 px/m, 60% confidence |
| dimensioned-plan-with-stairs | samples/dimensioned-plan-with-stairs.pdf | Demo-ready | 54/28 (100%) | 10/9 (100%) | 12/10 (100%) | 10/8 (100%) | 1/1 (100%) | local analyzer fixture run; scale: dimension_label_wall_bounds, 84.6 px/m, 93% confidence |
| real-wide-40x30 | samples/real/real-wide-40x30.webp | Review-only | 46 detected | 8 detected | 9 detected | 9 detected | 0 detected | local analyzer fixture run; scale: dimension_label_wall_bounds, 124.5 px/m, 93% confidence |
| real-site-ground-floor | samples/real/real-site-ground-floor.png | Review-only | 34 detected | 5 detected | 6 detected | 6 detected | 1 detected | local analyzer fixture run; scale: dimension_label, 34.8 px/m, 92% confidence |
| real-site-upper-floor | samples/real/real-site-upper-floor.png | Review-only | 59 detected | 5 detected | 5 detected | 10 detected | 1 detected | local analyzer fixture run; scale: dimension_label, 43.4 px/m, 93% confidence |

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
