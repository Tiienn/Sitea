# /goal prompt — Open-world redesign (Genshin-style)

Redesign the open-world environment of Sitea to look like a Genshin Impact–style open world: stylized anime-realism, not photorealism. Think vibrant saturated grass meadows, painterly trees with layered foliage clusters, soft gradient skies with bold stylized cumulus clouds, warm directional sunlight, and distant mountains fading into blue aerial-perspective haze. The world should feel lush, inviting, and hand-painted.

## Current state (read these first)
- `src/components/LandScene.jsx` — React Three Fiber canvas setup (Three.js r181 + Drei).
- `src/components/scene/SceneEnvironment.jsx` — sky shader, ground, mountains, trees, lighting, fog. This is the main file to redesign.
- `src/hooks/useGrassTextures.js` and `src/utils/textureGenerators.js` — procedural canvas textures.
- `src/constants/landSceneConstants.js` — materials/constants.
- Today: canvas-noise grass plane, low-poly icosahedron trees with flat shading, 2D billboard mountain silhouettes and treeline, shader gradient sky with time-of-day (0–1 `timeOfDay` param), linear fog, PCF soft shadows in BEST mode only.

## Scope — redesign all four areas
1. **Terrain & grass** — richer stylized grass: higher-res hand-painted-look textures, tiling breakup, color variation (sunlit patches, darker clumps), and instanced 3D grass blades near the camera (BEST mode only) with gentle wind sway.
2. **Trees & vegetation** — replace icosahedron trees with believable stylized trees: layered foliage clusters or quality CC0 stylized GLTF models, multiple species/variants, subtle wind sway, instanced for performance. Add light ground vegetation (bushes, flowers, rocks) scattered with the existing seeded placement approach.
3. **Sky & lighting** — keep the `timeOfDay` system working end-to-end, but make it beautiful: stylized volumetric-looking clouds, dramatic dawn/dusk gradients, warmer key light, softer ambient (hemisphere or gradient ambient), tuned shadows and fog colors per time of day. Subtle bloom/tone-mapping is allowed if cheap.
4. **Distant scenery** — replace the flat mountain billboards with layered parallax mountain meshes with real silhouette depth, tinted progressively bluer with distance (aerial perspective), plus a believable distant treeline.

## Constraints
- **Assets**: hybrid approach. Procedural where it works; free CC0 assets allowed (PolyHaven textures, Quaternius/Kenney stylized models). Check assets into the repo, compress/resize sensibly (keep total added assets under ~15 MB), and record sources + licenses in a `src/assets/ATTRIBUTION.md`.
- **Performance**: FAST mode must stay roughly as cheap as today (mobile/low-end). All heavy realism (3D grass, high-res maps, extra instances, post-processing) goes behind the existing BEST quality preset. Keep instancing everywhere. Verify no major frame-rate regression.
- **Don't break**: the `timeOfDay` animation, all camera modes (first-person, orbit, third-person, 2D orthographic), the land-plot polygon overlay, and shadows on buildings/objects. Leave `ComparisonObjects.jsx`, floor-plan analysis, and all non-scene app logic untouched except minimal integration points.
- Follow CLAUDE.md: write a plan to `tasks/todo.md` first, keep each change as small and simple as possible, commit incrementally with clear messages, and add a review section to `tasks/todo.md` at the end.

## Process & delivery
1. Create a new branch off `main` named `feature/open-world-genshin`.
2. Plan in `tasks/todo.md`, then work through the four areas one at a time, committing after each coherent step.
3. **Verify visually after every area**: run the dev server, load a scene with a land plot, and take screenshots (multiple camera angles, plus dawn/noon/dusk/night via `timeOfDay`) using the browser/screenshot tools. Judge the screenshots against the Genshin-style direction and iterate until it genuinely looks good — don't accept the first attempt.
4. Save before/after screenshots to `tasks/screenshots/open-world/`.
5. Run the production build (`npm run build`) and fix any errors.
6. Open a PR to `main` (do NOT merge) with before/after screenshots embedded and a summary of what changed in each area, asset sources, and performance notes for FAST vs BEST mode.
