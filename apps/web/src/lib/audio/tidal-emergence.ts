import { el } from "@elemaudio/core";
import type { NodeRepr_t } from "@elemaudio/core";

/**
 * Tidal Emergence
 *
 * Three register voices from circular-melody1.mid exist simultaneously
 * inside one shared noise bed. Each voice is a noise↔sine crossfade at
 * its own frequencies.
 *
 * When all tonalities are at 0, you hear textured noise shaped by the
 * spectral footprint of all three voices. As tonality rises for each
 * voice, it "resolves" from the noise. The noise doesn't go away —
 * it's what the unresolved voices still sound like.
 *
 * Voice 1 (High):  F#4–C#5 — melody, emerges first
 * Voice 2 (Mid):   A3–E4  — middle voice, emerges second
 * Voice 3 (Low):   C#3–G#3 — bass, emerges last
 *
 * All three voices share the same noise source — this is critical.
 * The noise IS the unresolved sum of all voices.
 *
 * Source: circular-melody1.mid (96 TPQ, 120 BPM)
 */

// --- MIDI timing ---
// 96 TPQ at 120 BPM = 192 ticks/second
const TICK_RATE = 192;
const TOTAL_TICKS = 43200; // ~225 seconds, covers full MIDI range
const LOOP_DURATION = TOTAL_TICKS / TICK_RATE;

interface MidiNote {
  note: number;
  vel: number;
  startTick: number;
  endTick: number;
}

// =============================================
// Voice note data (extracted from circular-melody1.mid)
// =============================================

// Voice 1: High register (F#4–C#5) — melody
const HIGH_NOTES: MidiNote[] = [
  { note: 68, vel: 60, startTick: 6893, endTick: 7489 },
  { note: 68, vel: 70, startTick: 10563, endTick: 11485 },
  { note: 68, vel: 35, startTick: 11499, endTick: 11809 },
  { note: 68, vel: 17, startTick: 11911, endTick: 12353 },
  { note: 73, vel: 74, startTick: 12680, endTick: 13198 },
  { note: 68, vel: 76, startTick: 14851, endTick: 14981 },
  { note: 68, vel: 74, startTick: 16109, endTick: 16235 },
  { note: 69, vel: 87, startTick: 16314, endTick: 18190 },
  { note: 69, vel: 72, startTick: 18278, endTick: 19822 },
  { note: 69, vel: 73, startTick: 19892, endTick: 23598 },
  { note: 69, vel: 60, startTick: 23664, endTick: 23803 },
  { note: 71, vel: 68, startTick: 23871, endTick: 24053 },
  { note: 66, vel: 16, startTick: 24074, endTick: 24732 },
  { note: 66, vel: 57, startTick: 24821, endTick: 25040 },
  { note: 69, vel: 78, startTick: 25749, endTick: 25876 },
  { note: 66, vel: 51, startTick: 25948, endTick: 27715 },
  { note: 66, vel: 45, startTick: 27786, endTick: 27931 },
  { note: 73, vel: 60, startTick: 28696, endTick: 30325 },
  { note: 71, vel: 74, startTick: 31000, endTick: 31355 },
  { note: 68, vel: 6, startTick: 40272, endTick: 42843 },
];

