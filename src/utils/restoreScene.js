/**
 * restoreScene.js
 * Shared scene restoration logic used by both loadSharedScene and loadProject.
 * Pass BUILDING_TYPES from the caller to avoid circular imports.
 */

/**
 * Restore a scene payload into state via setter functions.
 * @param {Object} payload - The scene JSON from Supabase or shared link
 * @param {Object} setters - Map of state setter functions
 * @param {Array}  buildingTypes - BUILDING_TYPES array from App.jsx
 */
export function restoreScenePayload(payload, setters, buildingTypes) {
  const {
    setDimensions,
    setShapeMode,
    setConfirmedPolygon,
    setPolygonPoints,
    setPlacedBuildings,
    setLengthUnit,
    setAreaUnit,
    setSetbacksEnabled,
    setSetbackDistanceM,
    setLabels,
    setActiveComparisons,
    clearWallsHistory,
    setPools,
    setFoundations,
    setStairs,
    setFurnitureItems,
    setRoomLabels,
    setRoomStyles,
    setComparisonPositions,
    setComparisonRotations,
  } = setters

  // Land
  if (payload.land) {
    setDimensions(payload.land.dimensions || { length: 20, width: 15 })
    setShapeMode(payload.land.type === 'rectangle' ? 'rectangle' : 'polygon')
    if (payload.land.vertices) {
      setConfirmedPolygon(payload.land.vertices)
      setPolygonPoints(payload.land.vertices)
    }
  }

  // Buildings
  if (payload.buildings) {
    const restoredBuildings = payload.buildings
      .map(b => {
        const buildingType = buildingTypes.find(t => t.id === b.typeId)
        return buildingType
          ? { id: b.id, type: buildingType, position: { x: b.x, z: b.z }, rotationY: b.rotationY }
          : null
      })
      .filter(Boolean)
    setPlacedBuildings(restoredBuildings)
  }

  // Settings
  if (payload.settings) {
    if (payload.settings.unitSystem) {
      setLengthUnit(payload.settings.unitSystem.lengthUnit || 'm')
      setAreaUnit(payload.settings.unitSystem.areaUnit || 'm²')
    }
    if (payload.settings.setbacksEnabled !== undefined) setSetbacksEnabled(payload.settings.setbacksEnabled)
    if (payload.settings.setbackDistanceM !== undefined) setSetbackDistanceM(payload.settings.setbackDistanceM)
    if (payload.settings.labels) setLabels(payload.settings.labels)
  }

  // Comparisons
  if (payload.comparisons) {
    const comparisons = {}
    payload.comparisons.forEach(id => { comparisons[id] = true })
    setActiveComparisons(comparisons)
  }

  // Walls
  if (payload.walls && Array.isArray(payload.walls)) {
    const loadedWalls = payload.walls
      .filter(w => w && w.start && w.end)
      .map(wall => ({
        id: wall.id || crypto.randomUUID(),
        start: { x: wall.start.x, z: wall.start.z },
        end: { x: wall.end.x, z: wall.end.z },
        height: wall.height || 2.7,
        thickness: wall.thickness || 0.15,
        openings: (wall.openings || [])
          .filter(o => o && o.type && typeof o.position === 'number')
          .map(opening => ({
            id: opening.id || crypto.randomUUID(),
            type: opening.type,
            position: opening.position,
            width: opening.width,
            height: opening.height,
            sillHeight: opening.sillHeight || 0,
          })),
      }))
    clearWallsHistory(loadedWalls)
  } else {
    clearWallsHistory([])
  }

  // v2 fields (backward compatible)
  setPools(payload.pools && Array.isArray(payload.pools) ? payload.pools : [])
  setFoundations(payload.foundations && Array.isArray(payload.foundations) ? payload.foundations : [])
  setStairs(payload.stairs && Array.isArray(payload.stairs) ? payload.stairs : [])
  setFurnitureItems(payload.furniture && Array.isArray(payload.furniture) ? payload.furniture : [])
  setRoomLabels(payload.roomLabels || {})
  setRoomStyles(payload.roomStyles || {})
  if (payload.comparisonPositions) setComparisonPositions(payload.comparisonPositions)
  if (payload.comparisonRotations) setComparisonRotations(payload.comparisonRotations)
}
