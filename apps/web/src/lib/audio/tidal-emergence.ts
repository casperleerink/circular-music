import { el } from "@elemaudio/core";
import type { NodeRepr_t } from "@elemaudio/core";

/**
 * Tidal Emergence
 *
 * Three voices of the same melody exist simultaneously inside one shared
 * noise bed. Each voice is a noise↔sine crossfade at its own frequencies.
 * When all tonalities are at 0, you hear textured noise shaped by the
 * spectral footprint of all three melodies. As tonality rises for each
 * voice, it "resolves" from the noise — first one melody, then a canon,
 * then a slow bass line. The noise doesn't go away — it's what the
 * unresolved voices still sound like.
 *
 * Voice 1: Original melody
 * Voice 2: Canon at the 5th below, delayed by one phrase
 * Voice 3: Augmented (half speed), octave below
 *
 * All three voices share the same noise source — this is critical.
 * The noise IS the unresolved sum of all voices.
 */

// --- MIDI data ---
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
  // Phrase 2
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
  // Phrase 3
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

// =============================================
// Voice transformation helpers
// =============================================

interface VoiceTransform {
  transposeSemitones: number;
  timeScale: number;     // 1 = normal, 2 = half speed (augmentation)
  tickOffset: number;    // canon delay in ticks (applied to the looping sequence)
}

const VOICE_TRANSFORMS: VoiceTransform[] = [
  // Voice 1: Original melody
  { transposeSemitones: 0, timeScale: 1, tickOffset: 0 },
  // Voice 2: Canon at the 5th below, delayed by one phrase
  { transposeSemitones: -7, timeScale: 1, tickOffset: 5760 },
  // Voice 3: Augmented (half speed), octave below
  { transposeSemitones: -12, timeScale: 2, tickOffset: 0 },
];

// Stereo pan positions per voice (0=left, 0.5=center, 1=right)
const VOICE_PANS = [0.5, 0.3, 0.7];

// Voice volume scaling (voices 2,3 slightly quieter)
const VOICE_GAINS = [1.0, 0.75, 0.65];

/**
 * Build a transformed frequency sequence for a voice
 */
function buildVoiceFreqSeq(
  transform: VoiceTransform,
): Array<{ value: number; tickTime: number }> {
  const transposeRatio = Math.pow(2, transform.transposeSemitones / 12);
  const totalTicks = TOTAL_TICKS * transform.timeScale;

  return MELODY_NOTES.map((n) => {
    const scaledTick = n.startTick * transform.timeScale;
    // Apply canon offset (wrap around for looping)
    const offsetTick = (scaledTick + transform.tickOffset * transform.timeScale) % totalTicks;
    return {
      value: midiToFreq(n.note) * transposeRatio,
      tickTime: offsetTick,
    };
  }).sort((a, b) => a.tickTime - b.tickTime);
}

/**
 * Build a transformed gate sequence for a voice
 */
function buildVoiceGateSeq(
  transform: VoiceTransform,
): Array<{ value: number; tickTime: number }> {
  const totalTicks = TOTAL_TICKS * transform.timeScale;
  const seq: Array<{ value: number; tickTime: number }> = [];

  for (const n of MELODY_NOTES) {
    const scaledStart = n.startTick * transform.timeScale;
    const scaledEnd = n.endTick * transform.timeScale;
    const offsetStart = (scaledStart + transform.tickOffset * transform.timeScale) % totalTicks;
    const offsetEnd = (scaledEnd + transform.tickOffset * transform.timeScale) % totalTicks;

    // Only add if start < end (don't wrap single notes across loop boundary)
    if (offsetStart < offsetEnd) {
      seq.push({ value: 1, tickTime: offsetStart });
      seq.push({ value: 0, tickTime: offsetEnd });
    }
  }

  // Ensure silence at tick 0 if no note starts exactly there
  if (!seq.some((s) => s.tickTime === 0)) {
    seq.push({ value: 0, tickTime: 0 });
  }

  return seq.sort((a, b) => a.tickTime - b.tickTime);
}

