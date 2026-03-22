import { el } from "@elemaudio/core";
import type { NodeRepr_t } from "@elemaudio/core";

// Shared constants
const CHORD_INTERVALS = [0, 7, 12, 16, 19, 24]; // root, 5th, oct, M3+oct, 5th+oct, 2oct
const DRIFT_RATES = [0.031, 0.043, 0.053, 0.067, 0.079, 0.089];
const RESONATOR_PANS = [0.2, 0.4, 0.55, 0.65, 0.8, 0.35];

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ============================================================================
// ORIGINAL: "Resonant Tide"
// The base version you liked — noise through resonant bandpass filters.
// ============================================================================

export interface ResonantTideParams {
  rootNote: number;
  clarity: number;
  drift: number;
  tideRate: number;
  tideDepth: number;
  harmonicSpread: number;
  noiseColor: number;
  gain: number;
}

export const DEFAULT_RESONANT_TIDE_PARAMS: ResonantTideParams = {
  rootNote: 48,
  clarity: 0.6,
  drift: 0.3,
  tideRate: 0.08,
  tideDepth: 0.4,
  harmonicSpread: 0.5,
  noiseColor: 0.3,
  gain: 0.4,
};

export function createResonantTide(
  key: string,
  params: ResonantTideParams,
): { left: NodeRepr_t; right: NodeRepr_t } {
  const { rootNote, clarity, drift, tideRate, tideDepth, harmonicSpread, noiseColor, gain } = params;

  const smoothNoiseColor = el.smooth(el.tau2pole(0.1), el.const({ key: `${key}:noiseColor`, value: noiseColor }));
  const whiteL = el.noise({ seed: 3333 });
  const whiteR = el.noise({ seed: 4444 });
  const pinkL = el.pink(whiteL);
  const pinkR = el.pink(whiteR);
  const excitationL = el.add(el.mul(el.sub(1, smoothNoiseColor), pinkL), el.mul(smoothNoiseColor, whiteL));
  const excitationR = el.add(el.mul(el.sub(1, smoothNoiseColor), pinkR), el.mul(smoothNoiseColor, whiteR));

  const smoothTideDepth = el.smooth(el.tau2pole(0.2), el.const({ key: `${key}:tideDepth`, value: tideDepth }));
  const smoothTideRate = el.smooth(el.tau2pole(0.5), el.const({ key: `${key}:tideRate`, value: tideRate }));
  const tide1 = el.cycle(smoothTideRate);
  const tide2 = el.cycle(el.mul(smoothTideRate, 1.618));
  const tide3 = el.cycle(el.mul(smoothTideRate, 0.382));
  const combinedTide = el.mul(0.33, el.add(tide1, el.mul(0.6, tide2), el.mul(0.4, tide3)));
  const tideAmp = el.sub(1, el.mul(smoothTideDepth, el.mul(0.5, el.sub(1, combinedTide))));

  const smoothClarity = el.smooth(el.tau2pole(0.2), el.const({ key: `${key}:clarity`, value: clarity }));
  const smoothDrift = el.smooth(el.tau2pole(0.2), el.const({ key: `${key}:drift`, value: drift }));
  const resonatorQ = el.add(2, el.mul(78, el.mul(smoothClarity, smoothClarity)));

  let leftSum: NodeRepr_t = el.const({ value: 0 });
  let rightSum: NodeRepr_t = el.const({ value: 0 });

  for (let i = 0; i < 6; i++) {
    const intervalSemitones = CHORD_INTERVALS[i] * harmonicSpread;
    const baseHz = midiToHz(rootNote + intervalSemitones);
    const baseFreqSignal = el.const({ key: `${key}:resFreq${i}`, value: baseHz });
    const driftLfo = el.cycle(el.const({ key: `${key}:driftRate${i}`, value: DRIFT_RATES[i] }));
    const driftSemitones = el.mul(smoothDrift, 0.5, driftLfo);
    const driftRatio = el.pow(2, el.div(driftSemitones, 12));
    const resonatorFreq = el.mul(baseFreqSignal, driftRatio);

    const resL = el.bandpass(resonatorFreq, resonatorQ, excitationL);
    const resR = el.bandpass(resonatorFreq, resonatorQ, excitationR);
    const resGain = el.div(1, el.add(1, el.mul(0.01, resonatorQ)));
    const resAmpLfo = el.add(1, el.mul(0.1, el.cycle(el.const({ key: `${key}:resAmp${i}`, value: DRIFT_RATES[5 - i] * 0.7 }))));

    const panAngle = RESONATOR_PANS[i] * Math.PI / 2;
    leftSum = el.add(leftSum, el.mul(Math.cos(panAngle), el.mul(resL, resGain, resAmpLfo)));
    rightSum = el.add(rightSum, el.mul(Math.sin(panAngle), el.mul(resR, resGain, resAmpLfo)));
  }

  leftSum = el.mul(leftSum, tideAmp);
  rightSum = el.mul(rightSum, tideAmp);

  const airAmount = el.mul(el.sub(1, smoothClarity), 0.05);
  leftSum = el.add(leftSum, el.mul(airAmount, excitationL));
  rightSum = el.add(rightSum, el.mul(airAmount, excitationR));

  const revL = el.add(leftSum,
    el.mul(0.25, el.delay({ size: 88200 }, el.ms2samps(163), 0.4, el.lowpass(2500, 0.7, leftSum))),
    el.mul(0.18, el.delay({ size: 88200 }, el.ms2samps(241), 0.35, el.lowpass(2000, 0.7, leftSum))),
    el.mul(0.1, el.delay({ size: 88200 }, el.ms2samps(397), 0.25, el.lowpass(1500, 0.7, leftSum))),
  );
  const revR = el.add(rightSum,
    el.mul(0.25, el.delay({ size: 88200 }, el.ms2samps(179), 0.4, el.lowpass(2500, 0.7, rightSum))),
    el.mul(0.18, el.delay({ size: 88200 }, el.ms2samps(257), 0.35, el.lowpass(2000, 0.7, rightSum))),
    el.mul(0.1, el.delay({ size: 88200 }, el.ms2samps(419), 0.25, el.lowpass(1500, 0.7, rightSum))),
  );

  const smoothGain = el.smooth(el.tau2pole(0.02), el.const({ key: `${key}:gain`, value: gain }));
  return {
    left: el.mul(smoothGain, el.dcblock(revL)),
    right: el.mul(smoothGain, el.dcblock(revR)),
  };
}


