# Creating New Compare Objects

When adding new comparison objects to the Compare section, follow this process for every object.

## 1. Research

- **Search the web** for the object's real-world appearance, architecture, and distinctive visual features.
- **Dimensions**: Find the official/standard dimensions (width × length in meters). If multiple sizes exist (e.g., amateur vs professional), use the most popular or standard/professional size.
- **Logo/emblem**: Check if the object has an iconic logo, emblem, or symbol (e.g., Pokéball on Pokémon Center, plumbob on Sims house). If yes, search the web for reference and include it in the 3D model.

## 2. Files to Modify

Every new object requires changes in **3 files**:

### `src/App.jsx`
- Add the object to the comparison objects array with `id`, `name`, `width`, `length`, and `color`.

### `src/components/ComparePanel.jsx`
- Add the `id` to `FREE_OBJECTS` array (if free) or leave it out (if premium).
- Add the `id` to `OBJECT_CATEGORIES` mapping (e.g., `myObject: 'sports'`).
- Add an SVG thumbnail in the `Thumbnails` object.

### `src/components/scene/ComparisonObjects.jsx`
- If the object needs a custom 3D model (not just a flat rectangle):
  - Create a texture hook (`useMyObjectTexture`) if it's a flat surface with markings (courts, fields).
  - Create a 3D component (`MyObject3D`).
  - Register it in the `render3DModel()` switch statement.
- If a flat colored rectangle is fine (generic), no changes needed here — it falls through to `GenericComparison3D`.

## 3. Thumbnail Design

- Use front-elevation or side-view style (not top-down) for buildings, vehicles, and landmarks.
- Use top-down view for flat surfaces (courts, fields, pools, parking spaces).
- SVG viewBox: `"0 0 40 40"`, className: `"w-10 h-10"`.
- Include recognizable details: distinctive colors, logos, structural features.
- Add context backgrounds (sky for landmarks, grass for houses, asphalt for vehicles).

## 4. 3D Model Design

- **Sports courts/fields**: Use Canvas API to draw markings → `THREE.CanvasTexture` on a plane. Add 3D elements (nets, posts, goals) as separate meshes.
- **Buildings**: Use box geometries for walls, roofs, windows, doors. Follow the existing pattern (see PokemonCenter3D, MinecraftHouse3D, etc.).
- **Vehicles**: Use box/cylinder geometries. Keep it simple but recognizable.
- All geometry should use `obj.width` and `obj.length` from props for sizing.

## 5. Cross-check

- Verify dimensions match real-world measurements.
- Verify the logo/emblem is correctly oriented and colored.
- Run `npm run build` to confirm no errors.
- Check for z-fighting (overlapping planes at same height — offset by 0.02-0.05).