// Pre-build all sequences
const VOICE_FREQ_SEQS = VOICE_TRANSFORMS.map(buildVoiceFreqSeq);
const VOICE_GATE_SEQS = VOICE_TRANSFORMS.map(buildVoiceGateSeq);
const VOICE_LOOP_DURATIONS = VOICE_TRANSFORMS.map(
  (t) => (TOTAL_TICKS * t.timeScale) / TICK_RATE,
);

// =============================================
// Parameters
// =============================================

export interface TidalEmergenceParams {
  // Global erosion: distributes tonality across voices
  // 0 = all noise, 0.33 = voice 1 tonal, 0.66 = voices 1+2 tonal, 1 = all tonal
  erosion: number;

  // Per-voice tonality overrides (0-1 each)
  // When set, these override the erosion-derived tonality for that voice
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
 * Voice 1 emerges first, then 2, then 3.
 * Each voice gets a segment of the erosion range.
 */
function erosionToVoiceTonality(
  erosion: NodeRepr_t,
  voiceIndex: number,
): NodeRepr_t {
  // Voice 0: starts resolving at erosion 0, fully tonal at 0.4
  // Voice 1: starts resolving at erosion 0.3, fully tonal at 0.7
  // Voice 2: starts resolving at erosion 0.6, fully tonal at 1.0
  const starts = [0, 0.3, 0.6];
  const ends = [0.4, 0.7, 1.0];

  const start = starts[voiceIndex];
  const range = ends[voiceIndex] - start;

  // tonality = clamp((erosion - start) / range, 0, 1)
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
    const transform = VOICE_TRANSFORMS[v];
    const loopDuration = VOICE_LOOP_DURATIONS[v];

    // --- Sequencer ---
    const clock = el.train(TICK_RATE);
    const loopTrigger = el.train(1 / loopDuration);

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
    const vibRateOffset = [0, 0.15, -0.1][v]; // slightly different rates
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
    // Voice 3 (augmented) gets slower attack/release to match its half-speed nature
    const atkTime = transform.timeScale > 1 ? 0.15 : 0.08;
    const relTime = transform.timeScale > 1 ? 0.5 : 0.3;
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
    const filteredNoiseL = el.bandpass(finalFreq, bpQ, sharedNoiseL);
    const filteredNoiseR = el.bandpass(finalFreq, bpQ, sharedNoiseR);

    // --- Sine layer: pure tone at this voice's frequency ---
    const sine1 = el.cycle(finalFreq);
    const detuneAmount = [1.002, 1.003, 1.001][v]; // slightly different warmth per voice
    const sine2 = el.cycle(el.mul(finalFreq, detuneAmount));
    const sineVoice = el.mul(0.5, el.add(sine1, sine2));

    // --- Crossfade noise ↔ sine ---
    const noiseAmount = el.sub(1, voiceTonality);
    const sineAmt = voiceTonality;

    const voiceL = el.add(
      el.mul(noiseAmount, filteredNoiseL),
      el.mul(sineAmt, el.mul(0.22, sineVoice)),
    );
    const voiceR = el.add(
      el.mul(noiseAmount, filteredNoiseR),
      el.mul(sineAmt, el.mul(0.22, sineVoice)),
    );

    // Apply amplitude envelope and voice gain
    const voiceGain = VOICE_GAINS[v];
    const shapedL = el.mul(voiceL, ampEnv, voiceGain);
    const shapedR = el.mul(voiceR, ampEnv, voiceGain);

    // --- Stereo pan ---
    const panAngle = VOICE_PANS[v] * Math.PI / 2;
    const panL = Math.cos(panAngle);
    const panR = Math.sin(panAngle);

    mixL = el.add(mixL, el.mul(panL, shapedL));
    mixR = el.add(mixR, el.mul(panR, shapedR));
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
