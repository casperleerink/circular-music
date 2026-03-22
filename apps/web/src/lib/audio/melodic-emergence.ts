import { el } from "@elemaudio/core";
import type { NodeRepr_t } from "@elemaudio/core";

/**
 * Melodic Emergence
 *
 * A melody synth built on the Sine Emergence concept: each note is born from
 * noise, crystallizes into tone, and dissolves back to noise on release.
 *
 * Architecture:
 * - Lead voice: noise↔sine crossfade driven by a per-note tonality envelope
 * - Portamento for lyrical pitch glides
 * - Delayed vibrato (ramps in after note onset, like a singer)
 * - Quiet drone pad underneath (root + 5th) with constant tonality
 * - Reverb tail
 *
 * Uses the existing MIDI melody data from the project.
 */

// --- MIDI data (from melody-synth.ts) ---
const TICK_RATE = 640;
const TOTAL_TICKS = 15360;
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

// Build sparse sequences
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
    seq.push({ value: 0, tickTime: n.endTick });
  }
  return seq;
}

const FREQ_SEQ = buildFreqSeq();
const GATE_SEQ = buildGateSeq();

// --- Parameters ---

export interface MelodicEmergenceParams {
  // Tonality envelope: how each note emerges from noise into tone
  tonalityFloor: number;    // Tonality when note starts/ends (0-1)
  tonalityCeil: number;     // Max tonality during sustained note (0-1)
  tonalityAttack: number;   // Seconds for tone to emerge from noise (0.01-2)
  tonalityRelease: number;  // Seconds for tone to dissolve back (0.01-2)

  // Amplitude envelope
  attack: number;           // Amplitude attack in seconds (0.01-1)
  release: number;          // Amplitude release in seconds (0.01-2)

  // Portamento
  portamento: number;       // Pitch glide time in seconds (0-0.5)

  // Delayed vibrato
  vibratoRate: number;      // Vibrato speed in Hz (3-8)
  vibratoDepth: number;     // Vibrato depth in semitones (0-1)
  vibratoDelay: number;     // Delay before vibrato kicks in, in seconds (0-1)

  // Drone
  droneLevel: number;       // Volume of sustained drone pad (0-1)
  droneTonality: number;    // How tonal the drone is (0-1)

  // Sound shaping
  noiseColor: number;       // 0 = pink (warm), 1 = white (bright)
  noiseQ: number;           // Q of the noise bandpass (5-40)
  reverbMix: number;        // Reverb amount (0-1)
  gain: number;             // Master gain (0-1)
}

export const DEFAULT_MELODIC_EMERGENCE_PARAMS: MelodicEmergenceParams = {
  tonalityFloor: 0.1,
  tonalityCeil: 0.85,
  tonalityAttack: 0.4,
  tonalityRelease: 0.6,

  attack: 0.08,
  release: 0.3,

  portamento: 0.08,

  vibratoRate: 5.0,
  vibratoDepth: 0.3,
  vibratoDelay: 0.25,

  droneLevel: 0.15,
  droneTonality: 0.5,

  noiseColor: 0.2,
  noiseQ: 15,
  reverbMix: 0.35,
  gain: 0.45,
};

// --- Synth ---

