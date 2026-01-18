import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface CameraControllerProps {
  moveSpeed?: number;
}

export function CameraController({ moveSpeed = 0.5 }: CameraControllerProps) {
  const { camera } = useThree();
  const keysPressed = useRef<Set<string>>(new Set());
  const velocity = useRef(new THREE.Vector3());
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useFrame((state, delta) => {
    const keys = keysPressed.current;
    const direction = new THREE.Vector3();

    // Get camera's forward and right vectors
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
    right.normalize();

    // Arrow keys for movement
    if (keys.has("ArrowUp")) {
      direction.add(forward);
    }
    if (keys.has("ArrowDown")) {
      direction.sub(forward);
    }
    if (keys.has("ArrowLeft")) {
      direction.sub(right);
    }
    if (keys.has("ArrowRight")) {
      direction.add(right);
    }

    // Normalize and apply movement
    if (direction.length() > 0) {
      direction.normalize();
      velocity.current.lerp(direction.multiplyScalar(moveSpeed), 0.1);
    } else {
      velocity.current.lerp(new THREE.Vector3(), 0.1);
    }

    camera.position.add(velocity.current);
    if (controlsRef.current) {
      // Keep orbit "anchor" moving with the camera so rotation feels natural.
      controlsRef.current.target.add(velocity.current);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      rotateSpeed={0.6}
    />
  );
}
