import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";

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

// Simplified noise for CPU-side height sampling (3-octave, no domain warp)
function hash12(x: number, y: number): number {
  let px = (x * 0.1031) % 1;
  let py = (y * 0.1031) % 1;
  let pz = (x * 0.1031) % 1;
  if (px < 0) px += 1;
  if (py < 0) py += 1;
  if (pz < 0) pz += 1;
  const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  return ((px + py + d) * (pz + d)) % 1;
}

function vnoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const a = hash12(ix, iy);
  const b = hash12(ix + 1, iy);
  const c = hash12(ix, iy + 1);
  const d = hash12(ix + 1, iy + 1);
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * ux + (c - a) * uy * (1 - ux) + (d - b) * ux * uy;
}

function fbm3(x: number, y: number): number {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < 3; i++) {
    v += a * vnoise(x, y);
    // Simple rotation
    const nx = 0.8 * x + 0.6 * y;
    const ny = -0.6 * x + 0.8 * y;
    x = nx * 2;
    y = ny * 2;
    a *= 0.5;
  }
  return v;
}

function sampleHeight(wx: number, wz: number): number {
  const freq = 0.6;
  const anisotropy = 3.0;
  const angle = 0.4;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const rx = ca * wx + sa * wz;
  const ry = (-sa * wx + ca * wz) * anisotropy;
  return fbm3(rx * freq, ry * freq) * 0.35;
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
