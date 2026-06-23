'use client'

// Subtle 3D backdrop for the auth pages. A single wireframe icosahedron
// slowly rotating with a thin orbiting ring and a sparse particle cloud.
// Lighter than the landing splash — this stays behind the form forever.
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'

function Scene() {
  const shellRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const pointsRef = useRef<THREE.Points>(null)

  const positions = (() => {
    const count = 600
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 2.4 + Math.random() * 0.8
      const t = Math.random() * Math.PI * 2
      const p = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = r * Math.sin(p) * Math.cos(t)
      arr[i * 3 + 1] = r * Math.sin(p) * Math.sin(t)
      arr[i * 3 + 2] = r * Math.cos(p)
    }
    return arr
  })()

  useFrame((_, delta) => {
    if (shellRef.current) {
      shellRef.current.rotation.y += delta * 0.12
      shellRef.current.rotation.x += delta * 0.04
    }
    if (ringRef.current) ringRef.current.rotation.z += delta * 0.3
    if (pointsRef.current) pointsRef.current.rotation.y -= delta * 0.05
  })

  return (
    <group>
      <group ref={shellRef}>
        <mesh>
          <icosahedronGeometry args={[1.4, 1]} />
          <meshBasicMaterial color="#4f46e5" wireframe transparent opacity={0.4} />
        </mesh>
      </group>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.1, 0.008, 12, 200]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.25} />
      </mesh>
      <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color="#4f46e5"
          size={0.018}
          sizeAttenuation
          depthWrite={false}
          opacity={0.5}
        />
      </Points>
    </group>
  )
}

export function AuthCanvas() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
