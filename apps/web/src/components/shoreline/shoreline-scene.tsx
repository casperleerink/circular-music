import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { ShorelineMesh } from "./shoreline-mesh";
import { Pebbles } from "./pebbles";
import { CameraPath } from "./camera-path";
import type { TimelineState } from "@/hooks/use-timeline";

export function ShorelineScene({
  started,
  timeRef,
  stateRef,
}: {
  started: boolean;
  timeRef: React.RefObject<number>;
  stateRef: React.RefObject<TimelineState>;
}) {
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
        {started && <CameraPath timeRef={timeRef} stateRef={stateRef} />}
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 2, 3]} intensity={0.5} />
      </Canvas>
    </div>
  );
}
