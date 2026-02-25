import type { ResonatorParams } from "./resonator";

/**
 * Slow melody sequence for the resonator, stretched across 30 seconds.
 *
 * Uses the 8 unique pitches from the circular melody (MIDI 61-73)
 * spread evenly, with 3 bands per note:
 *   Band 1: fundamental
 *   Band 2: octave up + slight detune
 *   Band 3: 12th above + slight detune
 */

const DURATION = 30; // seconds

// Melody notes in order of appearance (unique pitches from all 3 phrases)
const MELODY_MIDI: number[] = [68, 66, 69, 64, 63, 61, 71, 73];

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// Detune by cents
function detuneCents(freq: number, cents: number): number {
  return freq * Math.pow(2, cents / 1200);
}

const NOTE_DURATION = DURATION / MELODY_MIDI.length; // ~3.75s per note

interface NoteEntry {
  startTime: number;
  freq: number;
}

const SCHEDULE: NoteEntry[] = MELODY_MIDI.map((midi, i) => ({
  startTime: i * NOTE_DURATION,
  freq: midiToFreq(midi),
}));

/**
 * Get resonator parameters at a given time (0-30s).
 * Frequencies shift slowly through the melody pitches.
 */
export function getResonatorParamsAtTime(time: number): ResonatorParams {
  // Clamp to valid range
  const t = Math.max(0, Math.min(DURATION, time));

  // Find current note
  let noteIndex = Math.floor(t / NOTE_DURATION);
  if (noteIndex >= SCHEDULE.length) noteIndex = SCHEDULE.length - 1;

  const baseFreq = SCHEDULE[noteIndex].freq;

  return {
    bands: [
      { freq: baseFreq, q: 80, gain: 0.8 },
      { freq: detuneCents(baseFreq * 2, 7), q: 80, gain: 0.6 },
      { freq: detuneCents(baseFreq * 3, -5), q: 80, gain: 0.4 },
    ],
    mix: 0.7,
  };
}
