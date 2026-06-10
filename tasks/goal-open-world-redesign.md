Redesign Sitea's open-world environment to look like a Genshin Impact–style open world: stylized anime-realism, not photorealism — vibrant saturated grass meadows, painterly trees with layered foliage clusters, soft gradient skies with bold stylized cumulus clouds, warm sunlight, and distant mountains fading into blue aerial-perspective haze. Lush, inviting, hand-painted.

Current state (read first): src/components/LandScene.jsx (R3F canvas, Three.js r181 + Drei); src/components/scene/SceneEnvironment.jsx (sky shader, ground, mountains, trees, lighting, fog — the main file to redesign); src/hooks/useGrassTextures.js + src/utils/textureGenerators.js (procedural canvas textures); src/constants/landSceneConstants.js. Today: canvas-noise grass plane, low-poly icosahedron trees, 2D billboard mountains/treeline, gradient sky shader driven by timeOfDay (0–1), linear fog, PCF soft shadows in BEST mode only.

Scope — all four areas:
1. Terrain & grass: hand-painted-look textures, tiling breakup, color variation (sunlit patches, darker clumps), instanced 3D grass blades near the camera (BEST mode only) with gentle wind sway.
2. Trees & vegetation: replace icosahedron trees with stylized trees (layered foliage clusters or quality CC0 GLTF models), multiple variants, subtle wind sway, instanced. Scatter light ground vegetation (bushes, flowers, rocks) via the existing seeded placement.
3. Sky & lighting: keep timeOfDay working end-to-end; stylized volumetric-looking clouds, dramatic dawn/dusk gradients, warmer key light, hemisphere/gradient ambient, tuned shadow and fog colors per time of day. Subtle bloom/tone-mapping allowed if cheap.
4. Distant scenery: layered parallax mountain meshes with real silhouette depth, tinted progressively bluer with distance, plus a believable distant treeline.

Constraints:
- Assets: hybrid. Procedural where it works; free CC0 assets allowed (PolyHaven, Quaternius/Kenney), checked into the repo, compressed sensibly, total added assets under ~15 MB, sources + licenses recorded in src/assets/ATTRIBUTION.md.
- Performance: FAST mode must stay roughly as cheap as today (mobile/low-end); all heavy realism (3D grass, high-res maps, extra instances, post-processing) goes behind the BEST preset; keep instancing everywhere; verify no major frame-rate regression.
- Don't break: the timeOfDay animation, all camera modes (first-person, orbit, third-person, 2D orthographic), the land-plot polygon overlay, and shadows on buildings/objects. Leave ComparisonObjects.jsx, floor-plan analysis, and all non-scene app logic untouched except minimal integration points.
- Follow CLAUDE.md: write a plan to tasks/todo.md first, keep changes small and simple, commit incrementally with clear messages, add a review section to tasks/todo.md at the end.

Process & delivery:
1. Create a new branch off main named feature/open-world-genshin.
2. Work through the four areas one at a time, committing after each coherent step.
3. Verify visually after every area: run the dev server, load a scene with a land plot, screenshot multiple camera angles plus dawn/noon/dusk/night via timeOfDay; judge against the Genshin-style direction and iterate until it genuinely looks good — don't accept the first attempt.
4. Save before/after screenshots to tasks/screenshots/open-world/.
5. Run npm run build and fix any errors.
6. Open a PR to main (do NOT merge) with before/after screenshots embedded, a per-area summary, asset sources, and FAST vs BEST performance notes.
