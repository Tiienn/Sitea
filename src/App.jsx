import { useState, useEffect, useRef } from 'react'
import nipplejs from 'nipplejs'
import LandScene from './components/LandScene'
import PolygonEditor, { calculatePolygonArea } from './components/PolygonEditor'

const COMPARISON_OBJECTS = [
  { id: 'soccerField', name: 'Soccer Field', width: 68, length: 105, color: '#228B22' },
  { id: 'basketballCourt', name: 'Basketball Court', width: 15, length: 28, color: '#CD853F' },
  { id: 'tennisCourt', name: 'Tennis Court', width: 10.97, length: 23.77, color: '#4169E1' },
  { id: 'house', name: 'House (10m×10m)', width: 10, length: 10, color: '#8B4513' },
  { id: 'parkingSpace', name: 'Parking Space', width: 2.5, length: 5, color: '#696969' },
  { id: 'swimmingPool', name: 'Olympic Pool', width: 25, length: 50, color: '#00CED1' },
]

const BUILDING_TYPES = [
  { id: 'smallHouse', name: 'Small House', width: 8, length: 10, height: 5, color: '#D2691E' },
  { id: 'mediumHouse', name: 'Medium House', width: 12, length: 15, height: 6, color: '#CD853F' },
  { id: 'largeHouse', name: 'Large House', width: 15, length: 20, height: 7, color: '#8B4513' },
  { id: 'shed', name: 'Shed', width: 3, length: 4, height: 2.5, color: '#A0522D' },
  { id: 'garage', name: 'Garage', width: 6, length: 6, height: 3, color: '#808080' },
  { id: 'pool', name: 'Swimming Pool', width: 5, length: 10, height: -1.5, color: '#00CED1' },
]

// Virtual Joystick component for mobile
function VirtualJoystick({ joystickInput }) {
  const joystickRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    const manager = nipplejs.create({
      zone: containerRef.current,
      mode: 'static',
      position: { left: '80px', bottom: '140px' },
      color: 'white',
      size: 120,
      restOpacity: 0.5,
    })

    joystickRef.current = manager

    manager.on('move', (_, data) => {
      if (data.vector && joystickInput.current) {
        joystickInput.current.x = data.vector.x
        joystickInput.current.y = data.vector.y
      }
    })

    manager.on('end', () => {
      if (joystickInput.current) {
        joystickInput.current.x = 0
        joystickInput.current.y = 0
      }
    })

    return () => {
      manager.destroy()
    }
  }, [joystickInput])

  return (
    <div
      ref={containerRef}
      className="joystick-zone fixed left-4 w-40 h-40 z-50"
      style={{ touchAction: 'none', bottom: '80px' }}
    />
  )
}