// ============================================================================
// VARIATION A: "Sine Emergence"
//
// WHY the original stays noisy: a bandpass filter on noise only narrows the
// bandwidth — the output is still stochastic. Even at Q=200, it's pitched
// noise, not a tone.
//
// This variation solves it by ADDING pure sine oscillators at the same
// frequencies as the resonators. The "tonality" parameter crossfades between
// the filtered noise and clean sines. In between you get this beautiful
// hybrid where tones shimmer through noise texture.
//
// Think of it like: the sines are the tones buried in the sand, and the
// noise is the sand itself. Tonality controls how much sand you brush away.
// ============================================================================

export interface SineEmergenceParams {
  rootNote: number;        // Root MIDI note (36-72)
  tonality: number;        // 0 = pure noise resonators, 1 = pure sine tones (0-1)
  drift: number;           // How much the pitches drift (0-1)
  tideRate: number;        // Tidal modulation rate (0.02-0.5 Hz)
  tideDepth: number;       // Tidal modulation depth (0-1)
  harmonicSpread: number;  // Chord voicing width (0-1)
  noiseColor: number;      // 0 = pink, 1 = white (0-1)
  brightness: number;      // Lowpass on the sine layer (0-1)
  gain: number;
}

export const DEFAULT_SINE_EMERGENCE_PARAMS: SineEmergenceParams = {
  rootNote: 48,
  tonality: 0.4,
  drift: 0.25,
  tideRate: 0.08,
  tideDepth: 0.35,
  harmonicSpread: 0.5,
  noiseColor: 0.2,
  brightness: 0.7,
  gain: 0.4,
};

