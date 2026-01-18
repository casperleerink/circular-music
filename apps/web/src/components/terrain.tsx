import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface TerrainProps {
  /**
   * Number of tiles per side (e.g. 5 => 5x5).
   * More tiles => farther horizon, more vertices.
   */
  tilesPerSide?: number;
  /** World-space size of each tile. */
  tileSize?: number;
  /** Subdivisions per tile side (higher => more detail, more vertices). */
  segments?: number;
  heightScale?: number;
  /** Noise frequency in world units (smaller => larger features). */
  frequency?: number;
}

export function Terrain({
  tilesPerSide = 7,
  tileSize = 300,
  segments = 96,
  heightScale = 10,
  frequency = 0.004,
}: TerrainProps) {
  const { camera } = useThree();
  const tilesRef = useRef<Array<THREE.Mesh | null>>([]);
  const shaderRef = useRef<any>(null);

  // Single shared tile geometry (kept flat; we displace in the vertex shader).
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(tileSize, tileSize, segments, segments);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [tileSize, segments]);

  // Shared material with world-space procedural displacement.
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: "#2d5016",
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uHeightScale = { value: heightScale };
      shader.uniforms.uFrequency = { value: frequency };

      shader.vertexShader =
        /* glsl */ `
        uniform float uHeightScale;
        uniform float uFrequency;

        // Hash + value noise + fbm (fast, decent terrain variation)
        float hash12(vec2 p) {
          vec3 p3  = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        float noise2(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash12(i);
          float b = hash12(i + vec2(1.0, 0.0));
          float c = hash12(i + vec2(0.0, 1.0));
          float d = hash12(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          // 5 octaves
          for (int i = 0; i < 5; i++) {
            v += a * noise2(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }
      ` + shader.vertexShader;

      // Displace after `transformed` is created.
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        /* glsl */ `
          #include <begin_vertex>

          // Use world position so tiles stitch seamlessly & can be re-centered.
          vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
          vec2 wp = worldPos.xz * uFrequency;

          // Base fbm + some ridged shaping for more "terrain" feel
          float n = fbm(wp);
          float ridged = 1.0 - abs(2.0 * n - 1.0);
          float h = (n * 0.65 + ridged * 0.35);

          transformed.y += (h - 0.5) * uHeightScale;
        `
      );

      shaderRef.current = shader;
    };

    return mat;
  }, [frequency, heightScale]);

  useFrame(() => {
    const half = Math.floor(tilesPerSide / 2);
    const cx = Math.floor(camera.position.x / tileSize);
    const cz = Math.floor(camera.position.z / tileSize);

    // Re-center tiles around the camera to create an "endless" world.
    for (let zi = 0; zi < tilesPerSide; zi++) {
      for (let xi = 0; xi < tilesPerSide; xi++) {
        const idx = zi * tilesPerSide + xi;
        const tile = tilesRef.current[idx];
        if (!tile) continue;

        tile.position.set(
          (cx + xi - half) * tileSize,
          0,
          (cz + zi - half) * tileSize
        );
      }
    }

    // Keep uniforms in sync if props change.
    if (shaderRef.current) {
      shaderRef.current.uniforms.uHeightScale.value = heightScale;
      shaderRef.current.uniforms.uFrequency.value = frequency;
    }
  });

  return (
    <group>
      {Array.from({ length: tilesPerSide * tilesPerSide }).map((_, idx) => (
        <mesh
          // eslint-disable-next-line react/no-array-index-key
          key={idx}
          ref={(el) => {
            tilesRef.current[idx] = el;
          }}
          geometry={geometry}
          material={material}
          receiveShadow
        />
      ))}
    </group>
  );
}
