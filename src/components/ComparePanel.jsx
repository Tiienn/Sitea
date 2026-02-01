import { useState, useEffect } from 'react'
import { useUser } from '../hooks/useUser'

// Free comparison objects (available to all users)
const FREE_OBJECTS = ['house', 'carSedan', 'parkingSpace', 'eiffelTower', 'statueOfLiberty', 'greatPyramid', 'tajMahal', 'colosseum', 'bigBen', 'sevenEleven', 'mcdonalds', 'gasStation', 'supermarket', 'starbucks', 'walmart', 'pokemonCenter', 'minecraftHouse', 'acHouse', 'fortnite1x1', 'zeldaHouse', 'simsHouse']

// Calculate fit count and format for display
function getFitInfo(landArea, objWidth, objLength) {
  if (!landArea || landArea <= 0) return { text: '—', type: 'none' }

  const objArea = objWidth * objLength
  const ratio = landArea / objArea

  if (ratio >= 1) {
    const fitCount = Math.floor(ratio)
    // Format large numbers
    if (fitCount >= 1000) {
      return { text: `×${(fitCount / 1000).toFixed(1)}k`, type: 'fit', count: fitCount }
    }
    return { text: `×${fitCount.toLocaleString()}`, type: 'fit', count: fitCount }
  } else {
    // Object larger than land - show percentage
    return { text: `${(ratio * 100).toFixed(0)}%`, type: 'partial', ratio }
  }
}

// Category definitions with icons
const CATEGORIES = [
  { id: 'sports', label: 'Sports', icon: 'trophy' },
  { id: 'buildings', label: 'Buildings', icon: 'building' },
  { id: 'vehicles', label: 'Vehicles', icon: 'truck' },
  { id: 'commercial', label: 'Commercial', icon: 'store' },
  { id: 'landmarks', label: 'Landmarks', icon: 'landmark' },
  { id: 'gaming', label: 'Gaming', icon: 'gamepad' },
  { id: 'other', label: 'Other', icon: 'shapes' },
]

// Map objects to categories
const OBJECT_CATEGORIES = {
  soccerField: 'sports',
  basketballCourt: 'sports',
  tennisCourt: 'sports',
  house: 'buildings',
  studioApartment: 'buildings',
  carSedan: 'vehicles',
  shippingContainer: 'vehicles',
  schoolBus: 'vehicles',
  parkingSpace: 'other',
  swimmingPool: 'other',
  kingSizeBed: 'other',
  // Landmarks
  eiffelTower: 'landmarks',
  statueOfLiberty: 'landmarks',
  greatPyramid: 'landmarks',
  tajMahal: 'landmarks',
  colosseum: 'landmarks',
  bigBen: 'landmarks',
  // Commercial
  sevenEleven: 'commercial',
  mcdonalds: 'commercial',
  gasStation: 'commercial',
  supermarket: 'commercial',
  starbucks: 'commercial',
  walmart: 'commercial',
  // Gaming
  pokemonCenter: 'gaming',
  minecraftHouse: 'gaming',
  acHouse: 'gaming',
  fortnite1x1: 'gaming',
  zeldaHouse: 'gaming',
  simsHouse: 'gaming',
}