export function createSineEmergence(
  key: string,
  params: SineEmergenceParams,
): { left: NodeRepr_t; right: NodeRepr_t } {
  const { rootNote, tonality, drift, tideRate, tideDepth, harmonicSpread, noiseColor, brightness, gain } = params;

  // --- Noise excitation (same as original) ---
  const smoothNoiseColor = el.smooth(el.tau2pole(0.1), el.const({ key: `${key}:noiseColor`, value: noiseColor }));
  const whiteL = el.noise({ seed: 5555 });
  const whiteR = el.noise({ seed: 6666 });
  const pinkL = el.pink(whiteL);
  const pinkR = el.pink(whiteR);
  const excitationL = el.add(el.mul(el.sub(1, smoothNoiseColor), pinkL), el.mul(smoothNoiseColor, whiteL));
  const excitationR = el.add(el.mul(el.sub(1, smoothNoiseColor), pinkR), el.mul(smoothNoiseColor, whiteR));

  // --- Tidal modulation ---
  const smoothTideDepth = el.smooth(el.tau2pole(0.2), el.const({ key: `${key}:tideDepth`, value: tideDepth }));
  const smoothTideRate = el.smooth(el.tau2pole(0.5), el.const({ key: `${key}:tideRate`, value: tideRate }));
  const tide1 = el.cycle(smoothTideRate);
  const tide2 = el.cycle(el.mul(smoothTideRate, 1.618));
  const tide3 = el.cycle(el.mul(smoothTideRate, 0.382));
  const combinedTide = el.mul(0.33, el.add(tide1, el.mul(0.6, tide2), el.mul(0.4, tide3)));
  const tideAmp = el.sub(1, el.mul(smoothTideDepth, el.mul(0.5, el.sub(1, combinedTide))));

  // --- Tonality crossfade ---
  const smoothTonality = el.smooth(el.tau2pole(0.3), el.const({ key: `${key}:tonality`, value: tonality }));
  const noiseAmount = el.sub(1, smoothTonality);
  const sineAmount = smoothTonality;

  const smoothDrift = el.smooth(el.tau2pole(0.2), el.const({ key: `${key}:drift`, value: drift }));
  const smoothBrightness = el.smooth(el.tau2pole(0.1), el.const({ key: `${key}:brightness`, value: brightness }));

  // Noise resonator Q: moderate, just enough to color the noise
  const noiseQ = 15;

  let leftSum: NodeRepr_t = el.const({ value: 0 });
  let rightSum: NodeRepr_t = el.const({ value: 0 });

  for (let i = 0; i < 6; i++) {
    const intervalSemitones = CHORD_INTERVALS[i] * harmonicSpread;
    const baseHz = midiToHz(rootNote + intervalSemitones);
    const baseFreqSignal = el.const({ key: `${key}:freq${i}`, value: baseHz });

    // Shared drift for both noise and sine layers
    const driftLfo = el.cycle(el.const({ key: `${key}:driftRate${i}`, value: DRIFT_RATES[i] }));
    const driftSemitones = el.mul(smoothDrift, 0.5, driftLfo);
    const driftRatio = el.pow(2, el.div(driftSemitones, 12));
    const voiceFreq = el.mul(baseFreqSignal, driftRatio);

    // --- Noise layer: bandpass filtered noise ---
    const noiseL = el.bandpass(voiceFreq, noiseQ, excitationL);
    const noiseR = el.bandpass(voiceFreq, noiseQ, excitationR);

    // --- Sine layer: pure sine oscillators with subtle vibrato ---
    // Each sine gets its own slow vibrato for life
    const sineVibRate = 0.11 + i * 0.07; // slightly different per voice
    const sineVibDepth = 0.002; // very subtle pitch wobble
    const sineVib = el.mul(sineVibDepth, el.cycle(el.const({ key: `${key}:sineVib${i}`, value: sineVibRate })));
    const sineFreq = el.mul(voiceFreq, el.add(1, sineVib));
    const sine = el.cycle(sineFreq);

    // Per-voice tremolo for organic shimmer on the sine layer
    const tremoloRate = DRIFT_RATES[5 - i] * 1.5;
    const tremolo = el.add(1, el.mul(0.12, el.cycle(el.const({ key: `${key}:sineTrem${i}`, value: tremoloRate }))));
    const sineVoice = el.mul(sine, tremolo, 0.18);

    // --- Crossfade between noise and sine ---
    const voiceL = el.add(el.mul(noiseAmount, noiseL), el.mul(sineAmount, sineVoice));
    const voiceR = el.add(el.mul(noiseAmount, noiseR), el.mul(sineAmount, sineVoice));

    // Stereo
    const panAngle = RESONATOR_PANS[i] * Math.PI / 2;
    leftSum = el.add(leftSum, el.mul(Math.cos(panAngle), voiceL));
    rightSum = el.add(rightSum, el.mul(Math.sin(panAngle), voiceR));
  }

  // Brightness: lowpass on the combined signal
  const filterFreq = el.mul(300, el.pow(30, smoothBrightness));
  leftSum = el.lowpass(filterFreq, 0.7, leftSum);
  rightSum = el.lowpass(filterFreq, 0.7, rightSum);

  // Tidal modulation
  leftSum = el.mul(leftSum, tideAmp);
  rightSum = el.mul(rightSum, tideAmp);

  // Reverb
  const revL = el.add(leftSum,
    el.mul(0.22, el.delay({ size: 88200 }, el.ms2samps(163), 0.4, el.lowpass(2500, 0.7, leftSum))),
    el.mul(0.15, el.delay({ size: 88200 }, el.ms2samps(241), 0.3, el.lowpass(2000, 0.7, leftSum))),
    el.mul(0.08, el.delay({ size: 88200 }, el.ms2samps(397), 0.2, el.lowpass(1500, 0.7, leftSum))),
  );
  const revR = el.add(rightSum,
    el.mul(0.22, el.delay({ size: 88200 }, el.ms2samps(179), 0.4, el.lowpass(2500, 0.7, rightSum))),
    el.mul(0.15, el.delay({ size: 88200 }, el.ms2samps(257), 0.3, el.lowpass(2000, 0.7, rightSum))),
    el.mul(0.08, el.delay({ size: 88200 }, el.ms2samps(419), 0.2, el.lowpass(1500, 0.7, rightSum))),
  );

  const smoothGain = el.smooth(el.tau2pole(0.02), el.const({ key: `${key}:gain`, value: gain }));
  return {
    left: el.mul(smoothGain, el.dcblock(revL)),
    right: el.mul(smoothGain, el.dcblock(revR)),
  };
}


