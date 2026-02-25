import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { sampleHeight } from "./noise";

const PEBBLE_COUNT = 2000;
const PLANE_SIZE = 80;

// Seeded PRNG (mulberry32)
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Pebbles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.008, 5, 3);
    geo.scale(1, 0.3, 1); // flatten
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#D4D0CC",
        roughness: 0.9,
        metalness: 0,
      }),
    [],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const rand = mulberry32(42);
    const dummy = new THREE.Object3D();
    const half = PLANE_SIZE / 2;

    for (let i = 0; i < PEBBLE_COUNT; i++) {
      const x = rand() * PLANE_SIZE - half;
      const z = rand() * PLANE_SIZE - half;
      const y = sampleHeight(x, z);

      dummy.position.set(x, y, z);
      dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, 0);
      const s = 0.4 + rand() * 0.6;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, PEBBLE_COUNT]}
    />
  );
}
