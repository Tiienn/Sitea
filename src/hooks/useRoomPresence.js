// Detects which room the player is standing in during walk mode.
// Polls the shared player-position ref at 5 Hz (no per-frame React work);
// state changes only on room enter/exit.
//
// Hand-drawn rooms carry world-space polygons → point-in-polygon, innermost
// (smallest area) wins. Floor-plan building rooms only have center + area
// (no polygon), so inside a building's wall bounding box the nearest room
// center wins.

import { useEffect, useRef, useState } from 'react'
import { isPointInPolygon } from '../utils/roomDetection'

const POLL_MS = 200
const BUILDING_BBOX_MARGIN = 0.3

function findHandDrawnRoom(px, pz, rooms, roomLabels) {
  let best = null
  for (const room of rooms) {
    if (!room.points || room.points.length < 3 || !(room.area > 0.01)) continue
    if (!isPointInPolygon({ x: px, z: pz }, room.points)) continue
    if (!best || room.area < best.area) best = room
  }
  if (!best) return null
  return { id: best.id, name: roomLabels[best.id] || null, area: best.area }
}

function findBuildingRoom(px, pz, buildings) {
  for (const building of buildings) {
    if (!building.walls?.length || !building.rooms?.length) continue

    // Player position in building-local coordinates (inverse of the
    // group's [position, rotationY] transform)
    const theta = building.rotation || 0
    const dx = px - building.position.x
    const dz = pz - building.position.z
    const lx = dx * Math.cos(theta) - dz * Math.sin(theta)
    const lz = dx * Math.sin(theta) + dz * Math.cos(theta)

    // Inside the building footprint at all?
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const wall of building.walls) {
      minX = Math.min(minX, wall.start.x, wall.end.x)
      maxX = Math.max(maxX, wall.start.x, wall.end.x)
      minZ = Math.min(minZ, wall.start.z, wall.end.z)
      maxZ = Math.max(maxZ, wall.start.z, wall.end.z)
    }
    if (lx < minX - BUILDING_BBOX_MARGIN || lx > maxX + BUILDING_BBOX_MARGIN ||
        lz < minZ - BUILDING_BBOX_MARGIN || lz > maxZ + BUILDING_BBOX_MARGIN) continue

    // Nearest room center (rooms have no polygons — center + area only)
    let best = null
    let bestDistSq = Infinity
    for (const room of building.rooms) {
      if (!room.center || !(room.area > 0.01)) continue
      const rdx = lx - room.center.x
      const rdz = lz - room.center.z
      const distSq = rdx * rdx + rdz * rdz
      if (distSq < bestDistSq) {
        bestDistSq = distSq
        best = room
      }
    }
    if (best) return { id: best.id, name: best.name || null, area: best.area }
  }
  return null
}

export function useRoomPresence({ playerPosRef, rooms = [], buildings = [], roomLabels = {}, enabled = false }) {
  const [currentRoom, setCurrentRoom] = useState(null)
  const currentIdRef = useRef(null)

  useEffect(() => {
    if (!enabled) {
      // Reset so re-entering walk mode inside the same room re-announces it
      currentIdRef.current = null
      return
    }

    const tick = () => {
      const pos = playerPosRef?.current
      if (!pos) return
      const drawn = findHandDrawnRoom(pos.x, pos.z, rooms, roomLabels)
      const built = findBuildingRoom(pos.x, pos.z, buildings)
      // If both match (overlap), innermost (smallest area) wins
      const room = drawn && built ? (drawn.area <= built.area ? drawn : built) : (drawn || built)
      const newId = room?.id ?? null
      if (newId !== currentIdRef.current) {
        currentIdRef.current = newId
        setCurrentRoom(room ?? null)
      }
    }

    const id = setInterval(tick, POLL_MS)
    return () => clearInterval(id)
  }, [enabled, playerPosRef, rooms, buildings, roomLabels])

  // While disabled the stale last room is never shown
  return enabled ? currentRoom : null
}