// Voice 2: Mid register (A3–E4) — middle voice
const MID_NOTES: MidiNote[] = [
  { note: 57, vel: 67, startTick: 708, endTick: 916 },
  { note: 59, vel: 35, startTick: 1826, endTick: 3834 },
  { note: 57, vel: 31, startTick: 3838, endTick: 4490 },
  { note: 61, vel: 21, startTick: 4742, endTick: 6264 },
  { note: 63, vel: 40, startTick: 6342, endTick: 7349 },
  { note: 64, vel: 50, startTick: 7546, endTick: 9513 },
  { note: 64, vel: 85, startTick: 10461, endTick: 10650 },
  { note: 64, vel: 81, startTick: 10890, endTick: 11181 },
  { note: 64, vel: 75, startTick: 11391, endTick: 11999 },
  { note: 64, vel: 78, startTick: 12024, endTick: 12573 },
  { note: 64, vel: 43, startTick: 13333, endTick: 13742 },
  { note: 64, vel: 55, startTick: 13943, endTick: 14982 },
  { note: 64, vel: 73, startTick: 15058, endTick: 16327 },
  { note: 64, vel: 54, startTick: 16415, endTick: 16620 },
  { note: 64, vel: 38, startTick: 16868, endTick: 17229 },
  { note: 59, vel: 28, startTick: 17430, endTick: 17770 },
  { note: 64, vel: 47, startTick: 18380, endTick: 18606 },
  { note: 64, vel: 40, startTick: 19996, endTick: 20621 },
  { note: 64, vel: 47, startTick: 20832, endTick: 21055 },
  { note: 61, vel: 31, startTick: 21146, endTick: 22965 },
  { note: 64, vel: 60, startTick: 23025, endTick: 23520 },
  { note: 64, vel: 39, startTick: 23566, endTick: 24484 },
  { note: 64, vel: 75, startTick: 24511, endTick: 24735 },
  { note: 64, vel: 55, startTick: 24918, endTick: 25041 },
  { note: 61, vel: 30, startTick: 25118, endTick: 26653 },
  { note: 64, vel: 40, startTick: 27696, endTick: 27909 },
  { note: 64, vel: 59, startTick: 27978, endTick: 28192 },
  { note: 61, vel: 22, startTick: 28277, endTick: 29528 },
  { note: 64, vel: 41, startTick: 29608, endTick: 30022 },
  { note: 64, vel: 77, startTick: 30103, endTick: 31245 },
  { note: 63, vel: 32, startTick: 31293, endTick: 33003 },
  { note: 57, vel: 59, startTick: 33689, endTick: 34971 },
  { note: 57, vel: 62, startTick: 35051, endTick: 35461 },
  { note: 61, vel: 57, startTick: 35530, endTick: 37060 },
  { note: 61, vel: 23, startTick: 37164, endTick: 39074 },
  { note: 59, vel: 53, startTick: 39363, endTick: 42826 },
];

// Voice 3: Low register (C#3–G#3) — bass
const LOW_NOTES: MidiNote[] = [
  { note: 56, vel: 67, startTick: 226, endTick: 705 },
  { note: 52, vel: 48, startTick: 854, endTick: 1233 },
  { note: 49, vel: 45, startTick: 1623, endTick: 2821 },
  { note: 56, vel: 73, startTick: 3132, endTick: 4284 },
  { note: 49, vel: 32, startTick: 4347, endTick: 4957 },
  { note: 56, vel: 14, startTick: 8686, endTick: 9482 },
  { note: 54, vel: 71, startTick: 9559, endTick: 13627 },
  { note: 56, vel: 74, startTick: 26720, endTick: 26941 },
  { note: 54, vel: 18, startTick: 26941, endTick: 27232 },
  { note: 52, vel: 40, startTick: 27471, endTick: 31766 },
  { note: 54, vel: 46, startTick: 31954, endTick: 32365 },
  { note: 52, vel: 42, startTick: 32455, endTick: 33625 },
  { note: 52, vel: 52, startTick: 33781, endTick: 35057 },
  { note: 52, vel: 40, startTick: 35146, endTick: 36488 },
  { note: 52, vel: 50, startTick: 36659, endTick: 38730 },
  { note: 54, vel: 67, startTick: 38784, endTick: 39080 },
  { note: 49, vel: 35, startTick: 39158, endTick: 42852 },
];

// Per-voice note arrays, indexed by voice number
const VOICE_NOTES: MidiNote[][] = [HIGH_NOTES, MID_NOTES, LOW_NOTES];

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// =============================================
// Sequence builders (no transforms needed — data is already composed)
// =============================================

function buildFreqSeq(
  notes: MidiNote[],
): Array<{ value: number; tickTime: number }> {
  // Set a default frequency at tick 0 if no note starts there
  const seq = notes.map((n) => ({
    value: midiToFreq(n.note),
    tickTime: n.startTick,
  }));

  if (!seq.some((s) => s.tickTime === 0)) {
    // Use the first note's frequency as a reasonable default
    seq.push({ value: midiToFreq(notes[0].note), tickTime: 0 });
  }

  return seq.sort((a, b) => a.tickTime - b.tickTime);
}

function buildGateSeq(
  notes: MidiNote[],
): Array<{ value: number; tickTime: number }> {
  const seq: Array<{ value: number; tickTime: number }> = [];

  for (const n of notes) {
    seq.push({ value: 1, tickTime: n.startTick });
    seq.push({ value: 0, tickTime: n.endTick });
  }

  // Ensure silence at tick 0 if no note starts there
  if (!seq.some((s) => s.tickTime === 0)) {
    seq.push({ value: 0, tickTime: 0 });
  }

  return seq.sort((a, b) => a.tickTime - b.tickTime);
}

