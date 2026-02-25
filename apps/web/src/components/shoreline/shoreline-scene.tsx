import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { ShorelineMesh } from "./shoreline-mesh";
import { Pebbles } from "./pebbles";
import { CameraPath } from "./camera-path";

export function ShorelineScene({ started }: { started: boolean }) {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 3.5, 7], fov: 45 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
      >
        <color attach="background" args={["#F5F4F2"]} />
        <ShorelineMesh />
        <Pebbles />
        {started && <CameraPath />}
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 2, 3]} intensity={0.5} />
      </Canvas>
    </div>
  );
}
