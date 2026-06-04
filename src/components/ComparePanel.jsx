import { useState, useEffect } from 'react'
import { useUser } from '../hooks/useUser'

// Free comparison objects (available to all users)
const FREE_OBJECTS = ['house', 'carSedan', 'parkingSpace', 'soccerField', 'basketballCourt', 'tennisCourt', 'swimmingPool', 'boxingRing', 'volleyballCourt', 'footballField', 'padelCourt', 'eiffelTower', 'statueOfLiberty', 'greatPyramid', 'tajMahal', 'colosseum', 'bigBen', 'pokemonCenter', 'minecraftHouse', 'acHouse', 'fortnite1x1', 'zeldaHouse', 'simsHouse', 'mediumHouse', 'largeHouse', 'shed', 'garage', 'barn', 'workshop', 'greenhouse', 'gazebo', 'carport', 'fordF150', 'semiTruck', 'fireTruck', 'suv', 'gtaHouse', 'stardewFarm', 'haloWarthog', 'amongUsShip', 'olympicTrack', 'helipad', 'rooftopTerrace']

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
  mediumHouse: 'buildings',
  largeHouse: 'buildings',
  shed: 'buildings',
  garage: 'buildings',
  barn: 'buildings',
  workshop: 'buildings',
  greenhouse: 'buildings',
  gazebo: 'buildings',
  carport: 'buildings',
  carSedan: 'vehicles',
  shippingContainer: 'vehicles',
  schoolBus: 'vehicles',
  fordF150: 'vehicles',
  semiTruck: 'vehicles',
  fireTruck: 'vehicles',
  suv: 'vehicles',
  parkingSpace: 'other',
  swimmingPool: 'sports',
  boxingRing: 'sports',
  volleyballCourt: 'sports',
  footballField: 'sports',
  padelCourt: 'sports',
  kingSizeBed: 'other',
  gtaHouse: 'gaming',
  stardewFarm: 'gaming',
  haloWarthog: 'gaming',
  amongUsShip: 'gaming',
  olympicTrack: 'other',
  helipad: 'other',
  rooftopTerrace: 'other',
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
  boxingRing: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Arena floor */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#2A2A2A" />
      {/* Ring apron */}
      <rect x="5" y="5" width="30" height="30" rx="1" fill="#1A3A6A" />
      {/* Canvas */}
      <rect x="8" y="8" width="24" height="24" rx="0.5" fill="#E8E0D0" />
      {/* Corner pads */}
      <rect x="7" y="7" width="4" height="4" rx="0.5" fill="#C0392B" />
      <rect x="29" y="7" width="4" height="4" rx="0.5" fill="#2980B9" />
      <rect x="7" y="29" width="4" height="4" rx="0.5" fill="#ECF0F1" />
      <rect x="29" y="29" width="4" height="4" rx="0.5" fill="#ECF0F1" />
      {/* Ropes */}
      <rect x="8" y="8" width="24" height="24" rx="0.5" fill="none" stroke="#C8B898" strokeWidth="0.6" />
      <rect x="7.5" y="7.5" width="25" height="25" rx="0.5" fill="none" stroke="#C8B898" strokeWidth="0.5" />
      <rect x="7" y="7" width="26" height="26" rx="0.5" fill="none" stroke="#C8B898" strokeWidth="0.4" />
    </svg>
  ),
  volleyballCourt: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Court background */}
      <rect x="2" y="4" width="36" height="32" rx="1" fill="#E67E22" />
      {/* Boundary */}
      <rect x="4" y="6" width="32" height="28" fill="none" stroke="white" strokeWidth="0.8" />
      {/* Center/net line */}
      <line x1="20" y1="6" x2="20" y2="34" stroke="white" strokeWidth="1.2" />
      {/* Attack lines (3m lines) */}
      <line x1="14" y1="6" x2="14" y2="34" stroke="white" strokeWidth="0.6" strokeDasharray="2 1" />
      <line x1="26" y1="6" x2="26" y2="34" stroke="white" strokeWidth="0.6" strokeDasharray="2 1" />
      {/* Net posts */}
      <circle cx="20" cy="5" r="1" fill="#555" />
      <circle cx="20" cy="35" r="1" fill="#555" />
      {/* Net hint */}
      <line x1="20" y1="6" x2="20" y2="34" stroke="#DDD" strokeWidth="0.3" strokeDasharray="1 1" />
    </svg>
  ),
  footballField: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Field */}
      <rect x="1" y="4" width="38" height="32" rx="1" fill="#2E7D32" />
      {/* End zones */}
      <rect x="1" y="4" width="4" height="32" fill="#1B5E20" />
      <rect x="35" y="4" width="4" height="32" fill="#1B5E20" />
      {/* Yard lines */}
      {[7, 10, 13, 16, 19, 22, 25, 28, 31].map((x, i) => (
        <line key={`yl-${i}`} x1={x} y1="4" x2={x} y2="36" stroke="white" strokeWidth="0.4" />
      ))}
      {/* 50-yard line */}
      <line x1="19" y1="4" x2="19" y2="36" stroke="white" strokeWidth="0.8" />
      {/* Hash marks */}
      {[7, 10, 13, 16, 19, 22, 25, 28, 31].map((x, i) => (
        <line key={`hm-${i}`} x1={x} y1="18" x2={x} y2="22" stroke="white" strokeWidth="0.3" />
      ))}
      {/* Goal line borders */}
      <line x1="5" y1="4" x2="5" y2="36" stroke="white" strokeWidth="0.6" />
      <line x1="35" y1="4" x2="35" y2="36" stroke="white" strokeWidth="0.6" />
      {/* Field numbers hint */}
      <text x="10" y="22" textAnchor="middle" fill="white" fontSize="3" opacity="0.6">20</text>
      <text x="19" y="22" textAnchor="middle" fill="white" fontSize="3" opacity="0.6">50</text>
      <text x="28" y="22" textAnchor="middle" fill="white" fontSize="3" opacity="0.6">20</text>
    </svg>
  ),
  padelCourt: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Court surface - blue */}
      <rect x="4" y="2" width="32" height="36" rx="1" fill="#1565C0" />
      {/* Wall enclosure */}
      <rect x="4" y="2" width="32" height="36" rx="1" fill="none" stroke="#90A4AE" strokeWidth="1.5" />
      {/* Glass back walls - thicker */}
      <rect x="4" y="2" width="32" height="2" fill="#B0BEC5" />
      <rect x="4" y="36" width="32" height="2" fill="#B0BEC5" />
      {/* Net / center line */}
      <line x1="4" y1="20" x2="36" y2="20" stroke="white" strokeWidth="1" />
      {/* Service lines */}
      <line x1="4" y1="10" x2="36" y2="10" stroke="white" strokeWidth="0.5" />
      <line x1="4" y1="30" x2="36" y2="30" stroke="white" strokeWidth="0.5" />
      {/* Center service lines */}
      <line x1="20" y1="10" x2="20" y2="20" stroke="white" strokeWidth="0.5" />
      <line x1="20" y1="20" x2="20" y2="30" stroke="white" strokeWidth="0.5" />
      {/* Side wall mesh pattern hint */}
      <line x1="4" y1="8" x2="4" y2="32" stroke="#78909C" strokeWidth="0.4" strokeDasharray="1 1" />
      <line x1="36" y1="8" x2="36" y2="32" stroke="#78909C" strokeWidth="0.4" strokeDasharray="1 1" />
    </svg>
  ),
  carSedan: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Road */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#4A4A48" />
      {/* Car body - side view */}
      <rect x="3" y="20" width="34" height="10" rx="2" fill="#4A90D9" />
      {/* Cabin */}
      <path d="M12,20 L16,12 L28,12 L32,20" fill="#3A7BC8" />
      {/* Windshield */}
      <path d="M16.5,12.5 L13,19.5 L19,19.5 L16.5,12.5" fill="#8AB8D8" />
      {/* Rear window */}
      <path d="M27.5,12.5 L31,19.5 L25,19.5 L27.5,12.5" fill="#8AB8D8" />
      {/* Side windows */}
      <rect x="19.5" y="13" width="5" height="6.5" rx="0.5" fill="#8AB8D8" />
      {/* Door line */}
      <line x1="19" y1="12.5" x2="19" y2="29" stroke="#3A7BC8" strokeWidth="0.4" />
      {/* Headlight */}
      <rect x="35" y="22" width="2" height="2" rx="0.5" fill="#F0E060" />
      {/* Taillight */}
      <rect x="3" y="22" width="1.5" height="2" rx="0.3" fill="#CC3030" />
      {/* Wheels */}
      <circle cx="11" cy="30" r="3.5" fill="#222" />
      <circle cx="11" cy="30" r="1.5" fill="#555" />
      <circle cx="29" cy="30" r="3.5" fill="#222" />
      <circle cx="29" cy="30" r="1.5" fill="#555" />
      {/* Ground shadow */}
      <ellipse cx="20" cy="34" rx="15" ry="1.5" fill="#333" opacity="0.3" />
    </svg>
  ),
  shippingContainer: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Ground */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#C0B8B0" />
      {/* Container body - side view */}
      <rect x="3" y="10" width="34" height="20" rx="1" fill="#D35400" />
      {/* Corrugated lines */}
      {[12, 14, 16, 18, 20, 22, 24, 26, 28].map((y, i) => (
        <line key={`c-${i}`} x1="5" y1={y} x2="35" y2={y} stroke="#C04800" strokeWidth="0.6" />
      ))}
      {/* Corner posts */}
      <rect x="3" y="10" width="2" height="20" fill="#B34700" />
      <rect x="35" y="10" width="2" height="20" fill="#B34700" />
      {/* Top rail */}
      <rect x="3" y="10" width="34" height="2" fill="#B34700" />
      {/* Bottom rail */}
      <rect x="3" y="28" width="34" height="2" fill="#B34700" />
      {/* Door end bars */}
      <rect x="34" y="12" width="1" height="16" fill="#E06020" />
      <rect x="36" y="12" width="0.6" height="4" fill="#A04000" />
      <rect x="36" y="18" width="0.6" height="4" fill="#A04000" />
      {/* Ground line */}
      <rect x="2" y="30" width="36" height="2" fill="#A8A098" />
    </svg>
  ),
  schoolBus: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Road */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#4A4A48" />
      {/* Bus body - side view */}
      <rect x="2" y="14" width="36" height="16" rx="2" fill="#FFB800" />
      {/* Roof */}
      <rect x="2" y="12" width="36" height="4" rx="1" fill="#E5A500" />
      {/* Black bumper stripe */}
      <rect x="2" y="28" width="36" height="2" fill="#222" />
      {/* Hood */}
      <rect x="32" y="16" width="6" height="12" rx="1" fill="#E5A500" />
      {/* Windshield */}
      <rect x="30" y="14" width="4" height="10" rx="0.5" fill="#8AB8D8" />
      {/* Windows - row */}
      <rect x="4" y="16" width="4" height="6" rx="0.5" fill="#8AB8D8" />
      <rect x="10" y="16" width="4" height="6" rx="0.5" fill="#8AB8D8" />
      <rect x="16" y="16" width="4" height="6" rx="0.5" fill="#8AB8D8" />
      <rect x="22" y="16" width="4" height="6" rx="0.5" fill="#8AB8D8" />
      {/* STOP sign arm hint */}
      <rect x="0" y="18" width="3" height="2" rx="0.3" fill="#CC2020" />
      {/* Headlight */}
      <circle cx="37" cy="22" r="1.2" fill="#F0E060" />
      {/* Wheels */}
      <circle cx="9" cy="31" r="3" fill="#222" />
      <circle cx="9" cy="31" r="1.2" fill="#555" />
      <circle cx="31" cy="31" r="3" fill="#222" />
      <circle cx="31" cy="31" r="1.2" fill="#555" />
      {/* Ground shadow */}
      <ellipse cx="20" cy="35" rx="16" ry="1.5" fill="#333" opacity="0.3" />
    </svg>
  ),
  fordF150: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#4A4A48" />
      <rect x="3" y="18" width="34" height="10" rx="2" fill="#1A3A6A" />
      <rect x="8" y="14" width="16" height="6" rx="1" fill="#1A3A6A" />
      <rect x="25" y="18" width="10" height="5" rx="1" fill="#142D55" />
      <rect x="10" y="15" width="6" height="4" rx="0.5" fill="#87CEEB" />
      <rect x="17" y="15" width="5" height="4" rx="0.5" fill="#87CEEB" />
      <circle cx="11" cy="29" r="3.5" fill="#222" /><circle cx="11" cy="29" r="1.5" fill="#888" />
      <circle cx="29" cy="29" r="3.5" fill="#222" /><circle cx="29" cy="29" r="1.5" fill="#888" />
      <rect x="34" y="21" width="2" height="2" rx="0.3" fill="#FFFF88" />
      <rect x="3" y="21" width="2" height="2" rx="0.3" fill="#CC3030" />
      <rect x="3" y="17" width="34" height="2" fill="#C8C8C8" />
    </svg>
  ),
  semiTruck: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#4A4A48" />
      <rect x="3" y="18" width="26" height="12" rx="1" fill="#F0F0F0" />
      <rect x="29" y="12" width="8" height="18" rx="1" fill="#C8392B" />
      <rect x="30" y="13" width="6" height="6" rx="0.5" fill="#87CEEB" />
      <rect x="30" y="10" width="6" height="3" rx="0.5" fill="#C04020" />
      <rect x="31" y="9" width="1.5" height="4" fill="#C0C0C0" />
      <rect x="34" y="9" width="1.5" height="4" fill="#C0C0C0" />
      <rect x="27" y="18" width="2" height="12" fill="#C8C8C8" />
      <circle cx="8" cy="31" r="3" fill="#222" /><circle cx="8" cy="31" r="1.2" fill="#666" />
      <circle cx="16" cy="31" r="3" fill="#222" /><circle cx="16" cy="31" r="1.2" fill="#666" />
      <circle cx="33" cy="31" r="3" fill="#222" /><circle cx="33" cy="31" r="1.2" fill="#666" />
    </svg>
  ),
  fireTruck: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#4A4A48" />
      <rect x="3" y="17" width="34" height="12" rx="1" fill="#CC1111" />
      <rect x="3" y="13" width="12" height="6" rx="1" fill="#CC1111" />
      <rect x="4" y="14" width="5" height="4" rx="0.5" fill="#87CEEB" />
      <rect x="3" y="11" width="34" height="2.5" rx="0.5" fill="#1A1A1A" />
      <rect x="5" y="10" width="3" height="1.5" fill="#FF2222" />
      <rect x="9" y="10" width="3" height="1.5" fill="#2244FF" />
      <rect x="13" y="10" width="3" height="1.5" fill="#FF2222" />
      <rect x="3" y="15" width="34" height="1" fill="#FFD700" />
      <rect x="35" y="20" width="2" height="2" rx="0.3" fill="#FFFFAA" />
      <rect x="3" y="20" width="2" height="2" rx="0.3" fill="#FF3333" />
      <rect x="8" y="13" width="24" height="3" rx="0.5" fill="#888" />
      <circle cx="10" cy="30" r="3.5" fill="#222" /><circle cx="10" cy="30" r="1.5" fill="#666" />
      <circle cx="30" cy="30" r="3.5" fill="#222" /><circle cx="30" cy="30" r="1.5" fill="#666" />
    </svg>
  ),
  suv: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#4A4A48" />
      <rect x="3" y="20" width="34" height="10" rx="2" fill="#1A2B1A" />
      <rect x="5" y="13" width="30" height="9" rx="2" fill="#1A2B1A" />
      <rect x="7" y="14" width="10" height="6" rx="0.5" fill="#87CEEB" />
      <rect x="18" y="14" width="8" height="6" rx="0.5" fill="#87CEEB" />
      <rect x="3" y="11" width="34" height="3" rx="1" fill="#888" />
      <rect x="5" y="10" width="30" height="2" rx="0.5" fill="#C0C0C0" />
      <rect x="35" y="22" width="2" height="2" rx="0.3" fill="#FFFFAA" />
      <rect x="3" y="22" width="2" height="2" rx="0.3" fill="#FF3333" />
      <circle cx="10" cy="31" r="3.5" fill="#222" /><circle cx="10" cy="31" r="1.5" fill="#888" />
      <circle cx="30" cy="31" r="3.5" fill="#222" /><circle cx="30" cy="31" r="1.5" fill="#888" />
      <ellipse cx="10" cy="31" rx="5" ry="2" fill="none" stroke="#243824" strokeWidth="0.6" />
      <ellipse cx="30" cy="31" rx="5" ry="2" fill="none" stroke="#243824" strokeWidth="0.6" />
    </svg>
  ),

  gtaHouse: (
    <svg viewBox='0 0 40 40' className='w-10 h-10'>
      <rect x='2' y='2' width='36' height='36' rx='2' fill='#D4C4A0'/>
      <rect x='4' y='18' width='32' height='18' fill='#C8B890'/>
      <polygon points='4,18 20,6 36,18' fill='#8B3A2A'/>
      <rect x='14' y='24' width='6' height='12' fill='#5a3010'/>
      <rect x='6' y='22' width='7' height='6' fill='#87CEEB' opacity='0.7'/>
      <rect x='27' y='22' width='7' height='6' fill='#87CEEB' opacity='0.7'/>
      <rect x='24' y='20' width='12' height='16' fill='#b8a878'/>
      <rect x='26' y='22' width='8' height='8' fill='#888'/>
    </svg>
  ),
  stardewFarm: (
    <svg viewBox='0 0 40 40' className='w-10 h-10'>
      <rect x='2' y='2' width='36' height='36' rx='2' fill='#5A9A3A'/>
      <rect x='4' y='10' width='32' height='22' rx='1' fill='#6B4226'/>
      <rect x='6' y='10' width='3' height='22' fill='#7a5a36'/>
      <rect x='11' y='10' width='3' height='22' fill='#7a5a36'/>
      <rect x='16' y='10' width='3' height='22' fill='#7a5a36'/>
      <rect x='21' y='10' width='3' height='22' fill='#7a5a36'/>
      <rect x='26' y='10' width='3' height='22' fill='#7a5a36'/>
      <rect x='31' y='10' width='3' height='22' fill='#7a5a36'/>
      <circle cx='7' cy='14' r='1.2' fill='#2d8a2d'/>
      <circle cx='12' cy='18' r='1.2' fill='#3aaa3a'/>
      <circle cx='17' cy='13' r='1.2' fill='#2d8a2d'/>
      <rect x='4' y='4' width='10' height='8' rx='1' fill='#8B2020'/>
      <polygon points='4,4 9,1 14,4' fill='#5a1010'/>
    </svg>
  ),
  haloWarthog: (
    <svg viewBox='0 0 40 40' className='w-10 h-10'>
      <rect x='2' y='2' width='36' height='36' rx='2' fill='#4a5a3a'/>
      <rect x='5' y='15' width='30' height='12' rx='2' fill='#5a6a4a'/>
      <rect x='8' y='10' width='20' height='8' rx='1' fill='#4a5a3a'/>
      <rect x='10' y='11' width='8' height='5' rx='0.5' fill='#87CEEB' opacity='0.5'/>
      <rect x='6' y='8' width='2' height='6' fill='#333'/>
      <rect x='32' y='8' width='2' height='6' fill='#333'/>
      <rect x='6' y='8' width='28' height='2' fill='#333'/>
      <rect x='28' y='12' width='4' height='8' rx='1' fill='#3a4a2a'/>
      <rect x='29' y='8' width='2' height='8' rx='0.5' fill='#222' transform='rotate(-15,30,12)'/>
      <circle cx='9' cy='30' r='4' fill='#222'/><circle cx='9' cy='30' r='2' fill='#555'/>
      <circle cx='31' cy='30' r='4' fill='#222'/><circle cx='31' cy='30' r='2' fill='#555'/>
    </svg>
  ),
  amongUsShip: (
    <svg viewBox='0 0 40 40' className='w-10 h-10'>
      <rect x='2' y='2' width='36' height='36' rx='2' fill='#1a1a2a'/>
      <rect x='4' y='4' width='32' height='32' rx='1' fill='#2a2a3a' opacity='0.9'/>
      <rect x='14' y='12' width='12' height='10' rx='1' fill='#1a3a5a'/>
      <circle cx='10' cy='20' r='5' fill='#1a2a4a'/>
      <circle cx='10' cy='20' r='2' fill='#00ffcc' opacity='0.8'/>
      <rect x='24' y='22' width='8' height='7' rx='1' fill='#1a3a2a'/>
      <rect x='26' y='23' width='2' height='2' fill='#ff4444'/>
      <rect x='15' y='28' width='10' height='6' rx='1' fill='#3a2a1a'/>
      <line x1='4' y1='20' x2='36' y2='20' stroke='#ff4444' strokeWidth='0.5' opacity='0.4'/>
      <circle cx='20' cy='8' r='1' fill='#00ff88' opacity='0.8'/>
      <circle cx='28' cy='14' r='0.8' fill='#ff4444' opacity='0.8'/>
    </svg>
  ),
  olympicTrack: (
    <svg viewBox='0 0 40 40' className='w-10 h-10'>
      <rect x='2' y='2' width='36' height='36' rx='2' fill='#C84820'/>
      <ellipse cx='20' cy='20' rx='14' ry='12' fill='#3a8a3a'/>
      <ellipse cx='20' cy='20' rx='14' ry='12' fill='none' stroke='white' strokeWidth='1.5'/>
      <ellipse cx='20' cy='20' rx='11' ry='9' fill='none' stroke='white' strokeWidth='0.8'/>
      <ellipse cx='20' cy='20' rx='8' ry='6.5' fill='none' stroke='white' strokeWidth='0.8'/>
      <ellipse cx='20' cy='20' rx='5' ry='4' fill='none' stroke='white' strokeWidth='0.8'/>
      <line x1='20' y1='8' x2='20' y2='32' stroke='white' strokeWidth='0.5' opacity='0.5'/>
    </svg>
  ),
  helipad: (
    <svg viewBox='0 0 40 40' className='w-10 h-10'>
      <rect x='2' y='2' width='36' height='36' rx='2' fill='#707070'/>
      <circle cx='20' cy='20' r='16' fill='none' stroke='#f5c842' strokeWidth='2.5'/>
      <rect x='13' y='13' width='4' height='14' fill='white'/>
      <rect x='23' y='13' width='4' height='14' fill='white'/>
      <rect x='13' y='18' width='14' height='4' fill='white'/>
      <circle cx='8' cy='8' r='2' fill='#ff8800' opacity='0.8'/>
      <circle cx='32' cy='8' r='2' fill='#ff8800' opacity='0.8'/>
      <circle cx='8' cy='32' r='2' fill='#ff8800' opacity='0.8'/>
      <circle cx='32' cy='32' r='2' fill='#ff8800' opacity='0.8'/>
    </svg>
  ),
  rooftopTerrace: (
    <svg viewBox='0 0 40 40' className='w-10 h-10'>
      <rect x='2' y='2' width='36' height='36' rx='2' fill='#A07848'/>
      <line x1='4' y1='8' x2='36' y2='8' stroke='#886030' strokeWidth='1'/>
      <line x1='4' y1='14' x2='36' y2='14' stroke='#886030' strokeWidth='1'/>
      <line x1='4' y1='20' x2='36' y2='20' stroke='#886030' strokeWidth='1'/>
      <line x1='4' y1='26' x2='36' y2='26' stroke='#886030' strokeWidth='1'/>
      <line x1='4' y1='32' x2='36' y2='32' stroke='#886030' strokeWidth='1'/>
      <rect x='6' y='4' width='2' height='32' fill='white' opacity='0.2'/>
      <rect x='10' y='4' width='2' height='32' fill='white' opacity='0.2'/>
      <rect x='28' y='4' width='2' height='32' fill='white' opacity='0.2'/>
      <rect x='32' y='4' width='2' height='32' fill='white' opacity='0.2'/>
      <rect x='6' y='4' width='28' height='1' fill='#f5f5f0'/>
      <rect x='6' y='35' width='28' height='1' fill='#f5f5f0'/>
      <rect x='16' y='22' width='8' height='6' rx='1' fill='#607890'/>
      <circle cx='30' cy='10' r='1.5' fill='#ffee88'/>
      <circle cx='26' cy='10' r='1.5' fill='#ffee88'/>
      <circle cx='22' cy='10' r='1.5' fill='#ffee88'/>
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
      {/* Sky */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#C8DEF0" />
      {/* Tower silhouette - tapers from base to top */}
      <polygon points="20,3 17,10 14,22 10,36 12,36 15,22 17,15 18,10 20,6 22,10 23,15 25,22 28,36 30,36 26,22 23,10" fill="#6B5A48" />
      {/* First platform */}
      <rect x="13" y="22" width="14" height="1.5" fill="#7A6A55" />
      {/* Second platform */}
      <rect x="16" y="14" width="8" height="1" fill="#7A6A55" />
      {/* Top observation deck */}
      <rect x="18" y="8" width="4" height="1" fill="#7A6A55" />
      {/* Antenna */}
      <line x1="20" y1="3" x2="20" y2="6" stroke="#8A7A65" strokeWidth="0.8" />
      {/* Arch at base */}
      <path d="M13,28 Q15,25 17,28" fill="none" stroke="#8A7A65" strokeWidth="0.6" />
      <path d="M23,28 Q25,25 27,28" fill="none" stroke="#8A7A65" strokeWidth="0.6" />
      {/* Cross bracing */}
      <line x1="14" y1="24" x2="18" y2="20" stroke="#8A7A65" strokeWidth="0.4" />
      <line x1="26" y1="24" x2="22" y2="20" stroke="#8A7A65" strokeWidth="0.4" />
    </svg>
  ),
  statueOfLiberty: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Sky */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#C8DEF0" />
      {/* Water */}
      <rect x="1" y="30" width="38" height="9" rx="0 0 3 3" fill="#5B9EC4" />
      {/* Pedestal */}
      <rect x="14" y="24" width="12" height="8" fill="#C8BEA8" />
      <rect x="12" y="30" width="16" height="3" fill="#B0A890" />
      {/* Body/robe */}
      <polygon points="20,8 16,14 14,24 26,24 24,14" fill="#6B9E78" />
      {/* Head */}
      <circle cx="20" cy="8" r="2.5" fill="#7AAE88" />
      {/* Crown spikes */}
      <line x1="20" y1="4" x2="20" y2="5.5" stroke="#7AAE88" strokeWidth="0.8" />
      <line x1="17.5" y1="5" x2="18" y2="6" stroke="#7AAE88" strokeWidth="0.8" />
      <line x1="22.5" y1="5" x2="22" y2="6" stroke="#7AAE88" strokeWidth="0.8" />
      <line x1="16" y1="6.5" x2="17" y2="7" stroke="#7AAE88" strokeWidth="0.7" />
      <line x1="24" y1="6.5" x2="23" y2="7" stroke="#7AAE88" strokeWidth="0.7" />
      {/* Torch arm raised */}
      <line x1="22" y1="12" x2="26" y2="5" stroke="#6B9E78" strokeWidth="1.5" />
      {/* Torch flame */}
      <ellipse cx="26.5" cy="4" rx="1.2" ry="2" fill="#E8A840" />
      {/* Tablet arm */}
      <rect x="15" y="14" width="1.5" height="5" fill="#6B9E78" transform="rotate(-10 15 14)" />
    </svg>
  ),
  greatPyramid: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Desert sky */}
      <rect x="1" y="1" width="38" height="22" rx="3" fill="#F0D8A0" />
      {/* Sand ground */}
      <rect x="1" y="22" width="38" height="17" rx="0 0 3 3" fill="#E0C888" />
      {/* Pyramid - front face */}
      <polygon points="20,6 4,34 36,34" fill="#D4A84B" />
      {/* Pyramid - shadow/darker face */}
      <polygon points="20,6 36,34 28,34" fill="#C09838" />
      {/* Stone block lines */}
      <line x1="8" y1="28" x2="32" y2="28" stroke="#C49A3B" strokeWidth="0.4" />
      <line x1="10" y1="24" x2="30" y2="24" stroke="#C49A3B" strokeWidth="0.4" />
      <line x1="12" y1="20" x2="28" y2="20" stroke="#C49A3B" strokeWidth="0.4" />
      <line x1="14" y1="16" x2="26" y2="16" stroke="#C49A3B" strokeWidth="0.4" />
      <line x1="16" y1="12" x2="24" y2="12" stroke="#C49A3B" strokeWidth="0.4" />
      {/* Small pyramid behind */}
      <polygon points="34,14 28,34 38,34" fill="#C89840" opacity="0.5" />
    </svg>
  ),
  tajMahal: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Sky */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#D8E8F0" />
      {/* Reflecting pool */}
      <rect x="10" y="34" width="20" height="4" rx="0.5" fill="#A0C8D8" />
      {/* Platform base */}
      <rect x="4" y="28" width="32" height="6" fill="#F0EDE8" />
      {/* Main building */}
      <rect x="10" y="16" width="20" height="14" fill="#FAFAF8" stroke="#E0DCD4" strokeWidth="0.4" />
      {/* Central dome */}
      <ellipse cx="20" cy="14" rx="7" ry="6" fill="#FAFAF8" stroke="#E0DCD4" strokeWidth="0.5" />
      {/* Dome finial */}
      <line x1="20" y1="7" x2="20" y2="9" stroke="#D4C8B0" strokeWidth="0.8" />
      <circle cx="20" cy="7" r="0.8" fill="#D4C8B0" />
      {/* Small domes */}
      <ellipse cx="12" cy="17" rx="2.5" ry="2" fill="#F5F2EE" stroke="#E0DCD4" strokeWidth="0.4" />
      <ellipse cx="28" cy="17" rx="2.5" ry="2" fill="#F5F2EE" stroke="#E0DCD4" strokeWidth="0.4" />
      {/* Entrance arch */}
      <path d="M17,28 Q20,20 23,28" fill="#D8D0C4" />
      {/* Minarets */}
      <rect x="4" y="12" width="2" height="18" fill="#F5F2EE" stroke="#E0DCD4" strokeWidth="0.3" />
      <circle cx="5" cy="11.5" r="1.2" fill="#F5F2EE" />
      <rect x="34" y="12" width="2" height="18" fill="#F5F2EE" stroke="#E0DCD4" strokeWidth="0.3" />
      <circle cx="35" cy="11.5" r="1.2" fill="#F5F2EE" />
    </svg>
  ),
  colosseum: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Sky */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#D8E0D0" />
      {/* Ground */}
      <rect x="1" y="32" width="38" height="7" rx="0 0 3 3" fill="#C8C0A8" />
      {/* Outer wall - elliptical */}
      <ellipse cx="20" cy="24" rx="17" ry="10" fill="#C9B896" stroke="#A89878" strokeWidth="0.8" />
      {/* Upper tier */}
      <ellipse cx="20" cy="20" rx="17" ry="8" fill="#D4C4A8" stroke="#B8A888" strokeWidth="0.5" />
      {/* Arches - top row */}
      {[5, 9, 13, 17, 21, 25, 29, 33].map((x, i) => (
        <path key={`arch1-${i}`} d={`M${x},20 Q${x + 1.5},17.5 ${x + 3},20`} fill="none" stroke="#A89878" strokeWidth="0.5" />
      ))}
      {/* Arches - bottom row */}
      {[6, 11, 16, 21, 26, 31].map((x, i) => (
        <path key={`arch2-${i}`} d={`M${x},26 Q${x + 2},23 ${x + 4},26`} fill="none" stroke="#A89878" strokeWidth="0.5" />
      ))}
      {/* Broken section - right side */}
      <rect x="32" y="16" width="6" height="12" fill="#D8E0D0" />
      <line x1="32" y1="18" x2="34" y2="28" stroke="#C9B896" strokeWidth="0.8" />
      {/* Inner arena hint */}
      <ellipse cx="20" cy="24" rx="9" ry="5" fill="#D8CCA8" stroke="#B8A888" strokeWidth="0.4" />
    </svg>
  ),
  bigBen: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Sky */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#C0CCD8" />
      {/* Tower body - Gothic stone */}
      <rect x="13" y="10" width="14" height="26" fill="#C8B898" />
      {/* Gothic detailing bands */}
      <rect x="13" y="10" width="14" height="2" fill="#B0A080" />
      <rect x="13" y="20" width="14" height="1" fill="#B0A080" />
      <rect x="13" y="30" width="14" height="1.5" fill="#B0A080" />
      {/* Pointed roof / spire */}
      <polygon points="20,2 13,10 27,10" fill="#5A6A5A" />
      <line x1="20" y1="2" x2="20" y2="4" stroke="#4A5A4A" strokeWidth="0.8" />
      {/* Clock face */}
      <circle cx="20" cy="15" r="4.5" fill="#F5F0E0" stroke="#8A7A60" strokeWidth="0.8" />
      <circle cx="20" cy="15" r="3.8" fill="none" stroke="#C8B898" strokeWidth="0.3" />
      {/* Clock hands */}
      <line x1="20" y1="15" x2="20" y2="11.8" stroke="#333" strokeWidth="0.8" />
      <line x1="20" y1="15" x2="22.8" y2="15.5" stroke="#333" strokeWidth="0.6" />
      <circle cx="20" cy="15" r="0.5" fill="#333" />
      {/* Roman numeral hints */}
      <text x="20" y="12.5" textAnchor="middle" fill="#666" fontSize="1.5">XII</text>
      <text x="20" y="19.5" textAnchor="middle" fill="#666" fontSize="1.5">VI</text>
      {/* Gothic windows below clock */}
      <path d="M16,24 Q17,22 18,24" fill="#8A7A60" />
      <path d="M22,24 Q23,22 24,24" fill="#8A7A60" />
      {/* Base widening */}
      <rect x="10" y="34" width="20" height="4" rx="0.5" fill="#B8A888" />
    </svg>
  ),
  // Commercial
  sevenEleven: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Parking lot */}
      <rect x="1" y="1" width="38" height="38" rx="2" fill="#D0CCC4" />
      {/* Building body */}
      <rect x="4" y="10" width="32" height="24" rx="1" fill="#F5F0E8" />
      {/* Iconic green-orange-red band across top */}
      <rect x="4" y="10" width="32" height="4" fill="#00703C" />
      <rect x="4" y="14" width="32" height="3" fill="#FF7E00" />
      <rect x="4" y="17" width="32" height="3" fill="#EE2E24" />
      {/* Glass storefront */}
      <rect x="6" y="21" width="12" height="12" rx="0.5" fill="#A8D4E6" stroke="#8AB8D0" strokeWidth="0.5" />
      <rect x="20" y="21" width="12" height="12" rx="0.5" fill="#A8D4E6" stroke="#8AB8D0" strokeWidth="0.5" />
      {/* Door */}
      <rect x="14" y="24" width="5" height="9" fill="#78B8D0" stroke="#6AA0B8" strokeWidth="0.5" />
      {/* 7 text hint */}
      <text x="20" y="16" textAnchor="middle" fill="#FFF" fontSize="6" fontWeight="bold">7</text>
    </svg>
  ),
  mcdonalds: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Parking lot */}
      <rect x="1" y="1" width="38" height="38" rx="2" fill="#4A4540" />
      {/* Building body - modern brown/tan */}
      <rect x="3" y="10" width="34" height="24" rx="1.5" fill="#5C4033" />
      {/* Red mansard roof band */}
      <rect x="3" y="10" width="34" height="5" rx="1.5" fill="#DA291C" />
      {/* Glass front */}
      <rect x="5" y="16" width="20" height="17" rx="0.5" fill="#706050" />
      <rect x="6" y="17" width="8" height="15" fill="#8A7A68" stroke="#5C4033" strokeWidth="0.4" />
      <rect x="15" y="17" width="8" height="15" fill="#8A7A68" stroke="#5C4033" strokeWidth="0.4" />
      {/* Golden arches M */}
      <path d="M11,30 L11,20 Q11,16 14,20 L17,26 L20,20 Q23,16 23,20 L23,30" stroke="#FFC72C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* Drive-through */}
      <rect x="28" y="18" width="7" height="10" rx="0.5" fill="#706050" />
      <rect x="30" y="16" width="5" height="3" fill="#DA291C" rx="0.5" />
    </svg>
  ),
  gasStation: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Asphalt lot */}
      <rect x="1" y="1" width="38" height="38" rx="2" fill="#3A3A3A" />
      {/* Canopy */}
      <rect x="3" y="8" width="24" height="18" rx="1" fill="#E8E4E0" />
      <rect x="3" y="8" width="24" height="2" fill="#D0CCC4" />
      {/* Canopy pillars */}
      <rect x="5" y="10" width="1.5" height="16" fill="#C8C4BC" />
      <rect x="23.5" y="10" width="1.5" height="16" fill="#C8C4BC" />
      {/* Fuel pumps */}
      <rect x="10" y="14" width="3" height="8" rx="0.5" fill="#E8E4E0" stroke="#999" strokeWidth="0.5" />
      <rect x="10" y="14" width="3" height="2" fill="#CC2020" rx="0.5" />
      <rect x="17" y="14" width="3" height="8" rx="0.5" fill="#E8E4E0" stroke="#999" strokeWidth="0.5" />
      <rect x="17" y="14" width="3" height="2" fill="#CC2020" rx="0.5" />
      {/* Convenience store */}
      <rect x="29" y="6" width="9" height="22" rx="1" fill="#F0ECE4" stroke="#C8C0B4" strokeWidth="0.5" />
      <rect x="30" y="10" width="7" height="12" fill="#A8D4E6" stroke="#8AB8D0" strokeWidth="0.4" />
      <rect x="31" y="22" width="5" height="5" fill="#78B8D0" />
      {/* Road markings */}
      <line x1="3" y1="34" x2="38" y2="34" stroke="#F0E860" strokeWidth="0.8" strokeDasharray="3 2" />
    </svg>
  ),
  supermarket: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Parking lot */}
      <rect x="1" y="1" width="38" height="38" rx="2" fill="#D0CCC4" />
      {/* Large building body */}
      <rect x="2" y="6" width="36" height="28" rx="1.5" fill="#F0ECE4" />
      {/* Green header band */}
      <rect x="2" y="6" width="36" height="6" rx="1.5" fill="#2E8B57" />
      {/* Store windows */}
      <rect x="4" y="13" width="7" height="8" fill="#A8D4E6" stroke="#8AB8D0" strokeWidth="0.4" />
      <rect x="12" y="13" width="7" height="8" fill="#A8D4E6" stroke="#8AB8D0" strokeWidth="0.4" />
      <rect x="20" y="13" width="7" height="8" fill="#A8D4E6" stroke="#8AB8D0" strokeWidth="0.4" />
      <rect x="28" y="13" width="8" height="8" fill="#A8D4E6" stroke="#8AB8D0" strokeWidth="0.4" />
      {/* Entrance doors */}
      <rect x="15" y="24" width="10" height="9" rx="0.5" fill="#78B8D0" />
      <line x1="20" y1="24" x2="20" y2="33" stroke="#6AA0B8" strokeWidth="0.4" />
      {/* Cart icon */}
      <path d="M8,30 L10,28 L14,28 L14.5,30" stroke="#888" strokeWidth="0.8" fill="none" />
      <circle cx="11" cy="31" r="0.8" fill="#888" />
      <circle cx="14" cy="31" r="0.8" fill="#888" />
      {/* Parking lines */}
      <line x1="4" y1="36" x2="4" y2="33" stroke="#FFF" strokeWidth="0.5" />
      <line x1="8" y1="36" x2="8" y2="33" stroke="#FFF" strokeWidth="0.5" />
      <line x1="32" y1="36" x2="32" y2="33" stroke="#FFF" strokeWidth="0.5" />
      <line x1="36" y1="36" x2="36" y2="33" stroke="#FFF" strokeWidth="0.5" />
    </svg>
  ),
  starbucks: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Sidewalk */}
      <rect x="1" y="1" width="38" height="38" rx="2" fill="#D8D0C4" />
      {/* Building - dark green/wood */}
      <rect x="3" y="8" width="34" height="26" rx="1.5" fill="#1E3932" />
      {/* Awning */}
      <rect x="3" y="8" width="34" height="4" rx="1.5" fill="#00704A" />
      {/* Large glass front */}
      <rect x="5" y="13" width="14" height="20" rx="0.5" fill="#2A4A42" stroke="#1E3932" strokeWidth="0.4" />
      <rect x="20" y="13" width="14" height="20" rx="0.5" fill="#2A4A42" stroke="#1E3932" strokeWidth="0.4" />
      {/* Door */}
      <rect x="15" y="18" width="5" height="15" fill="#3A5A50" stroke="#2A4A42" strokeWidth="0.4" />
      {/* Siren logo circle */}
      <circle cx="20" cy="10" r="4.5" fill="#00704A" stroke="#FFF" strokeWidth="0.8" />
      <circle cx="20" cy="9.5" r="2" fill="#1E3932" />
      {/* Crown hint */}
      <path d="M18.5,8 L20,7 L21.5,8" stroke="#FFF" strokeWidth="0.5" fill="none" />
      {/* Outdoor seating hint */}
      <circle cx="8" cy="36" r="1.5" fill="#B0A898" />
      <circle cx="14" cy="36" r="1.5" fill="#B0A898" />
    </svg>
  ),
  walmart: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Parking lot */}
      <rect x="1" y="1" width="38" height="38" rx="2" fill="#D0CCC4" />
      {/* Massive building */}
      <rect x="2" y="4" width="36" height="26" rx="1.5" fill="#F0ECE4" />
      {/* Blue header band */}
      <rect x="2" y="4" width="36" height="7" rx="1.5" fill="#0071CE" />
      {/* Walmart spark */}
      <circle cx="20" cy="7.5" r="2.5" fill="#FFC220" />
      <line x1="20" y1="3.5" x2="20" y2="5" stroke="#FFC220" strokeWidth="1.2" />
      <line x1="20" y1="10" x2="20" y2="11.5" stroke="#FFC220" strokeWidth="1.2" />
      <line x1="16" y1="7.5" x2="17.5" y2="7.5" stroke="#FFC220" strokeWidth="1.2" />
      <line x1="22.5" y1="7.5" x2="24" y2="7.5" stroke="#FFC220" strokeWidth="1.2" />
      <line x1="17.2" y1="4.7" x2="18.2" y2="5.7" stroke="#FFC220" strokeWidth="1" />
      <line x1="21.8" y1="9.3" x2="22.8" y2="10.3" stroke="#FFC220" strokeWidth="1" />
      {/* Storefront windows */}
      <rect x="4" y="12" width="7" height="10" fill="#A8D4E6" stroke="#8AB8D0" strokeWidth="0.4" />
      <rect x="12" y="12" width="7" height="10" fill="#A8D4E6" stroke="#8AB8D0" strokeWidth="0.4" />
      <rect x="20" y="12" width="7" height="10" fill="#A8D4E6" stroke="#8AB8D0" strokeWidth="0.4" />
      <rect x="28" y="12" width="8" height="10" fill="#A8D4E6" stroke="#8AB8D0" strokeWidth="0.4" />
      {/* Entrance */}
      <rect x="15" y="24" width="10" height="6" fill="#78B8D0" />
      <line x1="20" y1="24" x2="20" y2="30" stroke="#6AA0B8" strokeWidth="0.4" />
      {/* Parking lines */}
      <line x1="5" y1="38" x2="5" y2="34" stroke="#FFF" strokeWidth="0.5" />
      <line x1="9" y1="38" x2="9" y2="34" stroke="#FFF" strokeWidth="0.5" />
      <line x1="13" y1="38" x2="13" y2="34" stroke="#FFF" strokeWidth="0.5" />
      <line x1="27" y1="38" x2="27" y2="34" stroke="#FFF" strokeWidth="0.5" />
      <line x1="31" y1="38" x2="31" y2="34" stroke="#FFF" strokeWidth="0.5" />
      <line x1="35" y1="38" x2="35" y2="34" stroke="#FFF" strokeWidth="0.5" />
    </svg>
  ),
  // Gaming
  pokemonCenter: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Ground/pavement */}
      <rect x="2" y="2" width="36" height="36" rx="2" fill="#C8BFA8" />
      {/* Building shadow */}
      <rect x="7" y="9" width="28" height="26" rx="1.5" fill="#A09880" />
      {/* Orange/red roof (Gen 4 Sinnoh style) */}
      <rect x="4" y="6" width="28" height="26" rx="2" fill="#E85C2B" />
      {/* Roof border trim */}
      <rect x="4" y="6" width="28" height="26" rx="2" fill="none" stroke="#C44820" strokeWidth="1" />
      {/* Roof ridge line */}
      <line x1="18" y1="6" x2="18" y2="12" stroke="#C44820" strokeWidth="0.8" />
      {/* Pokeball emblem on roof */}
      <circle cx="18" cy="16" r="6" fill="#D04E24" stroke="#FFF" strokeWidth="1.2" />
      {/* Pokeball top half (red) stays roof color, bottom half white */}
      <path d="M12 16 A6 6 0 0 1 24 16" fill="#CC3D18" />
      <path d="M12 16 A6 6 0 0 0 24 16" fill="#F5F0E6" />
      {/* Pokeball center line */}
      <line x1="12" y1="16" x2="24" y2="16" stroke="#333" strokeWidth="1" />
      {/* Pokeball button */}
      <circle cx="18" cy="16" r="2" fill="#FFF" stroke="#333" strokeWidth="1" />
      <circle cx="18" cy="16" r="0.8" fill="#333" />
      {/* Front wall (cream/beige, visible below roof) */}
      <rect x="6" y="26" width="24" height="7" rx="1" fill="#F5EED8" />
      <rect x="6" y="26" width="24" height="7" rx="1" fill="none" stroke="#D4CBB0" strokeWidth="0.5" />
      {/* Sliding glass doors */}
      <rect x="13" y="27" width="10" height="5.5" rx="0.5" fill="#87CEEB" stroke="#6BA5C4" strokeWidth="0.5" />
      <line x1="18" y1="27" x2="18" y2="32.5" stroke="#6BA5C4" strokeWidth="0.4" />
      {/* Side windows */}
      <rect x="8" y="28" width="3" height="3" rx="0.3" fill="#87CEEB" stroke="#6BA5C4" strokeWidth="0.4" />
      <rect x="25" y="28" width="3" height="3" rx="0.3" fill="#87CEEB" stroke="#6BA5C4" strokeWidth="0.4" />
    </svg>
  ),
  minecraftHouse: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Cobblestone base */}
      <rect x="4" y="30" width="32" height="6" fill="#7A7A7A" />
      {/* Oak plank walls */}
      <rect x="6" y="14" width="28" height="16" fill="#BC9036" />
      {/* Oak log corner pillars */}
      <rect x="4" y="14" width="4" height="22" fill="#6B5130" />
      <rect x="32" y="14" width="4" height="22" fill="#6B5130" />
      {/* Dark oak roof - stepped */}
      <rect x="2" y="10" width="36" height="5" fill="#3E2912" />
      <rect x="6" y="6" width="28" height="5" fill="#6B5130" />
      <rect x="12" y="3" width="16" height="4" fill="#3E2912" />
      {/* Door */}
      <rect x="17" y="22" width="6" height="14" fill="#5C3A1E" />
      <rect x="21" y="28" width="1" height="1" fill="#888" />
      {/* Windows */}
      <rect x="8" y="18" width="5" height="5" fill="#A8D8EA" stroke="#5C4033" strokeWidth="1" />
      <rect x="27" y="18" width="5" height="5" fill="#A8D8EA" stroke="#5C4033" strokeWidth="1" />
      {/* Torches */}
      <rect x="14" y="20" width="1" height="3" fill="#6B5130" />
      <rect x="13.5" y="19" width="2" height="2" fill="#FFAA00" />
      <rect x="25" y="20" width="1" height="3" fill="#6B5130" />
      <rect x="24.5" y="19" width="2" height="2" fill="#FFAA00" />
    </svg>
  ),
  acHouse: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Grass */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#7EC850" />
      {/* Stone step */}
      <rect x="6" y="30" width="28" height="4" rx="1" fill="#C8BEB4" />
      {/* Cream walls */}
      <rect x="8" y="14" width="24" height="20" rx="1" fill="#F5E6D0" />
      {/* Red gable roof - oversized */}
      <polygon points="4,16 20,4 36,16" fill="#C0392B" />
      <polygon points="6,16 20,6 34,16" fill="#A93226" />
      {/* Ridge cap */}
      <rect x="18" y="4" width="4" height="1" rx="0.5" fill="#8B2E22" />
      {/* Arched door */}
      <rect x="16" y="22" width="8" height="12" rx="1" fill="#A0724A" />
      <ellipse cx="20" cy="22" rx="4" ry="3" fill="#A0724A" />
      <rect x="18" y="24" width="4" height="3" rx="0.5" fill="#B5D8F0" opacity="0.7" />
      <circle cx="22" cy="28" r="0.8" fill="#D4A843" />
      {/* Windows - 2x2 pane */}
      <rect x="9" y="18" width="5" height="5" rx="0.5" fill="#F0E0CC" />
      <rect x="10" y="19" width="1.5" height="1.5" fill="#B5D8F0" />
      <rect x="12" y="19" width="1.5" height="1.5" fill="#B5D8F0" />
      <rect x="10" y="21" width="1.5" height="1.5" fill="#B5D8F0" />
      <rect x="12" y="21" width="1.5" height="1.5" fill="#B5D8F0" />
      <rect x="26" y="18" width="5" height="5" rx="0.5" fill="#F0E0CC" />
      <rect x="27" y="19" width="1.5" height="1.5" fill="#B5D8F0" />
      <rect x="29" y="19" width="1.5" height="1.5" fill="#B5D8F0" />
      <rect x="27" y="21" width="1.5" height="1.5" fill="#B5D8F0" />
      <rect x="29" y="21" width="1.5" height="1.5" fill="#B5D8F0" />
      {/* Chimney */}
      <rect x="27" y="6" width="3" height="6" fill="#B0A090" />
      <rect x="26.5" y="5.5" width="4" height="1" fill="#9A8A7A" />
      {/* Mailbox */}
      <rect x="33" y="26" width="1" height="6" fill="#8B6F50" />
      <rect x="32" y="25" width="3" height="2" rx="0.5" fill="#8B6F50" />
      <rect x="35" y="24" width="1" height="2" fill="#4A90D9" />
    </svg>
  ),
  fortnite1x1: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Wood plank wall background */}
      <rect x="4" y="4" width="32" height="32" fill="#C4973B" />
      {/* Outer frame */}
      <rect x="4" y="4" width="32" height="32" fill="none" stroke="#6B4E20" strokeWidth="2" />
      {/* Horizontal plank lines */}
      <line x1="4" y1="12" x2="36" y2="12" stroke="#A07830" strokeWidth="0.8" />
      <line x1="4" y1="20" x2="36" y2="20" stroke="#A07830" strokeWidth="0.8" />
      <line x1="4" y1="28" x2="36" y2="28" stroke="#A07830" strokeWidth="0.8" />
      {/* Vertical studs */}
      <line x1="20" y1="4" x2="20" y2="36" stroke="#8B6528" strokeWidth="1.2" />
      {/* X cross-braces left */}
      <line x1="5" y1="5" x2="19" y2="35" stroke="#8B6528" strokeWidth="0.8" />
      <line x1="19" y1="5" x2="5" y2="35" stroke="#8B6528" strokeWidth="0.8" />
      {/* X cross-braces right */}
      <line x1="21" y1="5" x2="35" y2="35" stroke="#8B6528" strokeWidth="0.8" />
      <line x1="35" y1="5" x2="21" y2="35" stroke="#8B6528" strokeWidth="0.8" />
      {/* Ramp hint - diagonal line */}
      <line x1="8" y1="32" x2="32" y2="8" stroke="#FFF" strokeWidth="2" opacity="0.6" />
    </svg>
  ),
  zeldaHouse: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Grass */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#4A7A30" />
      {/* Stone foundation */}
      <rect x="5" y="30" width="30" height="5" fill="#7A7060" />
      {/* Cream stucco walls */}
      <rect x="6" y="14" width="28" height="21" fill="#E0CFA8" />
      {/* Stone quoins at corners */}
      <rect x="5" y="14" width="3" height="21" fill="#5C5245" />
      <rect x="32" y="14" width="3" height="21" fill="#5C5245" />
      {/* Red-brown gable roof */}
      <polygon points="3,16 20,3 37,16" fill="#8B4520" />
      <polygon points="5,16 20,5 35,16" fill="#6E3518" />
      {/* Tall chimney */}
      <rect x="28" y="2" width="4" height="12" fill="#7A7060" />
      <rect x="27" y="1" width="6" height="2" fill="#5C5245" />
      {/* Support brace */}
      <line x1="32" y1="14" x2="30" y2="6" stroke="#4A3528" strokeWidth="1" />
      {/* Door */}
      <rect x="17" y="22" width="6" height="13" fill="#4A3528" />
      {/* Windows with blue shutters */}
      <rect x="8" y="20" width="4" height="4" fill="#C8D8E8" />
      <rect x="7" y="20" width="1.5" height="4" fill="#4A6A8A" />
      <rect x="12.5" y="20" width="1.5" height="4" fill="#4A6A8A" />
      <rect x="28" y="20" width="4" height="4" fill="#C8D8E8" />
      <rect x="27" y="20" width="1.5" height="4" fill="#4A6A8A" />
      <rect x="32.5" y="20" width="1.5" height="4" fill="#4A6A8A" />
      {/* Ivy accent */}
      <rect x="33" y="22" width="2" height="8" rx="1" fill="#2E5E2E" opacity="0.7" />
      {/* Lantern */}
      <rect x="23.5" y="21" width="1.5" height="1.5" fill="#D4A843" />
    </svg>
  ),
  simsHouse: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Bright green lawn */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#4CAF50" />
      {/* Foundation */}
      <rect x="5" y="30" width="30" height="4" fill="#B8B0A8" />
      {/* Beige walls */}
      <rect x="6" y="14" width="28" height="20" fill="#F0E8D8" />
      {/* Dark blue-gray gable roof */}
      <polygon points="3,16 20,4 37,16" fill="#3D4F5F" />
      <polygon points="5,16 20,6 35,16" fill="#2E3E4E" />
      {/* Door */}
      <rect x="17" y="22" width="6" height="12" fill="#8B6528" />
      <circle cx="21.5" cy="28" r="0.6" fill="#C0B090" />
      {/* Windows - evenly spaced, white frames */}
      <rect x="7" y="18" width="5" height="6" fill="#B0D4E8" stroke="#E8E4E0" strokeWidth="1" />
      <line x1="7" y1="21" x2="12" y2="21" stroke="#E8E4E0" strokeWidth="0.5" />
      <rect x="28" y="18" width="5" height="6" fill="#B0D4E8" stroke="#E8E4E0" strokeWidth="1" />
      <line x1="28" y1="21" x2="33" y2="21" stroke="#E8E4E0" strokeWidth="0.5" />
      {/* Plumbob */}
      <polygon points="20,1 17.5,5 22.5,5" fill="#44CC44" opacity="0.85" />
      <polygon points="20,9 17.5,5 22.5,5" fill="#33AA33" opacity="0.85" />
      {/* Pool hint */}
      <rect x="12" y="35" width="16" height="3" rx="0.5" fill="#3498DB" />
    </svg>
  ),
  // Buildings
  mediumHouse: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Lawn */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#7CCD7C" />
      {/* Foundation */}
      <rect x="4" y="30" width="32" height="4" fill="#B0A898" />
      {/* Walls */}
      <rect x="5" y="14" width="30" height="20" fill="#E8D8C0" />
      {/* Roof */}
      <polygon points="2,16 20,4 38,16" fill="#8B5A3C" />
      <polygon points="4,16 20,6 36,16" fill="#7A4A2C" />
      {/* Door */}
      <rect x="17" y="22" width="6" height="12" fill="#6B4020" />
      <circle cx="21.5" cy="28" r="0.6" fill="#C0A060" />
      {/* Windows */}
      <rect x="7" y="18" width="5" height="5" fill="#A8D4E6" stroke="#D0C8B8" strokeWidth="0.8" />
      <line x1="9.5" y1="18" x2="9.5" y2="23" stroke="#D0C8B8" strokeWidth="0.4" />
      <rect x="28" y="18" width="5" height="5" fill="#A8D4E6" stroke="#D0C8B8" strokeWidth="0.8" />
      <line x1="30.5" y1="18" x2="30.5" y2="23" stroke="#D0C8B8" strokeWidth="0.4" />
      {/* Attic window */}
      <circle cx="20" cy="12" r="2" fill="#A8D4E6" stroke="#D0C8B8" strokeWidth="0.5" />
    </svg>
  ),
  largeHouse: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Lawn */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#7CCD7C" />
      {/* Foundation */}
      <rect x="2" y="30" width="36" height="5" fill="#B0A898" />
      {/* Main building */}
      <rect x="3" y="14" width="22" height="21" fill="#D4C0A0" />
      {/* Wing */}
      <rect x="25" y="18" width="13" height="17" fill="#D4C0A0" />
      {/* Main roof */}
      <polygon points="1,16 14,4 27,16" fill="#5A3A2A" />
      <polygon points="3,16 14,6 25,16" fill="#4A2A1A" />
      {/* Wing roof */}
      <polygon points="24,20 31.5,12 39,20" fill="#5A3A2A" />
      {/* Garage door */}
      <rect x="28" y="24" width="8" height="10" rx="0.5" fill="#8A7A68" />
      <line x1="28" y1="27" x2="36" y2="27" stroke="#7A6A58" strokeWidth="0.4" />
      <line x1="28" y1="30" x2="36" y2="30" stroke="#7A6A58" strokeWidth="0.4" />
      {/* Front door */}
      <rect x="11" y="22" width="6" height="12" fill="#4A2A18" />
      {/* Windows */}
      <rect x="5" y="18" width="4" height="5" fill="#A8D4E6" stroke="#C8C0B0" strokeWidth="0.6" />
      <rect x="19" y="18" width="4" height="5" fill="#A8D4E6" stroke="#C8C0B0" strokeWidth="0.6" />
      {/* Upper windows */}
      <rect x="9" y="9" width="3.5" height="4" fill="#A8D4E6" stroke="#C8C0B0" strokeWidth="0.5" />
      <rect x="15" y="9" width="3.5" height="4" fill="#A8D4E6" stroke="#C8C0B0" strokeWidth="0.5" />
    </svg>
  ),
  shed: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Ground */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#7CCD7C" />
      {/* Walls - wood plank */}
      <rect x="8" y="16" width="24" height="18" fill="#A0724A" />
      {/* Lean-to roof */}
      <polygon points="6,16 20,8 34,16" fill="#6B4A30" />
      <polygon points="8,16 20,10 32,16" fill="#5A3A20" />
      {/* Door */}
      <rect x="15" y="22" width="7" height="12" fill="#6B4020" />
      <rect x="15" y="22" width="7" height="12" fill="none" stroke="#5A3518" strokeWidth="0.5" />
      {/* X brace on door */}
      <line x1="15" y1="22" x2="22" y2="34" stroke="#5A3518" strokeWidth="0.5" />
      <line x1="22" y1="22" x2="15" y2="34" stroke="#5A3518" strokeWidth="0.5" />
      {/* Handle */}
      <circle cx="20.5" cy="28" r="0.7" fill="#C0A060" />
      {/* Small window */}
      <rect x="25" y="20" width="4" height="4" fill="#A8D4E6" stroke="#8A7060" strokeWidth="0.5" />
    </svg>
  ),
  garage: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Driveway */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#C0B8B0" />
      {/* Walls */}
      <rect x="4" y="12" width="32" height="22" fill="#E0D8D0" />
      {/* Flat roof */}
      <rect x="3" y="10" width="34" height="4" fill="#808080" />
      {/* Roller door */}
      <rect x="7" y="18" width="26" height="16" rx="1" fill="#A8A098" />
      <line x1="7" y1="21" x2="33" y2="21" stroke="#909088" strokeWidth="0.5" />
      <line x1="7" y1="24" x2="33" y2="24" stroke="#909088" strokeWidth="0.5" />
      <line x1="7" y1="27" x2="33" y2="27" stroke="#909088" strokeWidth="0.5" />
      <line x1="7" y1="30" x2="33" y2="30" stroke="#909088" strokeWidth="0.5" />
      {/* Handle */}
      <rect x="18" y="31" width="4" height="1" rx="0.5" fill="#666" />
      {/* Light */}
      <circle cx="34" cy="15" r="1.2" fill="#E8D060" />
    </svg>
  ),
  barn: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Field */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#7CCD7C" />
      {/* Barn body - classic red */}
      <rect x="5" y="14" width="30" height="20" fill="#8B1A1A" />
      {/* Gambrel roof */}
      <polygon points="3,16 10,10 20,6 30,10 37,16" fill="#6B1010" />
      <polygon points="5,16 12,11 20,8 28,11 35,16" fill="#7A1515" />
      {/* White trim */}
      <line x1="5" y1="14" x2="35" y2="14" stroke="#FFF" strokeWidth="0.6" />
      {/* Barn doors */}
      <rect x="14" y="22" width="12" height="12" fill="#6B1010" />
      <line x1="20" y1="22" x2="20" y2="34" stroke="#FFF" strokeWidth="0.6" />
      {/* X brace on doors */}
      <line x1="14" y1="22" x2="20" y2="34" stroke="#FFF" strokeWidth="0.4" />
      <line x1="20" y1="22" x2="14" y2="34" stroke="#FFF" strokeWidth="0.4" />
      <line x1="20" y1="22" x2="26" y2="34" stroke="#FFF" strokeWidth="0.4" />
      <line x1="26" y1="22" x2="20" y2="34" stroke="#FFF" strokeWidth="0.4" />
      {/* Hayloft window */}
      <rect x="17" y="16" width="6" height="4" fill="#4A0808" stroke="#FFF" strokeWidth="0.4" />
      {/* Side windows */}
      <rect x="7" y="20" width="4" height="4" fill="#4A0808" stroke="#FFF" strokeWidth="0.3" />
      <rect x="29" y="20" width="4" height="4" fill="#4A0808" stroke="#FFF" strokeWidth="0.3" />
    </svg>
  ),
  workshop: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Concrete pad */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#C0B8B0" />
      {/* Walls - industrial green */}
      <rect x="4" y="12" width="32" height="22" fill="#4A6040" />
      {/* Metal roof */}
      <rect x="3" y="10" width="34" height="4" fill="#606858" />
      <line x1="3" y1="12" x2="37" y2="12" stroke="#505850" strokeWidth="0.4" />
      {/* Roller door */}
      <rect x="6" y="18" width="12" height="16" rx="0.5" fill="#5A7050" />
      <line x1="6" y1="21" x2="18" y2="21" stroke="#4A6040" strokeWidth="0.4" />
      <line x1="6" y1="24" x2="18" y2="24" stroke="#4A6040" strokeWidth="0.4" />
      <line x1="6" y1="27" x2="18" y2="27" stroke="#4A6040" strokeWidth="0.4" />
      {/* Entry door */}
      <rect x="22" y="22" width="5" height="12" fill="#3A5030" />
      {/* Windows */}
      <rect x="29" y="16" width="5" height="5" fill="#A8D4E6" stroke="#3A5030" strokeWidth="0.5" />
      <line x1="31.5" y1="16" x2="31.5" y2="21" stroke="#3A5030" strokeWidth="0.3" />
      {/* Workbench hint */}
      <rect x="22" y="16" width="5" height="3" fill="#8A7050" />
    </svg>
  ),
  greenhouse: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Garden */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#7CCD7C" />
      {/* Glass structure */}
      <rect x="6" y="14" width="28" height="20" fill="#D8F0D8" fillOpacity="0.6" stroke="#228B22" strokeWidth="0.8" />
      {/* A-frame glass roof */}
      <polygon points="4,16 20,5 36,16" fill="#C8E8C8" fillOpacity="0.5" stroke="#228B22" strokeWidth="0.6" />
      {/* Roof glass panes */}
      <line x1="12" y1="10.5" x2="12" y2="16" stroke="#228B22" strokeWidth="0.4" />
      <line x1="20" y1="5" x2="20" y2="16" stroke="#228B22" strokeWidth="0.4" />
      <line x1="28" y1="10.5" x2="28" y2="16" stroke="#228B22" strokeWidth="0.4" />
      {/* Wall glass panes */}
      <line x1="14" y1="14" x2="14" y2="34" stroke="#228B22" strokeWidth="0.4" />
      <line x1="20" y1="14" x2="20" y2="34" stroke="#228B22" strokeWidth="0.4" />
      <line x1="26" y1="14" x2="26" y2="34" stroke="#228B22" strokeWidth="0.4" />
      <line x1="6" y1="24" x2="34" y2="24" stroke="#228B22" strokeWidth="0.4" />
      {/* Door */}
      <rect x="17" y="26" width="6" height="8" fill="#C8E8C8" stroke="#228B22" strokeWidth="0.5" />
      {/* Plants inside */}
      <circle cx="10" cy="20" r="1.8" fill="#32CD32" />
      <circle cx="30" cy="20" r="1.8" fill="#32CD32" />
      <circle cx="10" cy="30" r="1.5" fill="#2E8B2E" />
      <circle cx="30" cy="30" r="1.5" fill="#2E8B2E" />
    </svg>
  ),
  gazebo: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Garden */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#7CCD7C" />
      {/* Floor/deck */}
      <ellipse cx="20" cy="32" rx="14" ry="4" fill="#C8B498" />
      {/* Pillars */}
      <rect x="8" y="14" width="1.5" height="20" fill="#D4C0A0" />
      <rect x="30.5" y="14" width="1.5" height="20" fill="#D4C0A0" />
      <rect x="14" y="12" width="1.2" height="22" fill="#D4C0A0" />
      <rect x="24.8" y="12" width="1.2" height="22" fill="#D4C0A0" />
      {/* Pointed roof */}
      <polygon points="5,16 20,4 35,16" fill="#7A5A3A" />
      <polygon points="7,16 20,6 33,16" fill="#6A4A2A" />
      {/* Railing */}
      <line x1="8" y1="28" x2="32" y2="28" stroke="#D4C0A0" strokeWidth="0.8" />
      {/* Decorative top */}
      <circle cx="20" cy="4" r="1" fill="#8A6A4A" />
    </svg>
  ),
  carport: (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      {/* Driveway */}
      <rect x="1" y="1" width="38" height="38" rx="3" fill="#C0B8B0" />
      {/* Flat roof/canopy */}
      <rect x="4" y="10" width="32" height="3" fill="#808080" />
      {/* Support pillars */}
      <rect x="5" y="13" width="2" height="21" fill="#909088" />
      <rect x="33" y="13" width="2" height="21" fill="#909088" />
      {/* Car underneath */}
      <rect x="10" y="22" width="20" height="10" rx="3" fill="#4A7AB8" />
      <rect x="12" y="22" width="16" height="5" rx="2" fill="#3A6AA8" />
      {/* Windshield */}
      <rect x="14" y="23" width="5" height="3" rx="0.5" fill="#8AB8D8" />
      {/* Wheels */}
      <circle cx="14" cy="31" r="2" fill="#333" />
      <circle cx="26" cy="31" r="2" fill="#333" />
      {/* Concrete floor */}
      <rect x="4" y="34" width="32" height="2" fill="#A8A098" />
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

export default function ComparePanel({
  comparisonObjects,
  activeComparisons,
  toggleComparison,
  landArea = 0,
  lengthUnit = 'm',
  onClosePanel,
  onExpandedChange,
  isActive,
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
                      style={{ minHeight: '56px', padding: '12px 16px' }}
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
                      style={{ minHeight: '56px', padding: '8px 12px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[var(--color-text-muted)] text-[11px]">Rotate:</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onRotationChange?.(obj.id, ((comparisonRotations[obj.id] || 0) - 45 + 360) % 360)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-[var(--color-bg-secondary)] hover:bg-white/10 text-[var(--color-text-secondary)] text-sm"
                          style={{ minWidth: '44px', minHeight: '44px' }}
                          title="Rotate -45°"
                        >
                          ↺
                        </button>
                        <input
                          type="number"
                          value={Math.round(comparisonRotations[obj.id] || 0)}
                          onChange={(e) => onRotationChange?.(obj.id, (parseFloat(e.target.value) || 0) % 360)}
                          className="w-12 h-6 text-center text-[11px] rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
                          style={{ width: '56px', minHeight: '44px' }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-[var(--color-text-muted)] text-[11px]">°</span>
                        <button
                          onClick={() => onRotationChange?.(obj.id, ((comparisonRotations[obj.id] || 0) + 45) % 360)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-[var(--color-bg-secondary)] hover:bg-white/10 text-[var(--color-text-secondary)] text-sm"
                          style={{ minWidth: '44px', minHeight: '44px' }}
                          title="Rotate +45°"
                        >
                          ↻
                        </button>
                      </div>
                      <button
                        onClick={() => onResetTransform?.(obj.id)}
                        className="ml-auto px-4 py-2 text-[11px] rounded bg-[var(--color-bg-secondary)] hover:bg-white/10 text-[var(--color-text-muted)]"
                        style={{ minHeight: '44px', padding: '10px 16px' }}
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
          className="sitea-collapse-handle h-full flex items-center justify-center bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer border-l border-[var(--color-border)]"
        >
          <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
    </div>
  )
}
