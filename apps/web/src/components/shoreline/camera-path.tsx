import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sampleHeight } from "./noise";

const DURATION = 120; // seconds
const HEIGHT_OFFSET = 1.0;
const LOOK_AHEAD = 0.015;
const NUM_CONTROL_POINTS = 7;

const START = new THREE.Vector3(-25, 0, 25);
const END = new THREE.Vector3(25, 0, -25);

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Ease velocity at start/end for gentle acceleration/deceleration */
function easeT(t: number): number {
  const ramp = 0.1 / DURATION; // ~100ms as fraction of duration
  if (t < ramp) return smoothstep(0, ramp, t) * t;
  if (t > 1 - ramp) {
    // mirror the ease-in for the tail
    const tail = 1 - t;
    const scale = smoothstep(0, ramp, tail);
    return 1 - scale * tail;
  }
  return t;
}

export function CameraPath() {
  const { camera } = useThree();
  const startTime = useRef<number | null>(null);
  const done = useRef(false);

  const curve = useMemo(() => {
    const dir = END.clone().sub(START);
    // perpendicular in XZ plane
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

    const points: THREE.Vector3[] = [START.clone()];
    for (let i = 1; i <= NUM_CONTROL_POINTS; i++) {
      const frac = i / (NUM_CONTROL_POINTS + 1);
      const base = START.clone().lerp(END.clone(), frac);
      const offset = (Math.random() - 0.5) * 8; // ±4 units
      base.add(perp.clone().multiplyScalar(offset));
      points.push(base);
    }
    points.push(END.clone());

    return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
  }, []);

  const lookAtTarget = useRef(new THREE.Vector3());
  const smoothY = useRef(0);
  const initialized = useRef(false);

  useFrame((_, delta) => {
    if (done.current) return;

    if (startTime.current === null) {
      startTime.current = 0;
    }
    startTime.current += delta;

    const rawT = Math.min(startTime.current / DURATION, 1);
    const t = easeT(rawT);

    // Position on spline
    const pos = curve.getPointAt(Math.min(t, 1));
    const terrainY = sampleHeight(pos.x, pos.z);

    // Smooth terrain height to avoid vertical jitter
    if (!initialized.current) {
      smoothY.current = terrainY;
      initialized.current = true;
    } else {
      // Low-pass filter on terrain height — slow blend avoids pitch wobble
      smoothY.current += (terrainY - smoothY.current) * 0.02;
    }

    pos.y = smoothY.current + HEIGHT_OFFSET;

    camera.position.copy(pos);

    // Look-ahead target — use same smoothed height (no independent terrain sample)
    const aheadT = Math.min(t + LOOK_AHEAD, 1);
    const ahead = curve.getPointAt(aheadT);
    ahead.y = pos.y; // match camera height so we look horizontally

    if (!initialized.current) {
      lookAtTarget.current.copy(ahead);
    } else {
      lookAtTarget.current.lerp(ahead, 0.05);
    }
    camera.lookAt(lookAtTarget.current);

    if (rawT >= 1) {
      done.current = true;
    }
  });

  return null;
}
