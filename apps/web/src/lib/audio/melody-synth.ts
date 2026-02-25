import { el } from "@elemaudio/core";
import type { NodeRepr_t } from "@elemaudio/core";

/**
 * Melody Synth — plays the circular melody from MIDI data
 *
 * Uses el.sparseq to sequence frequency and gate values,
 * looping via a periodic reset trigger.
 *
 * Synth voice: sine + detuned sine for warmth, smoothed gate envelope,
 * subtle delay reverb.
 */

// MIDI note data extracted from "Melody for circular.mid"
// 80 BPM, 480 ticks/beat → tick rate = 640 Hz
const TICK_RATE = 640;
const TOTAL_TICKS = 15360; // 32 beats at 480 ticks/beat
const LOOP_DURATION = TOTAL_TICKS / TICK_RATE; // 24 seconds

interface MidiNote {
  note: number;
  vel: number;
  startTick: number;
  endTick: number;
}

const MELODY_NOTES: MidiNote[] = [
  { note: 68, vel: 80, startTick: 0, endTick: 599 },
  { note: 66, vel: 80, startTick: 600, endTick: 719 },
  { note: 68, vel: 80, startTick: 720, endTick: 839 },
  { note: 69, vel: 80, startTick: 840, endTick: 959 },
  { note: 68, vel: 80, startTick: 960, endTick: 1079 },
  { note: 66, vel: 80, startTick: 1080, endTick: 1199 },
  { note: 64, vel: 80, startTick: 1200, endTick: 1919 },
  { note: 64, vel: 80, startTick: 1920, endTick: 2519 },
  { note: 63, vel: 80, startTick: 2520, endTick: 2639 },
  { note: 64, vel: 80, startTick: 2640, endTick: 2759 },
  { note: 66, vel: 80, startTick: 2760, endTick: 2879 },
  { note: 64, vel: 80, startTick: 2880, endTick: 2999 },
  { note: 63, vel: 80, startTick: 3000, endTick: 3119 },
  { note: 61, vel: 80, startTick: 3120, endTick: 3839 },
  // Phrase 2 (peak: B4)
  { note: 68, vel: 80, startTick: 5760, endTick: 6359 },
  { note: 66, vel: 80, startTick: 6360, endTick: 6479 },
  { note: 68, vel: 80, startTick: 6480, endTick: 6599 },
  { note: 71, vel: 80, startTick: 6600, endTick: 6719 },
  { note: 68, vel: 80, startTick: 6720, endTick: 6839 },
  { note: 66, vel: 80, startTick: 6840, endTick: 6959 },
  { note: 64, vel: 80, startTick: 6960, endTick: 7679 },
  { note: 64, vel: 80, startTick: 7680, endTick: 8279 },
  { note: 63, vel: 80, startTick: 8280, endTick: 8399 },
  { note: 64, vel: 80, startTick: 8400, endTick: 8519 },
  { note: 68, vel: 80, startTick: 8520, endTick: 8639 },
  { note: 64, vel: 80, startTick: 8640, endTick: 8759 },
  { note: 63, vel: 80, startTick: 8760, endTick: 8879 },
  { note: 61, vel: 80, startTick: 8880, endTick: 9599 },
  // Phrase 3 (peak: C#5)
  { note: 68, vel: 80, startTick: 11520, endTick: 12119 },
  { note: 66, vel: 80, startTick: 12120, endTick: 12239 },
  { note: 68, vel: 80, startTick: 12240, endTick: 12359 },
  { note: 73, vel: 80, startTick: 12360, endTick: 12479 },
  { note: 68, vel: 80, startTick: 12480, endTick: 12599 },
  { note: 66, vel: 80, startTick: 12600, endTick: 12719 },
  { note: 64, vel: 80, startTick: 12720, endTick: 13439 },
  { note: 64, vel: 80, startTick: 13440, endTick: 14039 },
  { note: 63, vel: 80, startTick: 14040, endTick: 14159 },
  { note: 64, vel: 80, startTick: 14160, endTick: 14279 },
  { note: 71, vel: 80, startTick: 14280, endTick: 14399 },
  { note: 64, vel: 80, startTick: 14400, endTick: 14519 },
  { note: 63, vel: 80, startTick: 14520, endTick: 14639 },
  { note: 61, vel: 80, startTick: 14640, endTick: 15359 },
];

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// Pre-build sparseq sequences
function buildFreqSeq(): Array<{ value: number; tickTime: number }> {
  return MELODY_NOTES.map((n) => ({
    value: midiToFreq(n.note),
    tickTime: n.startTick,
  }));
}

function buildGateSeq(): Array<{ value: number; tickTime: number }> {
  const seq: Array<{ value: number; tickTime: number }> = [];
  seq.push({ value: 0, tickTime: 0 });
  for (const n of MELODY_NOTES) {
    seq.push({ value: 1, tickTime: n.startTick });
    // Small gap before end to allow re-trigger of same note
    seq.push({ value: 0, tickTime: n.endTick });
  }
  return seq;
}

