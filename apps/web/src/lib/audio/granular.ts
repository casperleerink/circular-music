import { el } from "@elemaudio/core";
import type { NodeRepr_t } from "@elemaudio/core";

export type GrainEnvelope = "hann" | "trapezoid";

export interface GranularParams {
  samplePath: string; // Path in VFS (e.g., '/samples/texture')
  grainSize: number; // Grain duration in ms (10-500)
  density: number; // Grains per second (0.5-50)
  position: number; // Position in sample (0-1)
  pitch: number; // Playback rate (1 = original)
  positionSpray: number; // Position randomization (0-1)
  pitchSpray: number; // Pitch randomization (0-1)
  stereoSpread: number; // Stereo width (0-1)
  gain: number; // Master gain (0-1)
  envelope: GrainEnvelope; // Envelope shape ('hann' or 'trapezoid')
}

// Prime-ratio multipliers to prevent voice synchronization
const RATE_MULTIPLIERS = [1.0, 1.03, 0.97, 1.07, 0.93, 1.11, 0.89, 1.01];

const SAMPLE_RATE = 44100;

/**
 * Hann window envelope - smooth cosine, classic granular sound
 */
function hannEnvelope(phase: NodeRepr_t): NodeRepr_t {
  // hann(x) = 0.5 * (1 - cos(2π * x))
  return el.mul(0.5, el.sub(1, el.cos(el.mul(2 * Math.PI, phase))));
}

/**
 * Trapezoid envelope - 10% attack, 80% sustain, 10% release
 * Sounds "fuller" with more of the original sample audible
 */
function trapezoidEnvelope(phase: NodeRepr_t): NodeRepr_t {
  // Attack: ramp from 0 to 1 over first 10%
  const attack = el.min(1, el.div(phase, 0.1));
  // Release: ramp from 1 to 0 over last 10% (when phase > 0.9)
  const release = el.min(
    1,
    el.div(el.sub(1, phase), 0.1)
  );
  // Envelope is minimum of attack and release ramps
  return el.min(attack, release);
}

/**
 * Get grain envelope based on type
 */
function grainEnvelope(phase: NodeRepr_t, type: GrainEnvelope): NodeRepr_t {
  if (type === "trapezoid") {
    return trapezoidEnvelope(phase);
  }
  return hannEnvelope(phase);
}

/**
 * Creates a single grain voice
 */
function createGrainVoice(
  voiceKey: string,
  voiceIndex: number,
  params: GranularParams,
  sampleLengthSamples: number
): { left: NodeRepr_t; right: NodeRepr_t } {
  const {
    samplePath,
    grainSize,
    density,
    position,
    pitch,
    positionSpray,
    pitchSpray,
    stereoSpread,
    envelope,
  } = params;

  // Calculate grain size in samples
  const grainSizeSamples = (grainSize / 1000) * SAMPLE_RATE;

  // Voice-specific trigger rate with prime-ratio offset
  const voiceTriggerHz = (density / 8) * RATE_MULTIPLIERS[voiceIndex];
  const trigger = el.train(voiceTriggerHz);

  // Latch random values on each trigger for spray parameters
  const posRand = el.latch(trigger, el.rand({ key: `${voiceKey}:posRand` }));
  const pitchRand = el.latch(trigger, el.rand({ key: `${voiceKey}:pitchRand` }));
  const panRand = el.latch(trigger, el.rand({ key: `${voiceKey}:panRand` }));

  // Calculate position offset with spray (bipolar: -spray to +spray)
  const posOffset = el.mul(positionSpray, el.sub(el.mul(2, posRand), 1));
  const grainPosition = el.add(position, posOffset);

  // Clamp position to valid range [0, 1]
  const clampedPosition = el.max(0, el.min(1, grainPosition));

  // Calculate pitch multiplier with spray
  // pitchSpray affects pitch by semitones, convert to ratio
  // 12 semitones = 1 octave, each semitone is 2^(1/12) ratio
  const pitchOffset = el.mul(
    el.mul(pitchSpray, 0.5), // Scale spray to reasonable range
    el.sub(el.mul(2, pitchRand), 1) // Bipolar random
  );
  const pitchRatio = el.mul(pitch, el.add(1, pitchOffset));

  // Phase increment: how much to advance through grain per sample
  // pitchRatio affects playback speed
  const phaseIncrement = el.div(pitchRatio, grainSizeSamples);

  // Phase accumulator that resets on trigger
  // This creates a 0→1+ ramp for each grain
  const phase = el.accum(phaseIncrement, trigger);

  // Grain is active while phase < 1
  const grainActive = el.le(phase, 1);

  // Calculate sample read position
  // Base position in samples + grain phase offset
  const baseSamplePos = el.mul(clampedPosition, sampleLengthSamples);
  const grainLengthInSamples = el.mul(
    el.div(grainSizeSamples, pitch),
    pitchRatio
  );
  const sampleOffset = el.mul(phase, grainLengthInSamples);
  const readPosition = el.add(baseSamplePos, sampleOffset);

  // Normalize read position to 0-1 range for el.table
  // Wrap around if we exceed sample length
  const normalizedReadPos = el.mod(
    el.div(readPosition, sampleLengthSamples),
    1
  );

  // Read from sample table
  const sampleValue = el.table({ path: samplePath }, normalizedReadPos);

  // Apply envelope
  const env = grainEnvelope(phase, envelope);
  const gatedEnv = el.mul(env, grainActive);

  // Apply envelope to sample
  const grainOutput = el.mul(sampleValue, gatedEnv);

  // Stereo panning with equal-power law
  // Pan position: 0.5 = center, 0 = left, 1 = right
  // Apply stereo spread to random pan value
  const panCenter = 0.5;
  const panOffset = el.mul(stereoSpread, el.sub(panRand, 0.5));
  const panPosition = el.add(panCenter, panOffset);

  // Equal-power pan: L = cos(θ), R = sin(θ) where θ = pan * π/2
  const panAngle = el.mul(panPosition, Math.PI / 2);
  const leftGain = el.cos(panAngle);
  const rightGain = el.sin(panAngle);

  return {
    left: el.mul(grainOutput, leftGain),
    right: el.mul(grainOutput, rightGain),
  };
}

/**
 * Creates an 8-voice granular synthesizer
 *
 * @param key - Unique key for this granular instance
 * @param params - Granular synthesis parameters
 * @param sampleLengthSamples - Length of the sample in samples
 * @returns Stereo output signals
 */
export function createGranular(
  key: string,
  params: GranularParams,
  sampleLengthSamples: number
): { left: NodeRepr_t; right: NodeRepr_t } {
  // Create 8 grain voices
  const voices: { left: NodeRepr_t; right: NodeRepr_t }[] = [];

  for (let i = 0; i < 8; i++) {
    const voiceKey = `${key}:v${i}`;
    voices.push(createGrainVoice(voiceKey, i, params, sampleLengthSamples));
  }

  // Sum all voice outputs
  let leftSum = voices[0].left;
  let rightSum = voices[0].right;

  for (let i = 1; i < voices.length; i++) {
    leftSum = el.add(leftSum, voices[i].left);
    rightSum = el.add(rightSum, voices[i].right);
  }

  // Apply master gain with smoothing to prevent clicks
  const smoothedGain = el.smooth(
    el.tau2pole(0.02),
    el.const({ key: `${key}:gain`, value: params.gain })
  );

  return {
    left: el.mul(smoothedGain, leftSum),
    right: el.mul(smoothedGain, rightSum),
  };
}