// Pre-build all sequences
const VOICE_FREQ_SEQS = VOICE_NOTES.map(buildFreqSeq);
const VOICE_GATE_SEQS = VOICE_NOTES.map(buildGateSeq);

// Stereo pan positions per voice (0=left, 0.5=center, 1=right)
// High=center, Mid=slightly left, Low=slightly right
const VOICE_PANS = [0.5, 0.35, 0.65];

// Voice volume scaling
const VOICE_GAINS = [1.0, 0.8, 0.7];

// =============================================
// Parameters
// =============================================

export interface TidalEmergenceParams {
  // Global erosion: distributes tonality across voices
  // 0 = all noise, 0.33 = voice 1 tonal, 0.66 = voices 1+2 tonal, 1 = all tonal
  erosion: number;

  // Per-voice tonality overrides (0-1 each)
  voice1Tonality: number;
  voice2Tonality: number;
  voice3Tonality: number;

  // Whether to use erosion (true) or per-voice sliders (false)
  useErosion: boolean;

  // Expression
  portamento: number;       // Pitch glide time (0-0.5s)
  vibratoRate: number;      // Hz (3-8)
  vibratoDepth: number;     // Semitones (0-1)

  // Sound
  noiseColor: number;       // 0=pink, 1=white
  noiseQ: number;           // Bandpass Q for noise layer (5-40)
  reverbMix: number;        // 0-1
  gain: number;             // 0-1
}

export const DEFAULT_TIDAL_EMERGENCE_PARAMS: TidalEmergenceParams = {
  erosion: 0.3,
  voice1Tonality: 0.7,
  voice2Tonality: 0.3,
  voice3Tonality: 0.1,
  useErosion: true,
  portamento: 0.06,
  vibratoRate: 5.0,
  vibratoDepth: 0.2,
  noiseColor: 0.2,
  noiseQ: 15,
  reverbMix: 0.35,
  gain: 0.45,
};

// =============================================
// Synth
// =============================================

/**
 * Convert global erosion (0-1) to per-voice tonality.
 * Voice 1 (high) emerges first, then 2 (mid), then 3 (low).
 */
function erosionToVoiceTonality(
  erosion: NodeRepr_t,
  voiceIndex: number,
): NodeRepr_t {
  // Voice 0 (high):  starts at erosion 0,   fully tonal at 0.4
  // Voice 1 (mid):   starts at erosion 0.3, fully tonal at 0.7
  // Voice 2 (low):   starts at erosion 0.6, fully tonal at 1.0
  const starts = [0, 0.3, 0.6];
  const ends = [0.4, 0.7, 1.0];

  const start = starts[voiceIndex];
  const range = ends[voiceIndex] - start;

  const shifted = el.sub(erosion, start);
  const scaled = el.div(shifted, range);
  return el.max(0, el.min(1, scaled));
}

