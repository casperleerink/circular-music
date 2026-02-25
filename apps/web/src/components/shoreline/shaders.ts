export const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uHeightScale;
uniform float uFrequency;
uniform float uAnisotropy;
uniform float uRidgeAngle;
uniform float uTimeScale;
uniform float uRidgeCurve;
uniform float uRidgeCurveFreq;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vHeight;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
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
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    v += a * vnoise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}

float getHeight(vec2 pos) {
  float t = uTime * uTimeScale;

  // Anisotropic scaling — stretch along ridge angle for "combed" look
  float ca = cos(uRidgeAngle);
  float sa = sin(uRidgeAngle);
  mat2 ridgeRot = mat2(ca, sa, -sa, ca);
  vec2 p = ridgeRot * pos * uFrequency;
  p.y *= uAnisotropy;

  // Curve the ridges: displace cross-ridge (x) based on along-ridge (y) position
  float curveNoise = fbm(vec2(p.y * uRidgeCurveFreq, 0.0) + vec2(3.1, 7.4)) - 0.5;
  p.x += curveNoise * uRidgeCurve;

  // Domain warp pass 1
  vec2 q = vec2(
    fbm(p + vec2(0.0, 0.0) + t),
    fbm(p + vec2(5.2, 1.3) + t)
  );

  // Domain warp pass 2
  vec2 r = vec2(
    fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.5),
    fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.5)
  );

  return fbm(p + 4.0 * r) * uHeightScale;
}

void main() {
  vec3 pos = position;

  float h = getHeight(pos.xz);
  pos.y += h;

  // Finite-difference normals
  float eps = 0.05;
  float hR = getHeight(pos.xz + vec2(eps, 0.0));
  float hF = getHeight(pos.xz + vec2(0.0, eps));
  vec3 tangent = normalize(vec3(eps, hR - h, 0.0));
  vec3 bitangent = normalize(vec3(0.0, hF - h, eps));
  vec3 n = normalize(cross(tangent, bitangent));

  vNormal = n;
  vHeight = h;
  vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const fragmentShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying float vHeight;

uniform float uHeightScale;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;

void main() {
  vec3 normal = normalize(vNormal);

  // Base colors — kept very close for subtlety
  vec3 sandColor = vec3(0.97, 0.96, 0.95);
  vec3 shadowTint = vec3(0.955, 0.955, 0.96);

  // Primary grazing light — low angle to reveal ridges
  vec3 lightDir = normalize(vec3(1.0, 0.4, 0.3));
  float diff = max(dot(normal, lightDir), 0.0);
  diff = pow(diff, 1.5); // gentle falloff

  // Secondary fill light from opposite side
  vec3 fillDir = normalize(vec3(-0.7, 0.3, -0.5));
  float fill = max(dot(normal, fillDir), 0.0) * 0.15;

  // Height-based ambient occlusion (groove floors darker)
  float heightNorm = vHeight / uHeightScale;
  float ao = mix(0.92, 1.0, smoothstep(0.0, 0.5, heightNorm));

  // Rim/fresnel highlight on ridge crests
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
  fresnel = pow(fresnel, 3.0) * 0.03;

  // Combine lighting
  float lighting = (diff + fill) * ao;
  vec3 color = mix(shadowTint, sandColor, lighting);
  color += fresnel;

  // Distance fog — blend to background
  float dist = length(cameraPosition - vWorldPosition);
  float fogFactor = smoothstep(uFogNear, uFogFar, dist);
  color = mix(color, uFogColor, fogFactor);

  gl_FragColor = vec4(color, 1.0);
}
`;
