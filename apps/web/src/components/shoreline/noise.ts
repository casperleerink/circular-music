// Simplified noise for CPU-side height sampling (3-octave, no domain warp)
export function hash12(x: number, y: number): number {
  let px = (x * 0.1031) % 1;
  let py = (y * 0.1031) % 1;
  let pz = (x * 0.1031) % 1;
  if (px < 0) px += 1;
  if (py < 0) py += 1;
  if (pz < 0) pz += 1;
  const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  return ((px + py + d) * (pz + d)) % 1;
}

export function vnoise(x: number, y: number): number {
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

export function fbm3(x: number, y: number): number {
  let v = 0;
  let a = 0.5;
  let cx = x;
  let cy = y;
  for (let i = 0; i < 3; i++) {
    v += a * vnoise(cx, cy);
    const nx = 0.8 * cx + 0.6 * cy;
    const ny = -0.6 * cx + 0.8 * cy;
    cx = nx * 2;
    cy = ny * 2;
    a *= 0.5;
  }
  return v;
}

export function sampleHeight(wx: number, wz: number): number {
  const freq = 0.6;
  const anisotropy = 3.0;
  const angle = 0.4;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const rx = ca * wx + sa * wz;
  const ry = (-sa * wx + ca * wz) * anisotropy;
  return fbm3(rx * freq, ry * freq) * 0.35;
}
