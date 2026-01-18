---
name: el-audio
description: Create music and audio with Elementary Audio. Use when building synthesizers, audio effects, sound design, DSP, or when the user mentions Elementary Audio, el.*, audio graphs, or web audio synthesis.
---

# Elementary Audio Development Guide

Elementary Audio is a JavaScript library for digital signal processing (DSP) with a declarative, functional approach. It separates the audio graph description (JS) from the audio engine (C++/WebAssembly), enabling efficient real-time audio in browsers, Node.js, and native applications.

## Core Concepts

### 1. Audio Graphs as Functions

Elementary treats audio as **continuous mathematical functions**, not discrete samples. You describe *what* sound you want, not *how* to compute each sample.

```js
import { el } from '@elemaudio/core';

// A 440Hz sine wave is just a function composition
const tone = el.cycle(440);

// More explicit: sine of a scaled phasor
const tone2 = el.sin(el.mul(2 * Math.PI, el.phasor(440)));
```

### 2. The Renderer Pattern

The renderer converts your virtual audio graph into real audio processing:

```js
import { WebRenderer } from '@elemaudio/web-renderer';

const core = new WebRenderer();

// Initialize with AudioContext
const ctx = new AudioContext();
const node = await core.initialize(ctx, {
  numberOfInputs: 0,
  numberOfOutputs: 1,
  outputChannelCount: [2],
});
node.connect(ctx.destination);

// Render audio (one argument per output channel)
core.render(leftChannel, rightChannel);
```

### 3. Reconciliation (React-like Updates)

When you call `render()` again, Elementary **diffs** the new graph against the old one and applies minimal changes:

```js
// Initial render
core.render(el.cycle(440), el.cycle(440));

// Later: only the frequency changes, graph structure stays
core.render(el.cycle(880), el.cycle(880));
```

## Installation

```bash
npm install @elemaudio/core @elemaudio/web-renderer
# or for Node.js offline processing:
npm install @elemaudio/core @elemaudio/offline-renderer
```

## Packages

| Package | Use Case |
|---------|----------|
| `@elemaudio/core` | Audio graph primitives, always required |
| `@elemaudio/web-renderer` | Browser Web Audio API integration |
| `@elemaudio/offline-renderer` | Node.js file processing |

## Essential Primitives

### Oscillators

```js
// Band-limited oscillators (use for audio-rate)
el.cycle(freq)        // Sine wave
el.blepsaw(freq)      // Sawtooth (anti-aliased)
el.blepsquare(freq)   // Square (anti-aliased)
el.bleptriangle(freq) // Triangle (anti-aliased)

// Naive oscillators (use for LFOs/control signals only)
el.saw(freq)          // Aliased sawtooth
el.square(freq)       // Aliased square
el.triangle(freq)     // Aliased triangle

// Timing/modulation
el.phasor(freq)       // Ramp 0 to 1 at given frequency
el.train(freq)        // Pulse train (0/1) at given frequency
```

### Noise

```js
el.noise()            // White noise [-1, 1]
el.noise({seed: 42})  // Seeded for reproducibility
el.pinknoise()        // Pink noise (1/f spectrum)
```

### Math Operations

```js
// Arithmetic (variadic - accepts multiple inputs)
el.add(a, b, c, ...)  // Sum signals
el.sub(a, b)          // Subtract
el.mul(a, b, c, ...)  // Multiply signals
el.div(a, b)          // Divide

// Trigonometric
el.sin(x)             // Sine
el.cos(x)             // Cosine
el.tan(x)             // Tangent
el.tanh(x)            // Hyperbolic tangent (great for saturation)

// Utilities
el.abs(x)             // Absolute value
el.sqrt(x)            // Square root
el.pow(base, exp)     // Power
el.exp(x)             // e^x
el.ln(x)              // Natural log
el.log(x)             // Log base 10
el.log2(x)            // Log base 2

// Rounding
el.floor(x)
el.ceil(x)
el.round(x)

// Comparison (return 1 or 0)
el.le(a, b)           // a < b
el.leq(a, b)          // a <= b
el.ge(a, b)           // a > b
el.geq(a, b)          // a >= b
el.eq(a, b)           // a == b

// Logic
el.and(a, b)          // Logical AND
el.or(a, b)           // Logical OR

// Selection
el.select(gate, a, b) // Returns a when gate=1, b when gate=0
                      // Interpolates for values between 0-1
```

### Constants

```js
el.const({value: 440})  // Explicit constant node
el.const({key: 'freq', value: 440})  // Keyed for updates

// Shorthand: plain numbers auto-convert to constants
el.cycle(440)  // Same as el.cycle(el.const({value: 440}))
```

### Filters

