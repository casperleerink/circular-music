import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { vertexShader, fragmentShader } from "./shaders";

export function ShorelineMesh() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHeightScale: { value: 0.35 },
      uFrequency: { value: 0.6 },
      uAnisotropy: { value: 3.0 },
      uRidgeAngle: { value: 0.4 },
      uTimeScale: { value: 0.015 },
      uRidgeCurve: { value: 2.5 },
      uRidgeCurveFreq: { value: 0.15 },
      uFogColor: { value: new THREE.Vector3(0.96, 0.955, 0.949) },
      uFogNear: { value: 8.0 },
      uFogFar: { value: 30.0 },
    }),
    [],
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[80, 80, 512, 512]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}
