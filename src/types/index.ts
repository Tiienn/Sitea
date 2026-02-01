/**
 * Core type definitions for Sitea Land Visualizer
 * These types can be imported in both JS and TS files
 */

// ============================================
// Basic Types
// ============================================

export interface Point2D {
  x: number
  y: number
}

export interface Point3D {
  x: number
  y: number
  z: number
}

export interface Vector2D {
  x: number
  z: number
}

// ============================================
// Building Types
// ============================================

export interface BuildingType {
  id: string
  name: string
  width: number
  length: number
  height: number
  color: string
  icon: string
}

export interface PlacedBuilding {
  id: string
  typeId: string
  position: Point3D
  rotationY: number
  name?: string
}

export interface Building {
  id: string
  walls: Wall[]
  position: Point3D
  rotation: number
}

// ============================================
// Wall & Opening Types
// ============================================

export type OpeningType = 'door' | 'window'

export interface Opening {
  id: string
  type: OpeningType
  position: number  // Distance along wall from start
  width: number
  height: number
  sillHeight?: number  // For windows
}

export interface Wall {
  id: string
  start: Point2D
  end: Point2D
  height: number
  thickness: number
  openings: Opening[]
  color?: string
  isHalfWall?: boolean
  isFence?: boolean
  fenceType?: string
}

// ============================================
// Room Types
// ============================================

export interface Room {
  id: string
  wallIds: string[]
  vertices: Point2D[]
  area: number
  centroid: Point2D
}

export interface RoomStyle {
  floorColor?: string
  floorTexture?: string
}

// ============================================
// Pool & Foundation Types
// ============================================

export interface Pool {
  id: string
  vertices: Point2D[]
  depth: number
  deckMaterial: string
}

export interface Foundation {
  id: string
  vertices: Point2D[]
  height: number
  material: string
}

export interface Stairs {
  id: string
  position: Point2D
  rotation: number
  width: number
  topY: number
  style: string
}

// ============================================
// Roof Types
// ============================================

export type RoofType = 'flat' | 'gable' | 'hip' | 'shed'

export interface Roof {
  id: string
  roomId: string
  type: RoofType
  pitch: number
  overhang: number
  color?: string
}

// ============================================
// Comparison Objects
// ============================================

export interface ComparisonObject {
  id: string
  name: string
  width: number
  length: number
  color: string
}

export interface ComparisonPosition {
  x: number
  z: number
}

// ============================================
// Camera Types
// ============================================

export type CameraMode = 'firstPerson' | 'thirdPerson' | 'orbit'
export type ViewMode = '3d' | '2d' | 'firstPerson'
export type QualityLevel = 'low' | 'medium' | 'high'

export interface CameraState {
  position: Point3D
  rotation: number
  pitch: number
}

// ============================================
// Build Tools
// ============================================

export type BuildTool =
  | 'none'
  | 'room'
  | 'polygon'
  | 'wall'
  | 'halfWall'
  | 'fence'
  | 'door'
  | 'window'
  | 'select'
  | 'delete'
  | 'pool'
  | 'foundation'
  | 'stairs'
  | 'roof'

export interface SelectedElement {
  type: 'wall' | 'room' | 'pool' | 'foundation' | 'stairs' | 'roof'
  id: string
}

// ============================================
// Floor Plan Types
// ============================================

export interface FloorPlanWall {
  start: Point2D
  end: Point2D
  thickness?: number
}

export interface FloorPlanDoor {
  position: Point2D
  width: number
  rotation: number
}

export interface FloorPlanWindow {
  position: Point2D
  width: number
  rotation: number
}

export interface FloorPlanRoom {
  name: string
  vertices: Point2D[]
  area: number
}

export interface FloorPlanData {
  walls: FloorPlanWall[]
  doors: FloorPlanDoor[]
  windows: FloorPlanWindow[]
  rooms: FloorPlanRoom[]
  scale: number
  confidence: number
}

// ============================================
// Scene Sharing Types
// ============================================

export interface SharedScene {
  id: string
  polygonPoints: Point2D[]
  placedBuildings: PlacedBuilding[]
  walls: Wall[]
  rooms: Room[]
  pools: Pool[]
  foundations: Foundation[]
  stairs: Stairs[]
  roofs: Roof[]
  createdAt: string
}

// ============================================
// Unit Types
// ============================================

export type LengthUnit = 'm' | 'ft'
export type AreaUnit = 'm²' | 'ft²' | 'acres' | 'hectares'