```js
// Simple filters (fc = cutoff frequency, q = resonance)
el.lowpass(fc, q, input)
el.highpass(fc, q, input)
el.bandpass(fc, q, input)

// State Variable Filter (multi-mode)
el.svf({mode: 'lowpass'}, fc, q, input)
// modes: 'lowpass', 'highpass', 'bandpass', 'notch', 'allpass'

// Biquad (raw coefficients)
el.biquad(b0, b1, b2, a1, a2, input)

// One-pole smoothing
el.smooth(pole, input)
el.pole(pole, input)

// DC blocker
el.dcblock(input)
```

### Envelopes

```js
// ADSR envelope (times in seconds, sustain is level 0-1)
el.adsr(attack, decay, sustain, release, gate)

// Example: 10ms attack, 100ms decay, 0.7 sustain, 200ms release
const env = el.adsr(0.01, 0.1, 0.7, 0.2, gate);
const sound = el.mul(env, el.blepsaw(440));
```

### Delay

```js
// Variable delay with feedback
el.delay({size: 44100}, delaySamples, feedback, input)

// size: maximum delay length in samples (required)
// delaySamples: current delay time in samples
// feedback: -1 to 1
// input: signal to delay

// Convert ms to samples
el.ms2samps(delayMs)

// Example: 250ms delay with 0.5 feedback
el.delay({size: 44100}, el.ms2samps(250), 0.5, input)
```

### Sample Playback

```js
// Trigger sample on rising edge of pulse
el.sample({path: 'kick.wav'}, trigger, rate)

// Properties:
// path: name in Virtual File System
// mode: 'trigger' (default), 'gate', or 'loop'
// startOffset: samples from beginning
// stopOffset: samples from end

// Example: drum pattern
el.sample(
  {path: 'kick.wav', mode: 'trigger'},
  el.seq({seq: [1, 0, 0, 0, 1, 0, 0, 0]}, el.train(4)),
  1.0
)
```

### Sequencing

```js
// Step sequencer
el.seq({seq: [1, 0, 1, 0]}, trigger, reset)
// seq: array of values to output
// trigger: advance on rising edge
// reset: return to start on rising edge
// loop: true by default

// Sparse sequencer (trigger at specific times)
el.sparseq({seq: [{value: 1, time: 0}, {value: 0.5, time: 0.5}]}, trigger, reset)

// Sample and hold
el.latch(trigger, input)  // Captures input value on trigger rising edge
```

### Analysis & Metering

```js
// Peak meter (emits events)
el.meter({name: 'output'}, input)

// Listen for meter events
core.on('meter', (e) => {
  if (e.source === 'output') {
    console.log(`Peak: ${e.max}`);
  }
});

// Snapshot signal value
el.snapshot({name: 'freq'}, trigger, signal)
```

### Dynamics

```js
// Compressor
el.compress(attackMs, releaseMs, threshold, ratio, sidechain, input)

// Example: -12dB threshold, 4:1 ratio
el.compress(10, 100, -12, 4, input, input)
```

## Key Concepts

### Understanding Keys

Keys help Elementary identify nodes across renders for efficient updates:

```js
// Without key: changing frequency rebuilds the node
el.cycle(440)  // First render
el.cycle(880)  // Completely different node!

// With key: Elementary recognizes it's the same oscillator
el.cycle({key: 'osc1'}, 440)  // First render
el.cycle({key: 'osc1'}, 880)  // Same node, just update frequency
```

**When to use keys:**
- Polyphonic synthesizers (key per voice)
- Any parameter that changes during playback
- Leaf nodes (constants) that need smooth updates

```js
// Polyphonic voice example
function voice(note, gate, key) {
  const freq = 440 * Math.pow(2, (note - 69) / 12);
  return el.mul(
    el.adsr({key: `${key}:env`}, 0.01, 0.1, 0.7, 0.2, el.const({key: `${key}:gate`, value: gate})),
    el.blepsaw(el.const({key: `${key}:freq`, value: freq}))
  );
}
```

### Using Refs (Direct Property Updates)

Refs bypass graph reconciliation for maximum efficiency:

```js
// Create a ref for the cutoff frequency
const [cutoffNode, setCutoff] = core.createRef('const', {value: 1000}, []);

// Use in graph
core.render(el.lowpass(cutoffNode, 1, input), el.lowpass(cutoffNode, 1, input));

// Update directly without re-rendering
setCutoff({value: 2000});  // Instant update!
```

### Virtual File System (VFS)

Load audio samples into the VFS before using them:

```js
// Load samples during initialization
await core.initialize(ctx, {
  processorOptions: {
    virtualFileSystem: {
      'kick.wav': kickBuffer,      // Float32Array
      'snare.wav': snareBuffer,
    }
  }
});

// Or add later
core.updateVirtualFileSystem({
  'hihat.wav': hihatBuffer,
});

// Use in graph
el.sample({path: 'kick.wav'}, trigger, 1)
```