// Thumbnail SVGs for comparison objects (top-down views)
const Thumbnails = {
  soccerField: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Field background */}
      <rect x="2" y="6" width="36" height="28" rx="1" fill="#228B22" />
      {/* Boundary lines */}
      <rect x="4" y="8" width="32" height="24" rx="0.5" fill="none" stroke="white" strokeWidth="0.8" />
      {/* Center line */}
      <line x1="20" y1="8" x2="20" y2="32" stroke="white" strokeWidth="0.8" />
      {/* Center circle */}
      <circle cx="20" cy="20" r="4" fill="none" stroke="white" strokeWidth="0.8" />
      <circle cx="20" cy="20" r="0.8" fill="white" />
      {/* Left penalty area */}
      <rect x="4" y="13" width="6" height="14" fill="none" stroke="white" strokeWidth="0.8" />
      <rect x="4" y="16" width="3" height="8" fill="none" stroke="white" strokeWidth="0.6" />
      {/* Right penalty area */}
      <rect x="30" y="13" width="6" height="14" fill="none" stroke="white" strokeWidth="0.8" />
      <rect x="33" y="16" width="3" height="8" fill="none" stroke="white" strokeWidth="0.6" />
    </svg>
  ),
  basketballCourt: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Court background */}
      <rect x="2" y="8" width="36" height="24" rx="1" fill="#CD853F" />
      {/* Boundary */}
      <rect x="4" y="10" width="32" height="20" fill="none" stroke="white" strokeWidth="0.8" />
      {/* Center line */}
      <line x1="20" y1="10" x2="20" y2="30" stroke="white" strokeWidth="0.8" />
      {/* Center circle */}
      <circle cx="20" cy="20" r="3" fill="none" stroke="white" strokeWidth="0.8" />
      {/* Left key/paint */}
      <rect x="4" y="14" width="8" height="12" fill="none" stroke="white" strokeWidth="0.8" />
      <circle cx="12" cy="20" r="3" fill="none" stroke="white" strokeWidth="0.6" strokeDasharray="1.5 1" />
      {/* Left hoop */}
      <circle cx="6" cy="20" r="1.2" fill="none" stroke="#FF6B00" strokeWidth="0.8" />
      {/* Right key/paint */}
      <rect x="28" y="14" width="8" height="12" fill="none" stroke="white" strokeWidth="0.8" />
      <circle cx="28" cy="20" r="3" fill="none" stroke="white" strokeWidth="0.6" strokeDasharray="1.5 1" />
      {/* Right hoop */}
      <circle cx="34" cy="20" r="1.2" fill="none" stroke="#FF6B00" strokeWidth="0.8" />
    </svg>
  ),
  tennisCourt: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Court background */}
      <rect x="2" y="8" width="36" height="24" rx="1" fill="#4169E1" />
      {/* Boundary */}
      <rect x="4" y="10" width="32" height="20" fill="none" stroke="white" strokeWidth="0.8" />
      {/* Net line */}
      <line x1="20" y1="10" x2="20" y2="30" stroke="white" strokeWidth="1.2" />
      {/* Service boxes */}
      <rect x="10" y="10" width="10" height="10" fill="none" stroke="white" strokeWidth="0.6" />
      <rect x="10" y="20" width="10" height="10" fill="none" stroke="white" strokeWidth="0.6" />
      <rect x="20" y="10" width="10" height="10" fill="none" stroke="white" strokeWidth="0.6" />
      <rect x="20" y="20" width="10" height="10" fill="none" stroke="white" strokeWidth="0.6" />
      {/* Center marks */}
      <line x1="4" y1="20" x2="6" y2="20" stroke="white" strokeWidth="0.6" />
      <line x1="34" y1="20" x2="36" y2="20" stroke="white" strokeWidth="0.6" />
    </svg>
  ),
  house: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Floor plan - top down view */}
      <rect x="4" y="4" width="32" height="32" rx="1" fill="#D4A574" />
      {/* Walls outline */}
      <rect x="4" y="4" width="32" height="32" rx="1" fill="none" stroke="#8B5A2B" strokeWidth="2" />
      {/* Interior walls */}
      <line x1="4" y1="20" x2="22" y2="20" stroke="#8B5A2B" strokeWidth="1.5" />
      <line x1="22" y1="4" x2="22" y2="28" stroke="#8B5A2B" strokeWidth="1.5" />
      {/* Door openings */}
      <rect x="26" y="34" width="6" height="2" fill="#D4A574" />
      <rect x="10" y="19" width="5" height="2" fill="#D4A574" />
      {/* Room labels as small squares */}
      <rect x="8" y="8" width="10" height="8" fill="none" stroke="#A67B5B" strokeWidth="0.5" strokeDasharray="2 1" />
      <rect x="8" y="24" width="10" height="8" fill="none" stroke="#A67B5B" strokeWidth="0.5" strokeDasharray="2 1" />
      <rect x="26" y="8" width="8" height="16" fill="none" stroke="#A67B5B" strokeWidth="0.5" strokeDasharray="2 1" />
    </svg>
  ),
  parkingSpace: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Asphalt background */}
      <rect x="4" y="4" width="32" height="32" rx="2" fill="#3A3A3A" />
      {/* Parking bay lines */}
      <rect x="8" y="6" width="24" height="28" fill="none" stroke="white" strokeWidth="1.5" />
      {/* Car silhouette in space */}
      <rect x="12" y="10" width="16" height="20" rx="3" fill="#505050" stroke="#666" strokeWidth="0.5" />
      {/* Windshield hint */}
      <rect x="14" y="12" width="12" height="4" rx="1" fill="#4A4A4A" />
      {/* Wheel wells */}
      <ellipse cx="14" cy="14" rx="1.5" ry="2" fill="#2A2A2A" />
      <ellipse cx="26" cy="14" rx="1.5" ry="2" fill="#2A2A2A" />
      <ellipse cx="14" cy="26" rx="1.5" ry="2" fill="#2A2A2A" />
      <ellipse cx="26" cy="26" rx="1.5" ry="2" fill="#2A2A2A" />
    </svg>
  ),
  swimmingPool: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Pool background */}
      <rect x="2" y="8" width="36" height="24" rx="2" fill="#00CED1" />
      {/* Pool border/edge */}
      <rect x="2" y="8" width="36" height="24" rx="2" fill="none" stroke="#008B8B" strokeWidth="1.5" />
      {/* Lane lines */}
      <line x1="7" y1="8" x2="7" y2="32" stroke="white" strokeWidth="0.5" strokeOpacity="0.7" />
      <line x1="12" y1="8" x2="12" y2="32" stroke="white" strokeWidth="0.5" strokeOpacity="0.7" />
      <line x1="17" y1="8" x2="17" y2="32" stroke="white" strokeWidth="0.5" strokeOpacity="0.7" />
      <line x1="22" y1="8" x2="22" y2="32" stroke="white" strokeWidth="0.5" strokeOpacity="0.7" />
      <line x1="27" y1="8" x2="27" y2="32" stroke="white" strokeWidth="0.5" strokeOpacity="0.7" />
      <line x1="32" y1="8" x2="32" y2="32" stroke="white" strokeWidth="0.5" strokeOpacity="0.7" />
      {/* Starting blocks indicators */}
      <rect x="4" y="9" width="32" height="2" fill="#006666" fillOpacity="0.5" />
      <rect x="4" y="29" width="32" height="2" fill="#006666" fillOpacity="0.5" />
    </svg>
  ),
  carSedan: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Car body - sleek top down view */}
      <rect x="10" y="4" width="20" height="32" rx="5" fill="#4A90D9" />
      {/* Hood section */}
      <path d="M12 4 L28 4 Q30 4 30 6 L30 10 Q30 12 28 12 L12 12 Q10 12 10 10 L10 6 Q10 4 12 4" fill="#3A7BC8" />
      {/* Trunk section */}
      <rect x="12" y="28" width="16" height="6" rx="2" fill="#3A7BC8" />
      {/* Windshield */}
      <rect x="13" y="13" width="14" height="6" rx="1.5" fill="#1a1a2e" fillOpacity="0.7" />
      {/* Rear window */}
      <rect x="13" y="24" width="14" height="4" rx="1" fill="#1a1a2e" fillOpacity="0.7" />
      {/* Side mirrors */}
      <ellipse cx="8" cy="15" rx="2" ry="1.5" fill="#4A90D9" />
      <ellipse cx="32" cy="15" rx="2" ry="1.5" fill="#4A90D9" />
      {/* Wheels */}
      <ellipse cx="12" cy="9" rx="3" ry="2" fill="#222" />
      <ellipse cx="28" cy="9" rx="3" ry="2" fill="#222" />
      <ellipse cx="12" cy="31" rx="3" ry="2" fill="#222" />
      <ellipse cx="28" cy="31" rx="3" ry="2" fill="#222" />
    </svg>
  ),
  shippingContainer: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Container body - top down */}
      <rect x="4" y="6" width="32" height="28" rx="1" fill="#D35400" />
      {/* Container outline */}
      <rect x="4" y="6" width="32" height="28" rx="1" fill="none" stroke="#A04000" strokeWidth="1.5" />
      {/* Corrugated roof lines */}
      <line x1="4" y1="10" x2="36" y2="10" stroke="#C04800" strokeWidth="1" />
      <line x1="4" y1="14" x2="36" y2="14" stroke="#C04800" strokeWidth="1" />
      <line x1="4" y1="18" x2="36" y2="18" stroke="#C04800" strokeWidth="1" />
      <line x1="4" y1="22" x2="36" y2="22" stroke="#C04800" strokeWidth="1" />
      <line x1="4" y1="26" x2="36" y2="26" stroke="#C04800" strokeWidth="1" />
      <line x1="4" y1="30" x2="36" y2="30" stroke="#C04800" strokeWidth="1" />
      {/* Corner posts */}
      <rect x="4" y="6" width="3" height="28" fill="#B34700" />
      <rect x="33" y="6" width="3" height="28" fill="#B34700" />
    </svg>
  ),
  schoolBus: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Bus body - top down view */}
      <rect x="8" y="2" width="24" height="36" rx="3" fill="#FFB800" />
      {/* Bus outline */}
      <rect x="8" y="2" width="24" height="36" rx="3" fill="none" stroke="#E5A500" strokeWidth="1" />
      {/* Hood */}
      <rect x="10" y="2" width="20" height="6" rx="2" fill="#E5A500" />
      {/* Windshield */}
      <rect x="11" y="9" width="18" height="5" rx="1" fill="#1a1a2e" fillOpacity="0.6" />
      {/* Black stripe */}
      <rect x="8" y="15" width="24" height="1" fill="#222" />
      {/* Window row */}
      <rect x="10" y="18" width="5" height="3" rx="0.5" fill="#1a1a2e" fillOpacity="0.5" />
      <rect x="17" y="18" width="5" height="3" rx="0.5" fill="#1a1a2e" fillOpacity="0.5" />
      <rect x="24" y="18" width="6" height="3" rx="0.5" fill="#1a1a2e" fillOpacity="0.5" />
      <rect x="10" y="24" width="5" height="3" rx="0.5" fill="#1a1a2e" fillOpacity="0.5" />
      <rect x="17" y="24" width="5" height="3" rx="0.5" fill="#1a1a2e" fillOpacity="0.5" />
      <rect x="24" y="24" width="6" height="3" rx="0.5" fill="#1a1a2e" fillOpacity="0.5" />
      {/* Rear */}
      <rect x="12" y="32" width="16" height="4" rx="1" fill="#E5A500" />
      {/* Wheels */}
      <ellipse cx="10" cy="8" rx="3" ry="2" fill="#222" />
      <ellipse cx="30" cy="8" rx="3" ry="2" fill="#222" />
      <ellipse cx="10" cy="32" rx="3" ry="2" fill="#222" />
      <ellipse cx="30" cy="32" rx="3" ry="2" fill="#222" />
    </svg>
  ),
  kingSizeBed: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Bed frame */}
      <rect x="4" y="4" width="32" height="32" rx="2" fill="#6B4423" />
      {/* Mattress */}
      <rect x="6" y="8" width="28" height="26" rx="1.5" fill="#F5F0E6" />
      {/* Headboard */}
      <rect x="4" y="4" width="32" height="5" rx="1.5" fill="#4A2C17" />
      {/* Headboard detail */}
      <rect x="6" y="5" width="28" height="3" rx="1" fill="#5C3A21" />
      {/* Pillows */}
      <ellipse cx="14" cy="12" rx="6" ry="3" fill="white" />
      <ellipse cx="26" cy="12" rx="6" ry="3" fill="white" />
      {/* Pillow shadows */}
      <ellipse cx="14" cy="13" rx="5.5" ry="2" fill="#E8E8E8" />
      <ellipse cx="26" cy="13" rx="5.5" ry="2" fill="#E8E8E8" />
      {/* Blanket */}
      <rect x="7" y="18" width="26" height="15" rx="1" fill="#8B9DC3" />
      {/* Blanket fold line */}
      <line x1="7" y1="22" x2="33" y2="22" stroke="#7B8DB3" strokeWidth="1" />
    </svg>
  ),
  studioApartment: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Floor */}
      <rect x="4" y="4" width="32" height="32" rx="1" fill="#E8E4DF" />
      {/* Boundary walls */}
      <rect x="4" y="4" width="32" height="32" rx="1" fill="none" stroke="#6B6B6B" strokeWidth="2" />
      {/* Bathroom partition */}
      <line x1="4" y1="26" x2="14" y2="26" stroke="#6B6B6B" strokeWidth="1.5" />
      <line x1="14" y1="26" x2="14" y2="36" stroke="#6B6B6B" strokeWidth="1.5" />
      {/* Kitchen area */}
      <rect x="6" y="6" width="12" height="6" rx="0.5" fill="#B0A090" />
      {/* Kitchen counter dots */}
      <circle cx="9" cy="9" r="1.5" fill="#8A7A6A" />
      <circle cx="14" cy="9" r="1.5" fill="#8A7A6A" />
      {/* Bed */}
      <rect x="24" y="8" width="10" height="14" rx="1" fill="#C4B8A8" />
      <ellipse cx="27" cy="11" rx="2" ry="1.5" fill="#DDD" />
      <ellipse cx="31" cy="11" rx="2" ry="1.5" fill="#DDD" />
      {/* Bathroom fixtures */}
      <rect x="6" y="28" width="4" height="6" rx="0.5" fill="#AAA" />
      <circle cx="11" cy="31" r="2" fill="#AAA" />
      {/* Door opening */}
      <rect x="28" y="34" width="6" height="2" fill="#E8E4DF" />
    </svg>
  ),
  // Landmarks
  eiffelTower: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Base square footprint */}
      <rect x="4" y="4" width="32" height="32" rx="1" fill="#D4C4A8" />
      {/* Four corner legs */}
      <rect x="6" y="6" width="6" height="6" rx="1" fill="#8B7355" />
      <rect x="28" y="6" width="6" height="6" rx="1" fill="#8B7355" />
      <rect x="6" y="28" width="6" height="6" rx="1" fill="#8B7355" />
      <rect x="28" y="28" width="6" height="6" rx="1" fill="#8B7355" />
      {/* Cross bracing pattern */}
      <line x1="12" y1="12" x2="28" y2="28" stroke="#8B7355" strokeWidth="2" />
      <line x1="28" y1="12" x2="12" y2="28" stroke="#8B7355" strokeWidth="2" />
      {/* Center point */}
      <circle cx="20" cy="20" r="4" fill="#6B5344" />
    </svg>
  ),
  statueOfLiberty: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Pedestal base */}
      <rect x="4" y="4" width="32" height="32" rx="2" fill="#A8C5A8" />
      {/* Star-shaped fort base */}
      <polygon points="20,6 24,14 33,14 26,20 29,29 20,24 11,29 14,20 7,14 16,14" fill="#4A7C59" />
      {/* Center pedestal */}
      <rect x="14" y="14" width="12" height="12" rx="1" fill="#5A8C69" />
      {/* Statue footprint */}
      <circle cx="20" cy="20" r="4" fill="#3D6B4A" />
    </svg>
  ),
  greatPyramid: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Sand base */}
      <rect x="2" y="2" width="36" height="36" rx="1" fill="#E8D9B5" />
      {/* Pyramid square base */}
      <rect x="4" y="4" width="32" height="32" fill="#D4A84B" stroke="#C49A3B" strokeWidth="1" />
      {/* Diagonal lines showing pyramid edges */}
      <line x1="4" y1="4" x2="36" y2="36" stroke="#B8923A" strokeWidth="1.5" />
      <line x1="36" y1="4" x2="4" y2="36" stroke="#B8923A" strokeWidth="1.5" />
      {/* Center apex point */}
      <circle cx="20" cy="20" r="3" fill="#C49A3B" />
    </svg>
  ),
  tajMahal: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Platform base */}
      <rect x="4" y="4" width="32" height="32" rx="1" fill="#F0EDE8" />
      {/* Main building footprint */}
      <rect x="8" y="8" width="24" height="24" rx="1" fill="#FFFFFF" stroke="#D4D0C8" strokeWidth="1" />
      {/* Four corner minarets */}
      <circle cx="10" cy="10" r="2.5" fill="#F5F5F5" stroke="#C8C4BC" strokeWidth="0.5" />
      <circle cx="30" cy="10" r="2.5" fill="#F5F5F5" stroke="#C8C4BC" strokeWidth="0.5" />
      <circle cx="10" cy="30" r="2.5" fill="#F5F5F5" stroke="#C8C4BC" strokeWidth="0.5" />
      <circle cx="30" cy="30" r="2.5" fill="#F5F5F5" stroke="#C8C4BC" strokeWidth="0.5" />
      {/* Central dome */}
      <circle cx="20" cy="20" r="6" fill="#FAFAFA" stroke="#D4D0C8" strokeWidth="1" />
      <circle cx="20" cy="20" r="2" fill="#E8E4DC" />
    </svg>
  ),
  colosseum: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Outer ellipse */}
      <ellipse cx="20" cy="20" rx="17" ry="14" fill="#C9B896" stroke="#A89878" strokeWidth="1.5" />
      {/* Inner ellipse (arena) */}
      <ellipse cx="20" cy="20" rx="10" ry="7" fill="#D4C4A8" stroke="#B8A888" strokeWidth="1" />
      {/* Arena floor */}
      <ellipse cx="20" cy="20" rx="6" ry="4" fill="#E8D8B8" />
      {/* Archway hints */}
      <ellipse cx="20" cy="20" rx="14" ry="11" fill="none" stroke="#B8A888" strokeWidth="0.5" strokeDasharray="2 2" />
    </svg>
  ),
  bigBen: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Ground area */}
      <rect x="4" y="4" width="32" height="32" rx="1" fill="#D4D0C8" />
      {/* Tower base footprint */}
      <rect x="12" y="12" width="16" height="16" rx="1" fill="#8B7355" stroke="#6B5344" strokeWidth="1" />
      {/* Inner structure */}
      <rect x="15" y="15" width="10" height="10" rx="0.5" fill="#A89070" />
      {/* Clock face hint (center) */}
      <circle cx="20" cy="20" r="4" fill="#F5F0E6" stroke="#8B7355" strokeWidth="1" />
      {/* Clock hands */}
      <line x1="20" y1="20" x2="20" y2="17" stroke="#333" strokeWidth="1" />
      <line x1="20" y1="20" x2="23" y2="20" stroke="#333" strokeWidth="0.8" />
    </svg>
  ),
  // Commercial
  sevenEleven: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Building footprint */}
      <rect x="4" y="6" width="32" height="28" rx="2" fill="#FF7E00" />
      {/* Storefront */}
      <rect x="6" y="8" width="28" height="24" rx="1" fill="#FFFFFF" />
      {/* 7-ELEVEN stripes */}
      <rect x="6" y="8" width="28" height="6" fill="#00703C" />
      <rect x="6" y="14" width="28" height="4" fill="#FF7E00" />
      <rect x="6" y="18" width="28" height="4" fill="#EE2E24" />
      {/* Door */}
      <rect x="16" y="24" width="8" height="8" rx="1" fill="#87CEEB" />
    </svg>
  ),
  mcdonalds: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Building footprint */}
      <rect x="4" y="4" width="32" height="32" rx="2" fill="#DA291C" />
      {/* Roof */}
      <rect x="4" y="4" width="32" height="8" rx="2" fill="#FFC72C" />
      {/* Golden Arches (M) */}
      <path d="M12 28 L12 14 Q12 8 16 14 L20 22 L24 14 Q28 8 28 14 L28 28" stroke="#FFC72C" strokeWidth="3" fill="none" />
      {/* Drive-through lane hint */}
      <rect x="32" y="16" width="6" height="12" fill="#4A4A4A" />
    </svg>
  ),
  gasStation: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Lot */}
      <rect x="2" y="2" width="36" height="36" rx="2" fill="#4A4A4A" />
      {/* Canopy */}
      <rect x="6" y="10" width="20" height="16" rx="1" fill="#E0E0E0" stroke="#999" strokeWidth="1" />
      {/* Fuel pumps */}
      <rect x="10" y="14" width="4" height="8" rx="0.5" fill="#FF0000" />
      <rect x="18" y="14" width="4" height="8" rx="0.5" fill="#FF0000" />
      {/* Convenience store */}
      <rect x="28" y="8" width="10" height="20" rx="1" fill="#FFF" stroke="#999" strokeWidth="1" />
      {/* Parking lines */}
      <line x1="6" y1="32" x2="32" y2="32" stroke="#FFF" strokeWidth="1" strokeDasharray="4 2" />
    </svg>
  ),
  supermarket: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Building footprint */}
      <rect x="2" y="4" width="36" height="32" rx="2" fill="#2E8B57" />
      {/* Storefront */}
      <rect x="4" y="6" width="32" height="28" rx="1" fill="#FFFFFF" />
      {/* Windows */}
      <rect x="6" y="8" width="8" height="6" fill="#87CEEB" />
      <rect x="16" y="8" width="8" height="6" fill="#87CEEB" />
      <rect x="26" y="8" width="8" height="6" fill="#87CEEB" />
      {/* Entrance */}
      <rect x="14" y="22" width="12" height="10" rx="1" fill="#333" />
      {/* Shopping cart symbol */}
      <circle cx="20" cy="27" r="3" fill="none" stroke="#FFF" strokeWidth="1" />
    </svg>
  ),
  starbucks: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Building footprint */}
      <rect x="6" y="6" width="28" height="28" rx="2" fill="#00704A" />
      {/* Inner area */}
      <rect x="8" y="8" width="24" height="24" rx="1" fill="#1E3932" />
      {/* Siren logo circle */}
      <circle cx="20" cy="20" r="8" fill="#00704A" stroke="#FFF" strokeWidth="1" />
      {/* Simplified siren */}
      <circle cx="20" cy="20" r="5" fill="#1E3932" />
      <circle cx="20" cy="18" r="2" fill="#00704A" />
    </svg>
  ),
  walmart: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Building footprint */}
      <rect x="2" y="2" width="36" height="36" rx="2" fill="#0071CE" />
      {/* Storefront */}
      <rect x="4" y="4" width="32" height="32" rx="1" fill="#FFF" />
      {/* Walmart spark */}
      <circle cx="20" cy="20" r="8" fill="#FFC220" />
      {/* Spark lines */}
      <line x1="20" y1="10" x2="20" y2="14" stroke="#FFC220" strokeWidth="2" />
      <line x1="20" y1="26" x2="20" y2="30" stroke="#FFC220" strokeWidth="2" />
      <line x1="10" y1="20" x2="14" y2="20" stroke="#FFC220" strokeWidth="2" />
      <line x1="26" y1="20" x2="30" y2="20" stroke="#FFC220" strokeWidth="2" />
      {/* Entrance hint */}
      <rect x="16" y="30" width="8" height="4" fill="#0071CE" />
    </svg>
  ),
  // Gaming
  pokemonCenter: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Building */}
      <rect x="4" y="4" width="32" height="32" rx="3" fill="#EE1515" />
      {/* White center section */}
      <rect x="8" y="12" width="24" height="16" rx="2" fill="#FFFFFF" />
      {/* Pokeball design */}
      <circle cx="20" cy="20" r="8" fill="none" stroke="#333" strokeWidth="2" />
      <line x1="12" y1="20" x2="28" y2="20" stroke="#333" strokeWidth="2" />
      <circle cx="20" cy="20" r="3" fill="#FFF" stroke="#333" strokeWidth="2" />
      {/* Roof */}
      <rect x="2" y="4" width="36" height="6" rx="2" fill="#CC0000" />
    </svg>
  ),
  minecraftHouse: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Dirt/wood base */}
      <rect x="4" y="4" width="32" height="32" fill="#8B6914" />
      {/* Planks pattern */}
      <rect x="4" y="4" width="32" height="8" fill="#A0782C" />
      <rect x="4" y="20" width="32" height="8" fill="#A0782C" />
      {/* Door */}
      <rect x="16" y="22" width="8" height="14" fill="#5C4033" />
      {/* Window */}
      <rect x="8" y="10" width="6" height="6" fill="#87CEEB" stroke="#5C4033" strokeWidth="1" />
      <rect x="26" y="10" width="6" height="6" fill="#87CEEB" stroke="#5C4033" strokeWidth="1" />
      {/* Blocky outline */}
      <rect x="4" y="4" width="32" height="32" fill="none" stroke="#5C4033" strokeWidth="2" />
    </svg>
  ),
  acHouse: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Grass */}
      <rect x="2" y="2" width="36" height="36" rx="2" fill="#90EE90" />
      {/* House base */}
      <rect x="8" y="12" width="24" height="20" rx="2" fill="#F5DEB3" />
      {/* Cute roof */}
      <polygon points="6,14 20,4 34,14" fill="#8B4513" />
      {/* Door */}
      <rect x="16" y="20" width="8" height="12" rx="1" fill="#DEB887" />
      <circle cx="22" cy="26" r="1" fill="#FFD700" />
      {/* Windows */}
      <rect x="10" y="16" width="4" height="4" rx="1" fill="#87CEEB" />
      <rect x="26" y="16" width="4" height="4" rx="1" fill="#87CEEB" />
    </svg>
  ),
  fortnite1x1: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Base platform */}
      <rect x="4" y="4" width="32" height="32" fill="#5B7FDE" stroke="#4A6BC9" strokeWidth="2" />
      {/* Grid pattern */}
      <line x1="4" y1="20" x2="36" y2="20" stroke="#4A6BC9" strokeWidth="1" />
      <line x1="20" y1="4" x2="20" y2="36" stroke="#4A6BC9" strokeWidth="1" />
      {/* Wall indicators */}
      <rect x="6" y="6" width="12" height="12" fill="none" stroke="#FFF" strokeWidth="1" strokeDasharray="2 2" />
      <rect x="22" y="6" width="12" height="12" fill="none" stroke="#FFF" strokeWidth="1" strokeDasharray="2 2" />
      <rect x="6" y="22" width="12" height="12" fill="none" stroke="#FFF" strokeWidth="1" strokeDasharray="2 2" />
      <rect x="22" y="22" width="12" height="12" fill="none" stroke="#FFF" strokeWidth="1" strokeDasharray="2 2" />
      {/* Build icon hint */}
      <polygon points="20,12 16,18 24,18" fill="#FFF" />
    </svg>
  ),
  zeldaHouse: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Grass/ground */}
      <rect x="2" y="2" width="36" height="36" rx="2" fill="#228B22" />
      {/* House base - Hyrule style */}
      <rect x="6" y="14" width="28" height="20" rx="1" fill="#8B7355" />
      {/* Thatched roof */}
      <polygon points="4,16 20,4 36,16" fill="#DAA520" />
      <polygon points="6,16 20,6 34,16" fill="#B8860B" />
      {/* Round door (Hobbit-like) */}
      <circle cx="20" cy="26" r="5" fill="#5C4033" />
      <circle cx="20" cy="26" r="4" fill="#4A3728" />
      {/* Window */}
      <rect x="28" y="18" width="4" height="4" fill="#FFD700" />
    </svg>
  ),
  simsHouse: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Lot */}
      <rect x="2" y="2" width="36" height="36" rx="2" fill="#7CCD7C" />
      {/* House footprint */}
      <rect x="6" y="10" width="28" height="24" rx="1" fill="#FFF" stroke="#CCC" strokeWidth="1" />
      {/* Roof */}
      <polygon points="4,12 20,2 36,12" fill="#8B0000" />
      {/* Green plumbob */}
      <polygon points="20,6 17,12 23,12" fill="#32CD32" />
      <polygon points="20,14 17,12 23,12" fill="#228B22" />
      {/* Door */}
      <rect x="17" y="24" width="6" height="10" fill="#8B4513" />
      {/* Windows */}
      <rect x="8" y="16" width="6" height="6" fill="#87CEEB" />
      <rect x="26" y="16" width="6" height="6" fill="#87CEEB" />
    </svg>
  ),
}