export function createMelodicEmergence(
  key: string,
  params: MelodicEmergenceParams,
): { left: NodeRepr_t; right: NodeRepr_t } {
  const {
    tonalityFloor,
    tonalityCeil,
    tonalityAttack,
    tonalityRelease,
    attack,
    release,
    portamento,
    vibratoRate,
    vibratoDepth,
    vibratoDelay,
    droneLevel,
    droneTonality,
    noiseColor,
    noiseQ,
    reverbMix,
    gain,
  } = params;

  // =============================================
  // SEQUENCER
  // =============================================
  const clock = el.train(TICK_RATE);
  const loopTrigger = el.train(1 / LOOP_DURATION);

  // Frequency from MIDI sequence
  const seqFreq = el.sparseq(
    { key: `${key}:freq`, seq: FREQ_SEQ },
    clock,
    loopTrigger,
  );

  // Gate from MIDI sequence
  const gate = el.sparseq(
    { key: `${key}:gate`, seq: GATE_SEQ },
    clock,
    loopTrigger,
  );

  // =============================================
  // PORTAMENTO — smooth pitch glides
  // =============================================
  const portamentoTau = el.const({ key: `${key}:porta`, value: Math.max(0.001, portamento) });
  const smoothFreq = el.smooth(el.tau2pole(portamentoTau), seqFreq);

  // =============================================
  // DELAYED VIBRATO
  // =============================================
  // The vibrato depth ramps up slowly after note onset.
  // We use a slow-attack envelope following the gate:
  // - When gate goes high: vibrato depth slowly rises from 0 to full
  // - When gate goes low: vibrato depth drops quickly
  //
  // vibratoDelay controls how long before vibrato reaches full depth
  const vibratoEnv = el.adsr(
    el.const({ key: `${key}:vibDelay`, value: Math.max(0.01, vibratoDelay) }),
    0.01, // decay (unused, sustain=1)
    1,    // sustain
    0.05, // release (vibrato stops quickly on note-off)
    gate,
  );

  const vibLfo = el.cycle(el.const({ key: `${key}:vibRate`, value: vibratoRate }));
  const vibSemitones = el.mul(
    el.const({ key: `${key}:vibDepth`, value: vibratoDepth }),
    vibratoEnv,
    vibLfo,
  );
  // Convert semitones to frequency ratio: 2^(st/12)
  const vibRatio = el.pow(2, el.div(vibSemitones, 12));

  const finalFreq = el.mul(smoothFreq, vibRatio);

  // =============================================
  // AMPLITUDE ENVELOPE
  // =============================================
  const ampEnv = el.adsr(
    el.const({ key: `${key}:atk`, value: attack }),
    0.01,
    1,
    el.const({ key: `${key}:rel`, value: release }),
    gate,
  );

  // =============================================
  // TONALITY ENVELOPE — noise → tone per note
  // =============================================
  // This is the core expressive idea:
  // - Note attack: tonality starts at floor (mostly noise)
  // - During sustain: tonality rises to ceil (mostly sine)
  // - Release: tonality falls back to floor (dissolves to noise)
  const tonalityEnv = el.adsr(
    el.const({ key: `${key}:tonAtk`, value: tonalityAttack }),
    0.01,
    1,
    el.const({ key: `${key}:tonRel`, value: tonalityRelease }),
    gate,
  );

  // Map envelope (0-1) to tonality range (floor-ceil)
  const floor = el.const({ key: `${key}:tonFloor`, value: tonalityFloor });
  const ceil = el.const({ key: `${key}:tonCeil`, value: tonalityCeil });
  const tonality = el.add(floor, el.mul(el.sub(ceil, floor), tonalityEnv));

  // =============================================
  // LEAD VOICE — noise↔sine crossfade
  // =============================================

  // Noise excitation
  const smoothNoiseColor = el.smooth(
    el.tau2pole(0.1),
    el.const({ key: `${key}:noiseColor`, value: noiseColor }),
  );
  const whiteL = el.noise({ seed: 11111 });
  const whiteR = el.noise({ seed: 22222 });
  const pinkL = el.pink(whiteL);
  const pinkR = el.pink(whiteR);
  const noiseL = el.add(el.mul(el.sub(1, smoothNoiseColor), pinkL), el.mul(smoothNoiseColor, whiteL));
  const noiseR = el.add(el.mul(el.sub(1, smoothNoiseColor), pinkR), el.mul(smoothNoiseColor, whiteR));

  // Bandpass the noise at the melody frequency
  const bpQ = el.const({ key: `${key}:noiseQ`, value: noiseQ });
  const filteredNoiseL = el.bandpass(finalFreq, bpQ, noiseL);
  const filteredNoiseR = el.bandpass(finalFreq, bpQ, noiseR);

  // Pure sine at the melody frequency (with subtle detuned pair for warmth)
  const sine1 = el.cycle(finalFreq);
  const sine2 = el.cycle(el.mul(finalFreq, 1.002)); // +3.5 cents for warmth
  const sineVoice = el.mul(0.5, el.add(sine1, sine2));

  // Crossfade: noise ←→ sine based on tonality
  const noiseAmount = el.sub(1, tonality);
  const sineAmount = tonality;

  const leadL = el.add(
    el.mul(noiseAmount, filteredNoiseL),
    el.mul(sineAmount, el.mul(0.25, sineVoice)),
  );
  const leadR = el.add(
    el.mul(noiseAmount, filteredNoiseR),
    el.mul(sineAmount, el.mul(0.25, sineVoice)),
  );

  // Apply amplitude envelope
  const voicedL = el.mul(leadL, ampEnv);
  const voicedR = el.mul(leadR, ampEnv);

  // =============================================
  // DRONE PAD — sustained root + 5th
  // =============================================
  // Determine the root note of the melody (lowest note = C#4 = MIDI 61)
  const droneRootHz = midiToFreq(61); // C#4
  const drone5thHz = midiToFreq(68);  // G#4 (perfect 5th above)

  const smoothDroneLevel = el.smooth(
    el.tau2pole(0.5),
    el.const({ key: `${key}:droneLevel`, value: droneLevel }),
  );
  const smoothDroneTonality = el.smooth(
    el.tau2pole(0.3),
    el.const({ key: `${key}:droneTon`, value: droneTonality }),
  );

  // Drone noise layer
  const droneNoiseL1 = el.bandpass(droneRootHz, 12, noiseL);
  const droneNoiseR1 = el.bandpass(droneRootHz, 12, noiseR);
  const droneNoiseL2 = el.bandpass(drone5thHz, 12, noiseL);
  const droneNoiseR2 = el.bandpass(drone5thHz, 12, noiseR);

  // Drone sine layer
  const droneSine1 = el.cycle(droneRootHz);
  const droneSine2 = el.cycle(drone5thHz);

  // Drone voice with tonality crossfade
  const droneNAmount = el.sub(1, smoothDroneTonality);
  const droneSAmount = smoothDroneTonality;

  const droneL = el.mul(smoothDroneLevel, el.add(
    el.mul(droneNAmount, el.add(droneNoiseL1, el.mul(0.7, droneNoiseL2))),
    el.mul(droneSAmount, el.mul(0.15, el.add(droneSine1, el.mul(0.7, droneSine2)))),
  ));
  const droneR = el.mul(smoothDroneLevel, el.add(
    el.mul(droneNAmount, el.add(droneNoiseR1, el.mul(0.7, droneNoiseR2))),
    el.mul(droneSAmount, el.mul(0.15, el.add(droneSine1, el.mul(0.7, droneSine2)))),
  ));

  // =============================================
  // MIX + REVERB
  // =============================================
  let mixL = el.add(voicedL, droneL);
  let mixR = el.add(voicedR, droneR);

  // Reverb (3 delay taps with lowpass for warmth)
  const d1L = el.delay({ size: 88200 }, el.ms2samps(89), 0.35, el.lowpass(3500, 0.7, mixL));
  const d2L = el.delay({ size: 88200 }, el.ms2samps(151), 0.28, el.lowpass(2800, 0.7, mixL));
  const d3L = el.delay({ size: 88200 }, el.ms2samps(233), 0.2, el.lowpass(2000, 0.7, mixL));
  const d1R = el.delay({ size: 88200 }, el.ms2samps(103), 0.35, el.lowpass(3500, 0.7, mixR));
  const d2R = el.delay({ size: 88200 }, el.ms2samps(167), 0.28, el.lowpass(2800, 0.7, mixR));
  const d3R = el.delay({ size: 88200 }, el.ms2samps(251), 0.2, el.lowpass(2000, 0.7, mixR));

  const reverbL = el.add(d1L, d2L, d3L);
  const reverbR = el.add(d1R, d2R, d3R);

  const dryAmount = 1 - reverbMix;
  const outL = el.add(el.mul(dryAmount, mixL), el.mul(reverbMix, reverbL));
  const outR = el.add(el.mul(dryAmount, mixR), el.mul(reverbMix, reverbR));

  // Master gain
  const smoothGain = el.smooth(
    el.tau2pole(0.02),
    el.const({ key: `${key}:gain`, value: gain }),
  );

  return {
    left: el.mul(smoothGain, el.dcblock(outL)),
    right: el.mul(smoothGain, el.dcblock(outR)),
  };
}