const FREQ_SEQ = buildFreqSeq();
const GATE_SEQ = buildGateSeq();

export type MelodyWaveform = "sine" | "triangle" | "square";

export interface MelodySynthParams {
  /** Oscillator waveform */
  waveform: MelodyWaveform;
  /** Detune amount for second oscillator in cents (0-50) */
  detune: number;
  /** Attack time in seconds */
  attack: number;
  /** Release time in seconds */
  release: number;
  /** Reverb wet amount (0-1) */
  reverbMix: number;
  /** Master gain (0-1) */
  gain: number;
  /** Filter base cutoff in Hz (the "closed" frequency) */
  filterCutoff: number;
  /** Filter envelope amount — how far the cutoff opens on note-on, in Hz */
  filterEnvAmount: number;
  /** Filter envelope attack in seconds */
  filterAttack: number;
  /** Filter envelope release in seconds */
  filterRelease: number;
  /** Filter resonance (Q) — higher = more resonant peak */
  filterQ: number;
}

export const DEFAULT_MELODY_PARAMS: MelodySynthParams = {
  waveform: "sine",
  detune: 6,
  attack: 0.02,
  release: 0.08,
  reverbMix: 0.35,
  gain: 0.4,
  filterCutoff: 800,
  filterEnvAmount: 3500,
  filterAttack: 0.01,
  filterRelease: 0.25,
  filterQ: 1.5,
};

function createOsc(
  waveform: MelodyWaveform,
  freq: NodeRepr_t,
): NodeRepr_t {
  switch (waveform) {
    case "sine":
      return el.cycle(freq);
    case "triangle":
      return el.bleptriangle(freq);
    case "square":
      return el.blepsquare(freq);
  }
}

export function createMelodySynth(
  key: string,
  params: MelodySynthParams,
): { left: NodeRepr_t; right: NodeRepr_t } {
  const {
    waveform,
    detune,
    attack,
    release,
    reverbMix,
    gain,
    filterCutoff,
    filterEnvAmount,
    filterAttack,
    filterRelease,
    filterQ,
  } = params;

  // Tick clock for sparseq
  const clock = el.train(TICK_RATE);

  // Loop reset trigger — fires once per loop duration
  const loopTrigger = el.train(1 / LOOP_DURATION);

  // Frequency sequencer
  const freq = el.sparseq(
    { key: `${key}:freq`, seq: FREQ_SEQ },
    clock,
    loopTrigger,
  );

  // Smooth frequency to avoid clicks on note transitions
  const smoothFreq = el.smooth(el.tau2pole(0.005), freq);

  // Gate sequencer
  const gate = el.sparseq(
    { key: `${key}:gate`, seq: GATE_SEQ },
    clock,
    loopTrigger,
  );

  // ADSR envelope: attack, minimal decay, full sustain, release
  const env = el.adsr(attack, 0.01, 1, release, gate);

  // Main oscillator
  const osc1 = createOsc(waveform, smoothFreq);

  // Detuned second oscillator for warmth
  const detuneRatio = Math.pow(2, detune / 1200);
  const detunedFreq = el.mul(smoothFreq, detuneRatio);
  const osc2 = createOsc(waveform, detunedFreq);

  // Mix oscillators (main slightly louder)
  const oscMix = el.add(el.mul(0.6, osc1), el.mul(0.4, osc2));

  // Apply envelope
  const voiced = el.mul(oscMix, env, gain);

  // Envelope-modulated lowpass filter (classic analog subtractive sound)
  // Separate filter envelope with its own attack/release for that "wah" character
  const filterEnv = el.adsr(filterAttack, 0.1, 0.3, filterRelease, gate);
  const cutoff = el.add(
    el.const({ key: `${key}:lpfBase`, value: filterCutoff }),
    el.mul(el.const({ key: `${key}:lpfEnv`, value: filterEnvAmount }), filterEnv),
  );
  const smoothCutoff = el.smooth(el.tau2pole(0.005), cutoff);
  const filtered = el.lowpass(smoothCutoff, filterQ, voiced);

  // Delay reverb (similar to diffuse-world style)
  const d1 = el.delay({ size: 44100 }, el.ms2samps(53), 0.3, filtered);
  const d2 = el.delay({ size: 44100 }, el.ms2samps(79), 0.25, filtered);
  const d3 = el.delay({ size: 44100 }, el.ms2samps(113), 0.2, filtered);

  const reverbTail = el.add(d1, el.add(d2, d3));
  const warmReverb = el.lowpass(3000, 0.5, reverbTail);

  // Stereo spread: slightly offset reverb L/R
  const reverbL = warmReverb;
  const reverbR = el.delay({ size: 44100 }, el.ms2samps(7), 0, warmReverb);

  // Mix dry + wet
  const dryAmount = 1 - reverbMix;
  const left = el.add(el.mul(dryAmount, filtered), el.mul(reverbMix, reverbL));
  const right = el.add(
    el.mul(dryAmount, filtered),
    el.mul(reverbMix, reverbR),
  );

  return { left, right };
}
