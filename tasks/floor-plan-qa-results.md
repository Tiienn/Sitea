# Floor Plan QA Results

Generated: 2026-05-26T17:42:19.593Z

Demo-ready fixtures: 0/3

| Fixture | Source | Status | Walls | Doors | Windows | Rooms | Stairs | Notes |
|---|---|---|---:|---:|---:|---:|---:|---|
| single-storey-clear-scan | samples/single-storey-clear-scan.pdf | Needs run | 0/18 (0%) | 0/6 (0%) | 0/7 (0%) | 0/5 (0%) | 0/0 (100%) | low coverage: walls, doors, windows, rooms |
| low-contrast-phone-scan | samples/low-contrast-phone-scan.pdf | Needs run | 0/22 (0%) | 0/7 (0%) | 0/8 (0%) | 0/6 (0%) | 0/0 (100%) | low coverage: walls, doors, windows, rooms |
| dimensioned-plan-with-stairs | samples/dimensioned-plan-with-stairs.pdf | Needs run | 0/28 (0%) | 0/9 (0%) | 0/10 (0%) | 0/8 (0%) | 0/1 (0%) | low coverage: walls, doors, windows, rooms, stairs |

## Demo Readiness Rules

- Walls: 95% or better.
- Doors: 90% or better.
- Windows: 90% or better.
- Rooms: 80% or better.
- Stairs: 100% or better.
- No critical misses.
- The generated building must be placeable in the 3D scene.

## Next Action

Run missing fixtures, record results, then focus analyzer changes on the lowest-coverage categories.
