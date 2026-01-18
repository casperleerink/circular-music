import { el } from "@elemaudio/core";
import type { NodeRepr_t } from "@elemaudio/core";

interface EnvelopeOptions {
  key: string;
  gate: number; // 0 or 1
  // Attack time in seconds
  attack?: number;
  // Sustain level (0-1)
  sustain?: number;
  // Release time in seconds (smoothing time constant)
  release?: number;
  // Tick time for sustain transition (at 1000 ticks/sec)
  sustainTickTime?: number;
}

/**
 * Creates an ADSR-like envelope that can be multiplied with any signal.
 *
 * Uses sparseq to define the envelope shape:
 * - Starts at 1.0 on gate rising edge (attack peak)
 * - Transitions to sustain level at sustainTickTime
 * - el.smooth provides the attack/release smoothing
 *
 * To trigger: render with gate=0, then render with gate=1
 * The envelope resets on the 0->1 transition.
 */
export function createEnvelope(options: EnvelopeOptions): NodeRepr_t {
  const {
    key,
    gate,
    attack = 0.01,
    sustain = 0.4,
    release = 0.1,
    sustainTickTime = 100,
  } = options;

  // Gate signal that toggles between 0 and 1
  const gateSignal = el.const({ key: `${key}:gate`, value: gate });

  // Sequence defines envelope shape:
  // - Start at 1.0 (peak)
  // - Drop to sustain level after sustainTickTime ticks
  // Resets on rising edge of gate
  const seq = el.sparseq(
    {
      key: `${key}:seq`,
      seq: [
        { value: 1, tickTime: 0 },
        { value: sustain, tickTime: sustainTickTime },
      ],
    },
    el.train(1000), // 1000 ticks per second
    gateSignal
  );

  // Smooth the envelope for attack/release curves
  // Use attack time when gate is high, release when low
  const smoothTime = gate === 1 ? attack : release;
  const env = el.smooth(el.tau2pole(smoothTime), el.mul(gateSignal, seq));

  return env;
}

/**
 * Apply an envelope to a signal (multiply them together)
 */
export function applyEnvelope(
  envelope: NodeRepr_t,
  signal: NodeRepr_t,
  gain = 0.3
): NodeRepr_t {
  return el.mul(gain, envelope, signal);
}