// Icon components
const Icons = {
  trophy: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
    </svg>
  ),
  building: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  ),
  truck: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  ),
  shapes: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  landmark: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
  ),
  store: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
    </svg>
  ),
  gamepad: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
    </svg>
  ),
}

// Grid size options
const GRID_SIZES = [
  { value: 0.5, label: '0.5m' },
  { value: 1, label: '1m' },
  { value: 2, label: '2m' },
  { value: 5, label: '5m' },
]

export default function ComparePanel({
  comparisonObjects,
  activeComparisons,
  toggleComparison,
  landArea = 0,
  lengthUnit = 'm',
  onClosePanel,
  onExpandedChange,
  isActive,
  gridSnapEnabled = false,
  setGridSnapEnabled,
  gridSize = 1,
  setGridSize,
  comparisonRotations = {},
  onRotationChange,
  onResetTransform,
}) {
  const { isPaidUser, setShowPricingModal } = useUser()
  const [activeCategory, setActiveCategory] = useState('sports')

  // Check if object is available for free users
  const isObjectFree = (objId) => FREE_OBJECTS.includes(objId)

  // Handle toggle with Pro check
  const handleToggle = (objId) => {
    if (!isObjectFree(objId) && !isPaidUser) {
      setShowPricingModal(true)
      return
    }
    toggleComparison(objId)
  }

  // Report expanded state when becoming active or when category changes
  useEffect(() => {
    if (isActive) {
      onExpandedChange?.(activeCategory !== null)
    }
  }, [activeCategory, onExpandedChange, isActive])

  // Handle category click
  const handleCategoryClick = (categoryId) => {
    if (activeCategory === categoryId) {
      setActiveCategory(null)
    } else {
      setActiveCategory(categoryId)
    }
  }

  // Get objects for current category
  const categoryObjects = comparisonObjects.filter(
    obj => OBJECT_CATEGORIES[obj.id] === activeCategory
  )

  // Count active comparisons per category
  const getCategoryCount = (categoryId) => {
    return comparisonObjects.filter(
      obj => OBJECT_CATEGORIES[obj.id] === categoryId && activeComparisons[obj.id]
    ).length
  }

  // Get current category data
  const currentCategory = CATEGORIES.find(c => c.id === activeCategory)

  return (
    <div className="h-full flex text-white">
      {/* Icon Rail */}
      <div className="icon-rail">
        {CATEGORIES.map(category => {
          const count = getCategoryCount(category.id)
          return (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              className={`icon-rail-btn ${activeCategory === category.id ? 'active' : ''}`}
            >
              {Icons[category.icon]}
              {count > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[var(--color-accent)] rounded-full text-[10px] font-bold flex items-center justify-center text-[var(--color-bg-primary)]">
                  {count}
                </span>
              )}
              <span className="tooltip">{category.label}</span>
            </button>
          )
        })}
      </div>

      {/* Expanded Panel */}
      <div className={`expanded-panel ${activeCategory ? 'open' : ''}`}>
        <div className="expanded-panel-content">
          {/* Settings Row - Grid Snap */}
          <div className="px-4 py-3 border-b border-[var(--color-border)] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                <span className="text-[var(--color-text-secondary)] text-xs">Snap to Grid</span>
              </div>
              <button
                onClick={() => setGridSnapEnabled?.(!gridSnapEnabled)}
                className={`toggle-switch ${gridSnapEnabled ? 'active' : ''}`}
                aria-pressed={gridSnapEnabled}
              >
                <span className="toggle-knob" />
              </button>
            </div>
            {gridSnapEnabled && (
              <div className="flex items-center gap-2 pl-6">
                <span className="text-[var(--color-text-muted)] text-[11px]">Size:</span>
                <div className="flex gap-1">
                  {GRID_SIZES.map(size => (
                    <button
                      key={size.value}
                      onClick={() => setGridSize?.(size.value)}
                      className={`px-2 py-0.5 text-[11px] rounded ${
                        gridSize === size.value
                          ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                          : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-white/10'
                      }`}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Panel Header */}
          {currentCategory && (
            <div className="flex items-center px-4 py-3 border-b border-[var(--color-border)]">
              <h2 className="font-display font-semibold text-sm">{currentCategory.label}</h2>
            </div>
          )}

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-2">
              {categoryObjects.map(obj => {
                const fitInfo = getFitInfo(landArea, obj.width, obj.length)

                const isPremium = !isObjectFree(obj.id)

                return (
                  <div key={obj.id} className="space-y-0">
                  <button
                    onClick={() => handleToggle(obj.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                      activeComparisons[obj.id]
                        ? 'bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 rounded-t-xl border-b-0'
                        : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:bg-white/10 rounded-xl'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Thumbnail */}
                      <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden bg-black/20 hover:scale-105 transition-transform">
                        {Thumbnails[obj.id] || (
                          <div className="w-full h-full" style={{ backgroundColor: obj.color }} />
                        )}
                      </div>
                      <div className="text-left">
                        <div className={`text-sm font-medium flex items-center gap-1.5 ${
                          activeComparisons[obj.id] ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'
                        }`}>
                          {obj.name}
                          {isPremium && !isPaidUser && (
                            <span className="px-1 py-0.5 text-[9px] font-bold bg-amber-500 text-black rounded">PRO</span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--color-text-muted)]">
                          {obj.width}m × {obj.length}m
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Fit count badge */}
                      {fitInfo.type !== 'none' && (
                        <div className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          fitInfo.type === 'fit'
                            ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                            : 'bg-white/10 text-[var(--color-text-muted)]'
                        }`}>
                          {fitInfo.type === 'fit' ? (
                            <span>{fitInfo.text} fit</span>
                          ) : (
                            <span>= {fitInfo.text}</span>
                          )}
                        </div>
                      )}

                      {/* Toggle checkbox */}
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        activeComparisons[obj.id]
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                          : 'border-[var(--color-text-muted)]'
                      }`}>
                        {activeComparisons[obj.id] && (
                          <svg className="w-3 h-3 text-[var(--color-bg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Rotation controls - show when object is active */}
                  {activeComparisons[obj.id] && (
                    <div
                      className="flex items-center gap-2 px-3 py-2 bg-[var(--color-accent)]/10 rounded-b-xl border border-[var(--color-accent)]/30 border-t-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[var(--color-text-muted)] text-[11px]">Rotate:</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onRotationChange?.(obj.id, ((comparisonRotations[obj.id] || 0) - 45 + 360) % 360)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-[var(--color-bg-secondary)] hover:bg-white/10 text-[var(--color-text-secondary)] text-sm"
                          title="Rotate -45°"
                        >
                          ↺
                        </button>
                        <input
                          type="number"
                          value={Math.round(comparisonRotations[obj.id] || 0)}
                          onChange={(e) => onRotationChange?.(obj.id, (parseFloat(e.target.value) || 0) % 360)}
                          className="w-12 h-6 text-center text-[11px] rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-[var(--color-text-muted)] text-[11px]">°</span>
                        <button
                          onClick={() => onRotationChange?.(obj.id, ((comparisonRotations[obj.id] || 0) + 45) % 360)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-[var(--color-bg-secondary)] hover:bg-white/10 text-[var(--color-text-secondary)] text-sm"
                          title="Rotate +45°"
                        >
                          ↻
                        </button>
                      </div>
                      <button
                        onClick={() => onResetTransform?.(obj.id)}
                        className="ml-auto px-2 py-1 text-[10px] rounded bg-[var(--color-bg-secondary)] hover:bg-white/10 text-[var(--color-text-muted)]"
                        title="Reset position and rotation"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                  </div>
                )
              })}

              {categoryObjects.length === 0 && (
                <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">
                  No objects in this category
                </div>
              )}
            </div>
          </div>

          {/* Footer - active count */}
          {currentCategory && (
            <div className="px-4 py-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
              {Object.values(activeComparisons).filter(Boolean).length} comparison{Object.values(activeComparisons).filter(Boolean).length !== 1 ? 's' : ''} active
            </div>
          )}
        </div>
      </div>

      {/* Collapse bar with arrow - at end of expanded panel */}
      {activeCategory && (
        <button
          onClick={() => setActiveCategory(null)}
          className="w-4 h-full flex items-center justify-center bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer border-l border-[var(--color-border)]"
        >
          <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
    </div>
  )
}