export function createTidalEmergence(
  key: string,
  params: TidalEmergenceParams,
): { left: NodeRepr_t; right: NodeRepr_t } {
  const {
    erosion,
    voice1Tonality,
    voice2Tonality,
    voice3Tonality,
    useErosion,
    portamento,
    vibratoRate,
    vibratoDepth,
    noiseColor,
    noiseQ,
    reverbMix,
    gain,
  } = params;

  // =============================================
  // SHARED NOISE — all voices filter from the same source
  // =============================================
  const smoothNoiseColor = el.smooth(
    el.tau2pole(0.1),
    el.const({ key: `${key}:noiseColor`, value: noiseColor }),
  );
  const whiteL = el.noise({ seed: 33333 });
  const whiteR = el.noise({ seed: 44444 });
  const pinkL = el.pink(whiteL);
  const pinkR = el.pink(whiteR);
  const sharedNoiseL = el.add(
    el.mul(el.sub(1, smoothNoiseColor), pinkL),
    el.mul(smoothNoiseColor, whiteL),
  );
  const sharedNoiseR = el.add(
    el.mul(el.sub(1, smoothNoiseColor), pinkR),
    el.mul(smoothNoiseColor, whiteR),
  );

  const bpQ = el.const({ key: `${key}:noiseQ`, value: noiseQ });

  // Global erosion signal
  const smoothErosion = el.smooth(
    el.tau2pole(0.5),
    el.const({ key: `${key}:erosion`, value: erosion }),
  );

  // Per-voice tonality values (manual overrides)
  const manualTonalities = [voice1Tonality, voice2Tonality, voice3Tonality];

  let mixL: NodeRepr_t = el.const({ value: 0 });
  let mixR: NodeRepr_t = el.const({ value: 0 });

  // =============================================
  // BUILD EACH VOICE
  // =============================================
  for (let v = 0; v < 3; v++) {
    const vKey = `${key}:v${v}`;

    // --- Sequencer ---
    const clock = el.train(TICK_RATE);
    const loopTrigger = el.train(1 / LOOP_DURATION);

    const seqFreq = el.sparseq(
      { key: `${vKey}:freq`, seq: VOICE_FREQ_SEQS[v] },
      clock,
      loopTrigger,
    );

    const gate = el.sparseq(
      { key: `${vKey}:gate`, seq: VOICE_GATE_SEQS[v] },
      clock,
      loopTrigger,
    );

    // --- Portamento ---
    const portaTau = el.const({ key: `${vKey}:porta`, value: Math.max(0.001, portamento) });
    const smoothFreq = el.smooth(el.tau2pole(portaTau), seqFreq);

    // --- Vibrato (with slight per-voice rate variation for organic feel) ---
    const vibRateOffset = [0, 0.15, -0.1][v];
    const vibLfo = el.cycle(
      el.const({ key: `${vKey}:vibRate`, value: vibratoRate + vibRateOffset }),
    );
    // Delayed vibrato: ramps in after 0.2s of each note
    const vibEnv = el.adsr(0.2, 0.01, 1, 0.05, gate);
    const vibSemitones = el.mul(
      el.const({ key: `${vKey}:vibDepth`, value: vibratoDepth }),
      vibEnv,
      vibLfo,
    );
    const vibRatio = el.pow(2, el.div(vibSemitones, 12));
    const finalFreq = el.mul(smoothFreq, vibRatio);

    // --- Amplitude envelope ---
    // Low voice gets slower attack/release for sustained bass feel
    const atkTime = v === 2 ? 0.15 : 0.08;
    const relTime = v === 2 ? 0.5 : 0.3;
    const ampEnv = el.adsr(atkTime, 0.01, 1, relTime, gate);

    // --- Tonality: erosion-derived or manual ---
    let voiceTonality: NodeRepr_t;
    if (useErosion) {
      voiceTonality = erosionToVoiceTonality(smoothErosion, v);
    } else {
      voiceTonality = el.smooth(
        el.tau2pole(0.3),
        el.const({ key: `${vKey}:tonality`, value: manualTonalities[v] }),
      );
    }

    // --- Noise layer: bandpass noise at this voice's frequency ---
    // Noise is CONTINUOUS — it doesn't follow the gate. The noise bed
    // is always present, shaped by the voice's current frequency.
    const filteredNoiseL = el.bandpass(finalFreq, bpQ, sharedNoiseL);
    const filteredNoiseR = el.bandpass(finalFreq, bpQ, sharedNoiseR);

    // --- Sine layer: pure tone at this voice's frequency ---
    // Sines DO follow the gate — notes appear and disappear melodically
    const sine1 = el.cycle(finalFreq);
    const detuneAmount = [1.002, 1.003, 1.001][v];
    const sine2 = el.cycle(el.mul(finalFreq, detuneAmount));
    const sineVoice = el.mul(0.5, el.add(sine1, sine2));

    // --- Crossfade noise ↔ sine ---
    const noiseAmount = el.sub(1, voiceTonality);
    const sineAmt = voiceTonality;

    // Noise is always on (scaled by voiceGain only),
    // Sine follows the amplitude envelope (gated)
    const voiceGain = VOICE_GAINS[v];
    const noiseL = el.mul(noiseAmount, filteredNoiseL, voiceGain);
    const noiseR = el.mul(noiseAmount, filteredNoiseR, voiceGain);
    const toneL = el.mul(sineAmt, el.mul(0.22, sineVoice), ampEnv, voiceGain);
    const toneR = el.mul(sineAmt, el.mul(0.22, sineVoice), ampEnv, voiceGain);

    const voiceL = el.add(noiseL, toneL);
    const voiceR = el.add(noiseR, toneR);

    // --- Stereo pan ---
    const panAngle = VOICE_PANS[v] * Math.PI / 2;
    const panL = Math.cos(panAngle);
    const panR = Math.sin(panAngle);

    mixL = el.add(mixL, el.mul(panL, voiceL));
    mixR = el.add(mixR, el.mul(panR, voiceR));
  }

  // =============================================
  // REVERB
  // =============================================
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