// ============================================================================
// VARIATION B: "Karplus Tide"
//
// Uses Karplus-Strong synthesis: short delay lines with feedback create
// pitched tones from noise. This is how physical string modeling works —
// a noise burst excites a "string" (delay loop), and the feedback sustains
// the pitch while the noise decays away.
//
// The key parameter is "sustain" (delay feedback): at low values you hear
// short noise bursts, at high values the string rings and you hear clear
// pitched tones that sustain indefinitely.
//
// A lowpass filter inside the feedback loop simulates string damping —
// higher frequencies die faster, giving warm, naturally decaying tones.
// ============================================================================

export interface KarplusTideParams {
  rootNote: number;        // Root MIDI note (36-72)
  sustain: number;         // Delay feedback / string sustain (0-1)
  damping: number;         // Feedback lowpass cutoff, 0 = dark, 1 = bright (0-1)
  excitationRate: number;  // How often noise bursts excite the strings (0.1-5 Hz)
  drift: number;           // Pitch drift amount (0-1)
  harmonicSpread: number;  // Chord voicing width (0-1)
  tideRate: number;        // Tidal modulation rate (0.02-0.5 Hz)
  tideDepth: number;       // Tidal modulation depth (0-1)
  gain: number;
}

export const DEFAULT_KARPLUS_TIDE_PARAMS: KarplusTideParams = {
  rootNote: 48,
  sustain: 0.7,
  damping: 0.5,
  excitationRate: 0.5,
  drift: 0.2,
  harmonicSpread: 0.5,
  tideRate: 0.08,
  tideDepth: 0.3,
  gain: 0.4,
};

