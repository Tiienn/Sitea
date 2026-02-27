# Redesign Gaming 3D Models

## Tasks
- [x] Redesign PokemonCenter3D to match Gen 4/5 game design
- [x] Verify build passes
- [ ] Redesign MinecraftHouse3D (7x7)
- [ ] Redesign ACVillagerHouse3D (5x4)
- [ ] Redesign Fortnite1x13D (5x5)
- [ ] Redesign ZeldaHouse3D (8x10)
- [ ] Redesign SimsStarterHome3D (10x12)

## Review

### Pokémon Center (Gen 4/5 style)
**`src/components/scene/ComparisonObjects.jsx`** — Replaced PokemonCenter3D

**Old**: Modern real-world store design (canopy, modern glass storefront, 3D rooftop Pokéball)

**New** — Gen 4/5 game-accurate Pokémon Center:
- Light gray walls (#E0E0E0) with darker base strip and white floor separator band
- Orange roof (#E87830) with darker trim, white border stripes on left/right sides (Gen 4 style)
- Pokéball emblem on roof front face (red half-cylinder top + white circle background)
- Black flanking lines beside Pokéball (Gen 5 detail)
- Automatic glass sliding doors with dark frame and sensor bar
- 1st floor windows flanking the door, 2nd floor smaller windows
- Side windows on both walls
- Electronic arrow entrance sign (green emissive, Gen 5 detail)
- Back service door and roof HVAC unit
- Zero planeGeometry — all z-fighting-safe
