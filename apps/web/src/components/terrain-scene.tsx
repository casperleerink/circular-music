import { Canvas } from "@react-three/fiber";
import { Sky, Stars } from "@react-three/drei";
import { Terrain } from "./terrain";
import { CameraController } from "./camera-controller";

export function TerrainScene() {
  return (
    <div className="h-screen w-screen">
      <Canvas camera={{ position: [0, 15, 30], fov: 75 }} shadows>
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight
          position={[50, 50, 25]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />

        {/* Sky and stars */}
        <Sky
          distance={450000}
          sunPosition={[100, 20, 100]}
          inclination={0.6}
          azimuth={0.25}
        />
        <Stars
          radius={100}
          depth={50}
          count={5000}
          factor={4}
          saturation={0}
          fade
          speed={1}
        />

        {/* Terrain */}
        <Terrain />

        {/* Camera controls */}
        <CameraController />

        {/* Grid helper for reference (optional) */}
        {/* <gridHelper args={[100, 100]} /> */}
      </Canvas>

      {/* Instructions overlay */}
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-black/50 p-4 text-white backdrop-blur-sm">
        <h3 className="mb-2 font-semibold">Controls</h3>
        <ul className="space-y-1 text-sm">
          <li>↑ Arrow Up - Move Forward</li>
          <li>↓ Arrow Down - Move Backward</li>
          <li>← Arrow Left - Move Left</li>
          <li>→ Arrow Right - Move Right</li>
        </ul>
      </div>
    </div>
  );
}
