import { el } from "@elemaudio/core";
import type { NodeRepr_t } from "@elemaudio/core";

export interface ResonatorBand {
  freq: number; // Hz (20-20000)
  q: number; // Q factor (50-100 recommended for high resonance)
  gain: number; // 0-1
}

export interface ResonatorParams {
  bands: [ResonatorBand, ResonatorBand, ResonatorBand];
  mix: number; // 0 = dry, 1 = wet
}

/**
 * Process a single channel through the 3-band resonator
 */
function processChannel(
  key: string,
  params: ResonatorParams,
  input: NodeRepr_t
): NodeRepr_t {
  // Create 3 bandpass filters in parallel
  const bandOutputs = params.bands.map((band, i) => {
    const freq = el.const({ key: `${key}:b${i}:freq`, value: band.freq });
    const q = el.const({ key: `${key}:b${i}:q`, value: band.q });
    const gain = el.const({ key: `${key}:b${i}:gain`, value: band.gain });

    const filtered = el.bandpass(freq, q, input);
    return el.mul(filtered, gain);
  });

  // Sum all bands
  const wet = el.add(el.add(bandOutputs[0], bandOutputs[1]), bandOutputs[2]);

  // Dry/wet mix with smoothing to prevent clicks
  const mix = el.smooth(
    el.tau2pole(0.02),
    el.const({ key: `${key}:mix`, value: params.mix })
  );
  const dry = el.mul(input, el.sub(1, mix));
  const wetMixed = el.mul(wet, mix);

  return el.add(dry, wetMixed);
}

/**
 * Creates a 3-band parallel resonator effect
 *
 * High-Q bandpass filters cause incoming audio to "ring" at their tuned
 * frequencies, creating sympathetic resonance effects.
 *
 * @param key - Unique key for this resonator instance
 * @param params - Resonator parameters (bands and mix)
 * @param input - Stereo input signals
 * @returns Stereo output signals
 */
export function createResonator(
  key: string,
  params: ResonatorParams,
  input: { left: NodeRepr_t; right: NodeRepr_t }
): { left: NodeRepr_t; right: NodeRepr_t } {
  // Process each channel through the resonator bank
  const left = processChannel(`${key}:L`, params, input.left);
  const right = processChannel(`${key}:R`, params, input.right);
  return { left, right };
}
