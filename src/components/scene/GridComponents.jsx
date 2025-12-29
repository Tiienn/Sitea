import { useMemo } from 'react'
import { Text, Billboard } from '@react-three/drei'
import { PREVIEW_COLOR_VALID } from '../../constants/landSceneConstants'

// Grid overlay for snap-to-grid visual feedback
export function GridOverlay({ visible, gridSize = 1, size = 200 }) {
  if (!visible) return null

  const lines = useMemo(() => {
    const result = []
    const halfSize = size / 2

    // Create grid lines
    for (let i = -halfSize; i <= halfSize; i += gridSize) {
      const isMajor = Math.abs(i % 5) < 0.001 // Major line every 5m

      // Vertical lines (along Z axis)
      result.push({
        key: `v${i}`,
        points: [i, 0.02, -halfSize, i, 0.02, halfSize],
        opacity: isMajor ? 0.25 : 0.12,
      })

      // Horizontal lines (along X axis)
      result.push({
        key: `h${i}`,
        points: [-halfSize, 0.02, i, halfSize, 0.02, i],
        opacity: isMajor ? 0.25 : 0.12,
      })
    }
    return result
  }, [gridSize, size])

  return (
    <group>
      {lines.map(line => (
        <line key={line.key}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array(line.points)}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color="#FFFFFF"
            transparent
            opacity={line.opacity}
            depthWrite={false}
          />
        </line>
      ))}
    </group>
  )
}

// CAD-style dot grid for 2D mode
export function CADDotGrid({ size = 100, spacing = 2 }) {
  const dots = useMemo(() => {
    const positions = []
    const halfSize = size / 2
    for (let x = -halfSize; x <= halfSize; x += spacing) {
      for (let z = -halfSize; z <= halfSize; z += spacing) {
        positions.push(x, 0.05, z)
      }
    }
    return new Float32Array(positions)
  }, [size, spacing])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={dots.length / 3}
          array={dots}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#3a3a3a" size={2} sizeAttenuation={false} />
    </points>
  )
}

// Preview dimension label - billboard text with outline for build previews
export function PreviewDimensionLabel({ position, text, color = PREVIEW_COLOR_VALID, fontSize = 0.4 }) {
  return (
    <Billboard position={position} follow={true}>
      <Text
        fontSize={fontSize}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {text}
      </Text>
    </Billboard>
  )
}