export function createKarplusTide(
  key: string,
  params: KarplusTideParams,
): { left: NodeRepr_t; right: NodeRepr_t } {
  const { rootNote, sustain, damping, excitationRate, drift, harmonicSpread, tideRate, tideDepth, gain } = params;

  // --- Tidal modulation ---
  const smoothTideDepth = el.smooth(el.tau2pole(0.2), el.const({ key: `${key}:tideDepth`, value: tideDepth }));
  const smoothTideRate = el.smooth(el.tau2pole(0.5), el.const({ key: `${key}:tideRate`, value: tideRate }));
  const tide1 = el.cycle(smoothTideRate);
  const tide2 = el.cycle(el.mul(smoothTideRate, 1.618));
  const combinedTide = el.mul(0.5, el.add(tide1, el.mul(0.6, tide2)));
  const tideAmp = el.sub(1, el.mul(smoothTideDepth, el.mul(0.5, el.sub(1, combinedTide))));

  const smoothDrift = el.smooth(el.tau2pole(0.2), el.const({ key: `${key}:drift`, value: drift }));

  // Feedback amount: map sustain 0-1 to feedback 0-0.998
  // Use a curve that makes the upper range more sensitive (where it matters)
  const smoothSustain = el.smooth(el.tau2pole(0.1), el.const({ key: `${key}:sustain`, value: sustain }));
  const feedback = el.mul(0.998, smoothSustain);

  // Damping: lowpass cutoff inside feedback loop
  // 0 = very dark (500 Hz), 1 = bright (12000 Hz)
  const smoothDamping = el.smooth(el.tau2pole(0.1), el.const({ key: `${key}:damping`, value: damping }));
  const dampingFreq = el.mul(500, el.pow(24, smoothDamping));

  let leftSum: NodeRepr_t = el.const({ value: 0 });
  let rightSum: NodeRepr_t = el.const({ value: 0 });

  for (let i = 0; i < 6; i++) {
    const intervalSemitones = CHORD_INTERVALS[i] * harmonicSpread;
    const baseHz = midiToHz(rootNote + intervalSemitones);
    const baseFreqSignal = el.const({ key: `${key}:freq${i}`, value: baseHz });

    // Drift
    const driftLfo = el.cycle(el.const({ key: `${key}:driftRate${i}`, value: DRIFT_RATES[i] }));
    const driftSemitones = el.mul(smoothDrift, 0.5, driftLfo);
    const driftRatio = el.pow(2, el.div(driftSemitones, 12));
    const stringFreq = el.mul(baseFreqSignal, driftRatio);

    // Delay time in samples = sampleRate / frequency
    const delaySamples = el.div(44100, stringFreq);

    // Excitation: noise bursts at the excitation rate
    // Each string gets a slightly different rate for organic staggering
    const excRate = excitationRate * (1 + (i - 2.5) * 0.08);
    const excTrigger = el.train(el.const({ key: `${key}:excRate${i}`, value: excRate }));

    // Shape the noise burst with a short envelope (5ms)
    // Use accum to create a phase that goes from 0 upward, reset on trigger
    const burstPhase = el.accum(el.div(1, el.mul(0.005, 44100)), excTrigger);
    const burstActive = el.le(burstPhase, 1);
    const burstEnv = el.mul(burstActive, el.sub(1, burstPhase));

    const noiseL = el.mul(el.noise({ seed: 2000 + i * 2 }), burstEnv, 0.3);
    const noiseR = el.mul(el.noise({ seed: 2001 + i * 2 }), burstEnv, 0.3);

    // Karplus-Strong: delay with feedback and lowpass damping
    // The delay line creates the pitch, feedback sustains it,
    // lowpass in feedback simulates natural string damping
    const stringL = el.delay(
      { size: 2048 },
      delaySamples,
      feedback,
      el.add(noiseL, el.mul(0, el.const({ value: 0 }))), // noise excitation
    );
    const stringR = el.delay(
      { size: 2048 },
      delaySamples,
      feedback,
      noiseR,
    );

    // Apply damping filter to the output (simulates the effect of the
    // lowpass being inside the loop — close approximation)
    const dampedL = el.lowpass(dampingFreq, 0.7, stringL);
    const dampedR = el.lowpass(dampingFreq, 0.7, stringR);

    // Stereo
    const panAngle = RESONATOR_PANS[i] * Math.PI / 2;
    leftSum = el.add(leftSum, el.mul(Math.cos(panAngle), dampedL));
    rightSum = el.add(rightSum, el.mul(Math.sin(panAngle), dampedR));
  }

  // Tidal modulation
  leftSum = el.mul(leftSum, tideAmp);
  rightSum = el.mul(rightSum, tideAmp);

  // Reverb
  const revL = el.add(leftSum,
    el.mul(0.25, el.delay({ size: 88200 }, el.ms2samps(163), 0.4, el.lowpass(2500, 0.7, leftSum))),
    el.mul(0.18, el.delay({ size: 88200 }, el.ms2samps(241), 0.3, el.lowpass(2000, 0.7, leftSum))),
    el.mul(0.1, el.delay({ size: 88200 }, el.ms2samps(397), 0.2, el.lowpass(1500, 0.7, leftSum))),
  );
  const revR = el.add(rightSum,
    el.mul(0.25, el.delay({ size: 88200 }, el.ms2samps(179), 0.4, el.lowpass(2500, 0.7, rightSum))),
    el.mul(0.18, el.delay({ size: 88200 }, el.ms2samps(257), 0.3, el.lowpass(2000, 0.7, rightSum))),
    el.mul(0.1, el.delay({ size: 88200 }, el.ms2samps(419), 0.2, el.lowpass(1500, 0.7, rightSum))),
  );

  const smoothGain = el.smooth(el.tau2pole(0.02), el.const({ key: `${key}:gain`, value: gain }));
  return {
    left: el.mul(smoothGain, el.dcblock(revL)),
    right: el.mul(smoothGain, el.dcblock(revR)),
  };
}