### Multi-Channel Output

Each `render()` argument is one output channel:

```js
// Stereo output
const left = el.cycle(440);
const right = el.cycle(442);  // Slight detune for width
core.render(left, right);

// Mono (duplicate to both channels)
const mono = el.cycle(440);
core.render(mono, mono);
```

## Common Patterns

### Simple Synthesizer

```js
function synth(freq, gate) {
  const env = el.adsr(0.01, 0.1, 0.7, 0.3, gate);
  const osc = el.add(
    el.mul(0.5, el.blepsaw(freq)),
    el.mul(0.5, el.blepsaw(el.mul(freq, 1.01)))  // Slight detune
  );
  const filtered = el.lowpass(
    el.mul(env, 2000),  // Envelope controls filter
    2,
    osc
  );
  return el.mul(env, filtered);
}
```

### Delay Effect

```js
function pingPongDelay(input, delayMs, feedback, mix) {
  const delaySamps = el.ms2samps(delayMs);
  const left = el.delay({size: 88200}, delaySamps, feedback, input);
  const right = el.delay({size: 88200}, el.mul(delaySamps, 2), feedback, input);

  return {
    left: el.add(el.mul(1 - mix, input), el.mul(mix, left)),
    right: el.add(el.mul(1 - mix, input), el.mul(mix, right)),
  };
}
```

### Drum Machine

```js
function drumMachine(bpm) {
  const beatFreq = bpm / 60;
  const sixteenth = el.train(beatFreq * 4);

  const kick = el.sample(
    {path: 'kick.wav'},
    el.seq({seq: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]}, sixteenth),
    1
  );

  const snare = el.sample(
    {path: 'snare.wav'},
    el.seq({seq: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0]}, sixteenth),
    1
  );

  const hihat = el.sample(
    {path: 'hihat.wav'},
    el.seq({seq: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0]}, sixteenth),
    0.7
  );

  return el.add(kick, snare, el.mul(0.5, hihat));
}
```

### FM Synthesis

```js
function fmSynth(carrierFreq, modRatio, modIndex, gate) {
  const env = el.adsr(0.01, 0.2, 0.5, 0.3, gate);
  const modFreq = el.mul(carrierFreq, modRatio);
  const modAmp = el.mul(modIndex, modFreq);

  // Modulator
  const modulator = el.mul(modAmp, el.cycle(modFreq));

  // Carrier with FM
  const carrier = el.cycle(el.add(carrierFreq, modulator));

  return el.mul(env, carrier);
}
```

### Saturation/Distortion

```js
function saturate(input, drive) {
  // Soft clipping with tanh
  return el.tanh(el.mul(drive, input));
}

function hardClip(input, threshold) {
  return el.select(
    el.ge(input, threshold),
    threshold,
    el.select(el.le(input, el.mul(-1, threshold)), el.mul(-1, threshold), input)
  );
}
```

## Sample Rate and Timing

```js
el.sr()               // Current sample rate
el.time()             // Current time in samples
el.ms2samps(ms)       // Convert milliseconds to samples
el.tau2pole(tau)      // Convert time constant to pole coefficient
el.db2gain(db)        // Convert decibels to linear gain
```

## Event System

```js
// Listen for events from analysis nodes
core.on('meter', (e) => {
  console.log(`${e.source}: min=${e.min}, max=${e.max}`);
});

core.on('snapshot', (e) => {
  console.log(`${e.source}: value=${e.data}`);
});
```

## Best Practices

1. **Pre-compute constants**: Use `2 * Math.PI` instead of `el.mul(2, Math.PI)`
2. **Use band-limited oscillators** (`blepsaw`, `blepsquare`) for audio-rate signals
3. **Use naive oscillators** (`saw`, `square`) only for LFOs
4. **Add keys to nodes** that change frequently
5. **Use refs** for high-frequency parameter updates (knobs, sliders)
6. **Load samples in VFS** before building graphs that use them
7. **Use `el.smooth`** to prevent clicks from abrupt parameter changes

## Threading Model

- **Main thread**: JavaScript, graph construction, `render()` calls
- **Audio thread**: Real-time audio processing

Changes apply at the **start of the next audio block** (a few ms latency). For sample-accurate timing, express modulation as signals rather than JS updates:

```js
// JS-computed (block-rate, few ms latency)
setInterval(() => {
  setCutoff({value: newValue});
}, 10);

// Signal-rate (sample-accurate)
const lfo = el.mul(1000, el.add(1, el.cycle(1)));
el.lowpass(lfo, 1, input);
```

## Resources

- [Elementary Audio Documentation](https://www.elementary.audio/docs)
- [GitHub Repository](https://github.com/elemaudio/elementary)
- [Online Playground](https://www.elementary.audio/playground)
