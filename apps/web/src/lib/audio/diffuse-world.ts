import { el } from "@elemaudio/core";
import type { NodeRepr_t } from "@elemaudio/core";

/**
 * Diffuse World: The first macro-state
 *
 * Characteristics:
 * - Wideband noise bursts with random timing
 * - Random bandpass center frequencies (200-4000 Hz)
 * - Bursts vary in length (20-200ms)
 * - Filters sweep unpredictably
 * - Sparse — lots of silence between events
 * - Feeling: vapor, static, searching
 *
 * Agency: Unreliable — actions dissipate, space doesn't "hold" intention
 */

interface DiffuseVoiceOptions {
  key: string;
  // Voice-specific parameters for variety
  triggerRate: number; // Hz - how often to potentially trigger
  probability: number; // 0-1 - chance of triggering on each pulse
  minFreq: number; // Hz - minimum bandpass center
  maxFreq: number; // Hz - maximum bandpass center
  burstDuration: number; // ticks - duration of burst envelope (at 1000 ticks/sec)
  gain: number; // 0-1 - voice volume
}

/**
 * Creates a single sparse voice that randomly triggers noise bursts
 */
function createDiffuseVoice(options: DiffuseVoiceOptions): NodeRepr_t {
  const { key, triggerRate, probability, minFreq, maxFreq, burstDuration, gain } =
    options;

  // Pulse train for triggering events
  const clock = el.train(triggerRate);

  // Latch random values on each clock pulse to decide if we trigger
  // el.rand() generates audio-rate noise, latch samples it on clock edges
  const triggerChance = el.latch(clock, el.rand({ key: `${key}:chance-rand` }));

  // Gate opens when random value is below probability threshold
  const shouldTrigger = el.le(triggerChance, el.const({ value: probability }));

  // Combined trigger: clock pulse AND probability check
  const trigger = el.and(clock, shouldTrigger);

  // Random filter center frequency - latched on trigger
  const freqRange = maxFreq - minFreq;
  const randFreqNorm = el.latch(trigger, el.rand({ key: `${key}:freq-rand` }));
  const filterFreq = el.add(minFreq, el.mul(randFreqNorm, freqRange));

  // Slow sweep on top of the latched value for movement
  // Use a slow LFO at a fixed but unique rate per voice
  const sweepRate = 0.3 + (triggerRate * 0.1); // Varies based on voice
  const sweepMod = el.mul(200, el.cycle(sweepRate));
  const movingFilterFreq = el.add(filterFreq, sweepMod);

  // Random Q factor - wide bandwidth (0.3-0.8 for diffuse character)
  const randQ = el.latch(trigger, el.rand({ key: `${key}:q-rand` }));
  const q = el.add(0.3, el.mul(randQ, 0.5));

  // Burst envelope using sparseq
  // Quick attack, variable hold, fade out
  const attackTime = 5; // 5ms attack
  const decayTime = Math.floor(burstDuration * 0.3);
  const endTime = burstDuration;

  const env = el.sparseq(
    {
      key: `${key}:env`,
      seq: [
        { value: 0, tickTime: 0 },
        { value: 1, tickTime: attackTime },
        { value: 0.6, tickTime: decayTime },
        { value: 0, tickTime: endTime },
      ],
    },
    el.train(1000), // 1000 ticks per second
    trigger
  );

  // Smooth the envelope to avoid clicks
  const smoothedEnv = el.smooth(el.tau2pole(0.005), env);

  // Noise source
  const noise = el.pinknoise({ key: `${key}:noise` });

  // Bandpass filter with random, moving center frequency
  const filtered = el.bandpass(movingFilterFreq, q, noise);

  // Apply envelope and gain
  const output = el.mul(gain, smoothedEnv, filtered);

  return output;
}

export interface DiffuseWorldState {
  // Seed used for variation - change to get different random behavior
  seed: number;
}

/**
 * Creates the complete Diffuse World soundscape
 *
 * Uses multiple overlapping sparse voices with prime-ratio trigger rates
 * to avoid periodic patterns and create truly unpredictable sparse events.
 */
export function createDiffuseWorld(
  key: string,
  active: boolean,
  _state?: DiffuseWorldState
): NodeRepr_t {
  if (!active) {
    return el.const({ value: 0 });
  }

  // Multiple voices with irrational/prime-ratio trigger rates
  // This prevents periodic patterns from emerging
  const voices: NodeRepr_t[] = [
    // Voice 1: Low, slow, rare
    createDiffuseVoice({
      key: `${key}:v1`,
      triggerRate: 0.7,
      probability: 0.25,
      minFreq: 200,
      maxFreq: 800,
      burstDuration: 180,
      gain: 0.15,
    }),

    // Voice 2: Mid, medium speed
    createDiffuseVoice({
      key: `${key}:v2`,
      triggerRate: 1.3,
      probability: 0.2,
      minFreq: 600,
      maxFreq: 2000,
      burstDuration: 100,
      gain: 0.12,
    }),

    // Voice 3: High, quicker, sparse
    createDiffuseVoice({
      key: `${key}:v3`,
      triggerRate: 2.1,
      probability: 0.15,
      minFreq: 1500,
      maxFreq: 4000,
      burstDuration: 60,
      gain: 0.08,
    }),

    // Voice 4: Very sparse low rumbles
    createDiffuseVoice({
      key: `${key}:v4`,
      triggerRate: 0.4,
      probability: 0.3,
      minFreq: 150,
      maxFreq: 400,
      burstDuration: 200,
      gain: 0.1,
    }),

    // Voice 5: Quick high blips, very sparse
    createDiffuseVoice({
      key: `${key}:v5`,
      triggerRate: 3.7,
      probability: 0.08,
      minFreq: 2500,
      maxFreq: 5000,
      burstDuration: 30,
      gain: 0.06,
    }),
  ];

  // Mix all voices
  let mix = voices[0];
  for (let i = 1; i < voices.length; i++) {
    mix = el.add(mix, voices[i]);
  }

  // Master gain for the diffuse world
  const masterGain = 0.6;

  // Subtle reverb tail for spaciousness
  const dry = el.mul(masterGain, mix);

  // Simple delay-based reverb
  const d1 = el.delay({ size: 44100 }, el.ms2samps(31), 0.4, dry);
  const d2 = el.delay({ size: 44100 }, el.ms2samps(47), 0.35, dry);
  const d3 = el.delay({ size: 44100 }, el.ms2samps(71), 0.3, dry);

  const reverbMix = el.add(d1, el.add(d2, d3));
  const warmReverb = el.lowpass(2500, 0.5, reverbMix);

  // Combine dry + wet (more wet for diffuse, spacey feel)
  const output = el.add(dry, el.mul(warmReverb, 0.5));

  return output;
}