// ============================================================================
// VARIATION C: "Cascaded Resonance"
//
// The reason the original never sounds truly tonal: a single 2nd-order
// bandpass filter has a gentle rolloff. Even at Q=80, a lot of noise energy
// leaks through the skirts.
//
// Solution: CASCADE (stack) multiple bandpass filters in series at the same
// frequency. Each pass narrows the bandwidth further:
//   - 1 pass: pitched noise (the original)
//   - 2 passes: narrower, tone starts to emerge
//   - 3 passes: clearly tonal with noise texture
//   - 4 passes: nearly pure tone with just a whisper of noise
//
// The "resonanceDepth" parameter crossfades between 1-pass and 4-pass output,
// giving a smooth noise → tone continuum that feels completely organic because
// the tone IS the noise — just extremely filtered.
//
// This is the most "honest" approach: no added oscillators, the tone genuinely
// emerges from the noise through extreme filtering.
// ============================================================================

export interface CascadedResonanceParams {
  rootNote: number;        // Root MIDI note (36-72)
  resonanceDepth: number;  // 0 = single pass (noisy), 1 = quad cascade (tonal) (0-1)
  q: number;               // Base Q for each filter pass (5-60)
  drift: number;           // Pitch drift (0-1)
  tideRate: number;        // Tidal modulation rate (0.02-0.5 Hz)
  tideDepth: number;       // Tidal modulation depth (0-1)
  harmonicSpread: number;  // Chord voicing width (0-1)
  noiseColor: number;      // 0 = pink, 1 = white (0-1)
  gain: number;
}

export const DEFAULT_CASCADED_RESONANCE_PARAMS: CascadedResonanceParams = {
  rootNote: 48,
  resonanceDepth: 0.5,
  q: 25,
  drift: 0.25,
  tideRate: 0.08,
  tideDepth: 0.35,
  harmonicSpread: 0.5,
  noiseColor: 0.2,
  gain: 0.4,
};