function App() {
  const [dimensions, setDimensions] = useState({ length: 20, width: 15 })
  const [isExploring, setIsExploring] = useState(true)
  const [inputValues, setInputValues] = useState({ length: '20', width: '15' })
  const [activeComparisons, setActiveComparisons] = useState({})
  const [shapeMode, setShapeMode] = useState('rectangle') // 'rectangle' or 'polygon'
  const [polygonPoints, setPolygonPoints] = useState([])
  const [confirmedPolygon, setConfirmedPolygon] = useState(null)
  const [selectedBuilding, setSelectedBuilding] = useState(null)
  const [placedBuildings, setPlacedBuildings] = useState([])
  const [saveStatus, setSaveStatus] = useState(null)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [activePanel, setActivePanel] = useState(null) // 'land', 'compare', 'build', or null
  const joystickInput = useRef({ x: 0, y: 0 })

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0)
  }, [])

  // Toggle panel - close if same, open if different
  const togglePanel = (panel) => {
    setActivePanel(prev => prev === panel ? null : panel)
  }

  const handlePolygonComplete = () => {
    if (polygonPoints.length >= 3) {
      setConfirmedPolygon(polygonPoints)
    }
  }

  const area = shapeMode === 'polygon' && confirmedPolygon
    ? calculatePolygonArea(confirmedPolygon)
    : dimensions.length * dimensions.width

  const handleInputChange = (field, value) => {
    setInputValues(prev => ({ ...prev, [field]: value }))
  }

  const handleVisualize = () => {
    const length = parseFloat(inputValues.length) || 20
    const width = parseFloat(inputValues.width) || 15
    setDimensions({ length: Math.max(1, length), width: Math.max(1, width) })
  }

  const toggleComparison = (id) => {
    setActiveComparisons(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const handlePlaceBuilding = (position) => {
    if (!selectedBuilding) return
    const buildingType = BUILDING_TYPES.find(b => b.id === selectedBuilding)
    if (!buildingType) return
    setPlacedBuildings(prev => [...prev, {
      id: Date.now(),
      type: buildingType,
      position
    }])
    setSelectedBuilding(null) // Exit placement mode after placing
  }

  const handleDeleteBuilding = (buildingId) => {
    setPlacedBuildings(prev => prev.filter(b => b.id !== buildingId))
  }

  // Load saved state on mount
  useEffect(() => {
    const saved = localStorage.getItem('landVisualizer')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data.dimensions) {
          setDimensions(data.dimensions)
          setInputValues({ length: String(data.dimensions.length), width: String(data.dimensions.width) })
        }
        if (data.shapeMode) setShapeMode(data.shapeMode)
        if (data.polygonPoints) setPolygonPoints(data.polygonPoints)
        if (data.confirmedPolygon) setConfirmedPolygon(data.confirmedPolygon)
        if (data.placedBuildings) setPlacedBuildings(data.placedBuildings)
        if (data.activeComparisons) setActiveComparisons(data.activeComparisons)
      } catch (e) {
        console.error('Failed to load saved state:', e)
      }
    }
  }, [])

  const handleSave = () => {
    const data = {
      dimensions,
      shapeMode,
      polygonPoints,
      confirmedPolygon,
      placedBuildings,
      activeComparisons
    }
    localStorage.setItem('landVisualizer', JSON.stringify(data))
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus(null), 2000)
  }

  const handleClearSaved = () => {
    localStorage.removeItem('landVisualizer')
    // Reset to defaults
    setDimensions({ length: 20, width: 15 })
    setInputValues({ length: '20', width: '15' })
    setShapeMode('rectangle')
    setPolygonPoints([])
    setConfirmedPolygon(null)
    setPlacedBuildings([])
    setActiveComparisons({})
  }

  const handleExport = () => {
    const canvas = document.querySelector('canvas')
    if (canvas) {
      const link = document.createElement('a')
      link.download = 'land-visualization.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    }
  }

  return (
    <div className="w-full h-full relative">
      <LandScene
        length={dimensions.length}
        width={dimensions.width}
        isExploring={isExploring && !selectedBuilding}
        comparisonObjects={COMPARISON_OBJECTS.filter(obj => activeComparisons[obj.id])}
        polygonPoints={shapeMode === 'polygon' ? confirmedPolygon : null}
        placedBuildings={placedBuildings}
        selectedBuilding={selectedBuilding}
        onPlaceBuilding={handlePlaceBuilding}
        onDeleteBuilding={handleDeleteBuilding}
        joystickInput={joystickInput}
      />

      {/* Mobile joystick - positioned above ribbon */}
      {isTouchDevice && <VirtualJoystick joystickInput={joystickInput} />}

      {/* Backdrop overlay when panel is open */}
      {activePanel && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setActivePanel(null)}
        />
      )}

      {/* Slide-up panels */}
      <div className={`control-panel fixed left-0 right-0 bottom-14 z-50 transition-transform duration-300 ${
        activePanel ? 'translate-y-0' : 'translate-y-full pointer-events-none'
      }`}>
        <div className="mx-4 mb-2 bg-black/70 backdrop-blur-md rounded-xl p-4 text-white max-h-[60vh] overflow-y-auto">
          {/* Land Panel */}
          {activePanel === 'land' && (
            <div>
              <h2 className="text-sm font-semibold mb-3">Your Land</h2>

              {/* Mode toggle */}
              <div className="flex gap-1 mb-3 bg-white/10 rounded p-0.5">
                <button
                  onClick={() => setShapeMode('rectangle')}
                  className={`flex-1 text-xs py-1.5 rounded transition-colors ${
                    shapeMode === 'rectangle' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Rectangle
                </button>
                <button
                  onClick={() => setShapeMode('polygon')}
                  className={`flex-1 text-xs py-1.5 rounded transition-colors ${
                    shapeMode === 'polygon' ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Custom Shape
                </button>
              </div>

              {shapeMode === 'rectangle' ? (
                <>
                  <div className="text-xs text-white/60 mb-2">Enter your land dimensions</div>
                  <div className="flex gap-2 mb-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        value={inputValues.length}
                        onChange={(e) => handleInputChange('length', e.target.value)}
                        onBlur={handleVisualize}
                        onKeyDown={(e) => e.key === 'Enter' && handleVisualize()}
                        placeholder="e.g. 50"
                        className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:border-white/40 placeholder:text-white/30"
                        min="1"
                        step="0.1"
                      />
                      <span className="text-xs text-white/50 mt-0.5 block">Length (m)</span>
                    </div>
                    <div className="flex-1">
                      <input
                        type="number"
                        value={inputValues.width}
                        onChange={(e) => handleInputChange('width', e.target.value)}
                        onBlur={handleVisualize}
                        onKeyDown={(e) => e.key === 'Enter' && handleVisualize()}
                        placeholder="e.g. 30"
                        className="w-full px-2 py-1.5 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:border-white/40 placeholder:text-white/30"
                        min="1"
                        step="0.1"
                      />
                      <span className="text-xs text-white/50 mt-0.5 block">Width (m)</span>
                    </div>
                  </div>
                  <div className="text-lg font-bold">{area.toFixed(0)} m²</div>
                </>
              ) : (
                <PolygonEditor
                  points={polygonPoints}
                  onChange={setPolygonPoints}
                  onComplete={handlePolygonComplete}
                  onClear={() => setConfirmedPolygon(null)}
                />
              )}
            </div>
          )}

          {/* Compare Panel */}
          {activePanel === 'compare' && (
            <div>
              <h2 className="text-sm font-semibold mb-3">Compare With</h2>
              <div className="grid grid-cols-2 gap-2">
                {COMPARISON_OBJECTS.map(obj => (
                  <label
                    key={obj.id}
                    className={`flex items-center gap-2 p-2 cursor-pointer rounded transition-colors ${
                      activeComparisons[obj.id] ? 'bg-white/20' : 'bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={activeComparisons[obj.id] || false}
                      onChange={() => toggleComparison(obj.id)}
                      className="w-4 h-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: obj.color }}
                    />
                    <span className="text-sm text-white/90">{obj.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Build Panel */}
          {activePanel === 'build' && (
            <div>
              <h2 className="text-sm font-semibold mb-2">Place Buildings</h2>
              <div className="text-xs text-white/50 mb-3">
                {selectedBuilding ? 'Click on land to place' : 'Select a building type'}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {BUILDING_TYPES.map(building => (
                  <button
                    key={building.id}
                    onClick={() => {
                      setSelectedBuilding(selectedBuilding === building.id ? null : building.id)
                      if (selectedBuilding !== building.id) setActivePanel(null)
                    }}
                    className={`p-2 text-sm rounded text-left transition-colors ${
                      selectedBuilding === building.id
                        ? 'bg-green-600 text-white'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: building.color }}
                      />
                      <span>{building.name}</span>
                    </div>
                  </button>
                ))}
              </div>
              {placedBuildings.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between">
                  <span className="text-xs text-white/60">
                    {placedBuildings.length} building{placedBuildings.length !== 1 ? 's' : ''} placed
                  </span>
                  <button
                    onClick={() => setPlacedBuildings([])}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom ribbon navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-md border-t border-white/10">
        <div className="flex justify-around items-center h-14">
          <button
            onClick={() => togglePanel('land')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activePanel === 'land' ? 'text-white bg-white/10' : 'text-white/60 hover:text-white'
            }`}
          >
            <span className="text-lg">🏠</span>
            <span className="text-xs mt-0.5">Land</span>
          </button>

          <button
            onClick={() => togglePanel('compare')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activePanel === 'compare' ? 'text-white bg-white/10' : 'text-white/60 hover:text-white'
            }`}
          >
            <span className="text-lg">📊</span>
            <span className="text-xs mt-0.5">Compare</span>
          </button>

          <button
            onClick={() => togglePanel('build')}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              activePanel === 'build' ? 'text-white bg-white/10' : 'text-white/60 hover:text-white'
            }`}
          >
            <span className="text-lg">🏗️</span>
            <span className="text-xs mt-0.5">Build</span>
          </button>

          <button
            onClick={handleSave}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              saveStatus === 'saved' ? 'text-green-400' : 'text-white/60 hover:text-white'
            }`}
          >
            <span className="text-lg">{saveStatus === 'saved' ? '✓' : '💾'}</span>
            <span className="text-xs mt-0.5">{saveStatus === 'saved' ? 'Saved!' : 'Save'}</span>
          </button>

          <button
            onClick={handleExport}
            className="flex flex-col items-center justify-center flex-1 h-full text-white/60 hover:text-white transition-colors"
          >
            <span className="text-lg">📷</span>
            <span className="text-xs mt-0.5">Export</span>
          </button>
        </div>
      </div>

      {/* Help text */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm text-white/80 px-4 py-2 rounded-full text-xs">
        {isTouchDevice
          ? 'Drag to look • Use joystick to move'
          : 'Click to look • WASD to move • ESC to release'
        }
      </div>

      {/* Building placement indicator */}
      {selectedBuilding && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-green-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm font-medium animate-pulse">
          Click on land to place {BUILDING_TYPES.find(b => b.id === selectedBuilding)?.name}
        </div>
      )}

      {/* Area display - top right */}
      <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm text-white px-3 py-2 rounded-lg">
        <div className="text-xs text-white/60">Area</div>
        <div className="text-lg font-bold">{area.toFixed(0)} m²</div>
      </div>
    </div>
  )
}

export default App
