import type { ResonatorParams } from "./resonator";

/**
 * Each resonator band independently holds a random pitch from the melody
 * for a long duration, then slowly drifts to a new one.
 *
 * Band 1: fundamental, changes every ~20s
 * Band 2: octave up + detune, changes every ~27s
 * Band 3: 12th above + detune, changes every ~23s
 */

const MELODY_MIDI: number[] = [68, 66, 69, 64, 63, 61, 71, 73];

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function detuneCents(freq: number, cents: number): number {
  return freq * Math.pow(2, cents / 1200);
}

// Simple deterministic hash for picking pitches
function pick(band: number, period: number): number {
  const hash = ((band * 7919 + period * 104729) ^ 0x5bd1e995) >>> 0;
  return MELODY_MIDI[hash % MELODY_MIDI.length];
}

// Hold durations per band (seconds) — staggered so they don't all shift at once
const HOLD_DURATIONS = [45, 61, 53];

/**
 * Get resonator parameters at a given time.
 * Each band independently holds a random pitch.
 */
export function getResonatorParamsAtTime(time: number): ResonatorParams {
  const t = Math.max(0, time);

  const bandFreqs = HOLD_DURATIONS.map((dur, i) => {
    const period = Math.floor(t / dur);
    const midi = pick(i, period);
    return midiToFreq(midi);
  });

  return {
    bands: [
      { freq: bandFreqs[0], q: 80, gain: 0.8 },
      { freq: detuneCents(bandFreqs[1] * 2, 7), q: 80, gain: 0.6 },
      { freq: detuneCents(bandFreqs[2] * 3, -5), q: 80, gain: 0.4 },
    ],
    mix: 0.7,
  };
}

/**
 * Returns the next time (in seconds) any band will change pitch, given current time.
 */
export function getNextChangeTime(time: number): number {
  const t = Math.max(0, time);
  return Math.min(
    ...HOLD_DURATIONS.map((dur) => {
      const period = Math.floor(t / dur);
      return (period + 1) * dur;
    })
  );
}