export function createCascadedResonance(
  key: string,
  params: CascadedResonanceParams,
): { left: NodeRepr_t; right: NodeRepr_t } {
  const { rootNote, resonanceDepth, q, drift, tideRate, tideDepth, harmonicSpread, noiseColor, gain } = params;

  // --- Noise excitation ---
  const smoothNoiseColor = el.smooth(el.tau2pole(0.1), el.const({ key: `${key}:noiseColor`, value: noiseColor }));
  const whiteL = el.noise({ seed: 7777 });
  const whiteR = el.noise({ seed: 8888 });
  const pinkL = el.pink(whiteL);
  const pinkR = el.pink(whiteR);
  const excitationL = el.add(el.mul(el.sub(1, smoothNoiseColor), pinkL), el.mul(smoothNoiseColor, whiteL));
  const excitationR = el.add(el.mul(el.sub(1, smoothNoiseColor), pinkR), el.mul(smoothNoiseColor, whiteR));

  // --- Tidal modulation ---
  const smoothTideDepth = el.smooth(el.tau2pole(0.2), el.const({ key: `${key}:tideDepth`, value: tideDepth }));
  const smoothTideRate = el.smooth(el.tau2pole(0.5), el.const({ key: `${key}:tideRate`, value: tideRate }));
  const tide1 = el.cycle(smoothTideRate);
  const tide2 = el.cycle(el.mul(smoothTideRate, 1.618));
  const tide3 = el.cycle(el.mul(smoothTideRate, 0.382));
  const combinedTide = el.mul(0.33, el.add(tide1, el.mul(0.6, tide2), el.mul(0.4, tide3)));
  const tideAmp = el.sub(1, el.mul(smoothTideDepth, el.mul(0.5, el.sub(1, combinedTide))));

  const smoothDrift = el.smooth(el.tau2pole(0.2), el.const({ key: `${key}:drift`, value: drift }));
  const smoothDepth = el.smooth(el.tau2pole(0.3), el.const({ key: `${key}:depth`, value: resonanceDepth }));
  const smoothQ = el.smooth(el.tau2pole(0.1), el.const({ key: `${key}:q`, value: q }));

  let leftSum: NodeRepr_t = el.const({ value: 0 });
  let rightSum: NodeRepr_t = el.const({ value: 0 });

  for (let i = 0; i < 6; i++) {
    const intervalSemitones = CHORD_INTERVALS[i] * harmonicSpread;
    const baseHz = midiToHz(rootNote + intervalSemitones);
    const baseFreqSignal = el.const({ key: `${key}:freq${i}`, value: baseHz });

    // Drift
    const driftLfo = el.cycle(el.const({ key: `${key}:driftRate${i}`, value: DRIFT_RATES[i] }));
    const driftSemitones = el.mul(smoothDrift, 0.5, driftLfo);
    const driftRatio = el.pow(2, el.div(driftSemitones, 12));
    const resonatorFreq = el.mul(baseFreqSignal, driftRatio);

    // === 4 cascaded bandpass filter passes ===
    // Pass 1: noise → bandpass (pitched noise)
    const pass1L = el.bandpass(resonatorFreq, smoothQ, excitationL);
    const pass1R = el.bandpass(resonatorFreq, smoothQ, excitationR);

    // Pass 2: tighter bandwidth, tone starts emerging
    const pass2L = el.bandpass(resonatorFreq, smoothQ, pass1L);
    const pass2R = el.bandpass(resonatorFreq, smoothQ, pass1R);

    // Pass 3: clearly tonal with noise texture
    const pass3L = el.bandpass(resonatorFreq, smoothQ, pass2L);
    const pass3R = el.bandpass(resonatorFreq, smoothQ, pass2R);

    // Pass 4: nearly pure tone
    const pass4L = el.bandpass(resonatorFreq, smoothQ, pass3L);
    const pass4R = el.bandpass(resonatorFreq, smoothQ, pass3R);

    // Crossfade through the passes based on resonanceDepth:
    // 0.0 → pass1 (noise)
    // 0.33 → pass2
    // 0.66 → pass3
    // 1.0 → pass4
    //
    // We interpolate between adjacent passes for smooth transition.
    // depth * 3 gives us a 0-3 range, floor = which pair to blend
    const scaledDepth = el.mul(smoothDepth, 3);

    // Blend pass1 → pass2 (depth 0-0.33, scaledDepth 0-1)
    const blend12 = el.min(1, scaledDepth); // 0 to 1
    const mix12L = el.add(el.mul(el.sub(1, blend12), pass1L), el.mul(blend12, pass2L));
    const mix12R = el.add(el.mul(el.sub(1, blend12), pass1R), el.mul(blend12, pass2R));

    // Blend pass2 → pass3 (depth 0.33-0.66, scaledDepth 1-2)
    const blend23 = el.min(1, el.max(0, el.sub(scaledDepth, 1)));
    const mix23L = el.add(el.mul(el.sub(1, blend23), mix12L), el.mul(blend23, pass3L));
    const mix23R = el.add(el.mul(el.sub(1, blend23), mix12R), el.mul(blend23, pass3R));

    // Blend pass3 → pass4 (depth 0.66-1.0, scaledDepth 2-3)
    const blend34 = el.min(1, el.max(0, el.sub(scaledDepth, 2)));
    const finalL = el.add(el.mul(el.sub(1, blend34), mix23L), el.mul(blend34, pass4L));
    const finalR = el.add(el.mul(el.sub(1, blend34), mix23R), el.mul(blend34, pass4R));

    // Gain compensation: cascaded filters reduce volume dramatically
    // Boost higher passes proportionally
    const gainComp = el.add(1, el.mul(smoothDepth, 25));

    // Per-voice subtle amplitude variation
    const ampLfo = el.add(1, el.mul(0.1, el.cycle(el.const({ key: `${key}:resAmp${i}`, value: DRIFT_RATES[5 - i] * 0.7 }))));

    const scaledL = el.mul(finalL, gainComp, ampLfo);
    const scaledR = el.mul(finalR, gainComp, ampLfo);

    // Stereo
    const panAngle = RESONATOR_PANS[i] * Math.PI / 2;
    leftSum = el.add(leftSum, el.mul(Math.cos(panAngle), scaledL));
    rightSum = el.add(rightSum, el.mul(Math.sin(panAngle), scaledR));
  }

  // Tidal modulation
  leftSum = el.mul(leftSum, tideAmp);
  rightSum = el.mul(rightSum, tideAmp);

  // A touch of raw noise for air at low resonance depths
  const airAmount = el.mul(el.sub(1, smoothDepth), 0.03);
  leftSum = el.add(leftSum, el.mul(airAmount, excitationL));
  rightSum = el.add(rightSum, el.mul(airAmount, excitationR));

  // Reverb
  const revL = el.add(leftSum,
    el.mul(0.25, el.delay({ size: 88200 }, el.ms2samps(163), 0.4, el.lowpass(2500, 0.7, leftSum))),
    el.mul(0.18, el.delay({ size: 88200 }, el.ms2samps(241), 0.35, el.lowpass(2000, 0.7, leftSum))),
    el.mul(0.1, el.delay({ size: 88200 }, el.ms2samps(397), 0.25, el.lowpass(1500, 0.7, leftSum))),
  );
  const revR = el.add(rightSum,
    el.mul(0.25, el.delay({ size: 88200 }, el.ms2samps(179), 0.4, el.lowpass(2500, 0.7, rightSum))),
    el.mul(0.18, el.delay({ size: 88200 }, el.ms2samps(257), 0.35, el.lowpass(2000, 0.7, rightSum))),
    el.mul(0.1, el.delay({ size: 88200 }, el.ms2samps(419), 0.25, el.lowpass(1500, 0.7, rightSum))),
  );

  const smoothGain = el.smooth(el.tau2pole(0.02), el.const({ key: `${key}:gain`, value: gain }));
  return {
    left: el.mul(smoothGain, el.dcblock(revL)),
    right: el.mul(smoothGain, el.dcblock(revR)),
  };
}
