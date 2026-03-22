# Tidal Shaping

## Core Metaphor: The Shoreline

The website is a shoreline—a place shaped by forces larger than any single visit. Visitors don't come to sculpt. They arrive, interact, leave and leave behind traces of their interactions for the next visitor. Shaped by multiple visits, the site's imagery and sound erodes and lays bare new visuals and sounds.

---

## Tidal Indifference - Order out of chaos

Multiple visitors coming and going may be represented as tides coming and going.

The tide doesn't intend to sculpt. It just arrives and withdraws. The artistry is accidental, emerging from repetition meeting resistance.

- No single visitor can cause big shifts in the progress of the piece.
- Visitors leave traces they'll never see

---

## Asymmetry in Symmetry

Each cycle deposits and removes, but never in equal measure. Some grains stay, some leave. Over thousands of identical motions, bias may accumulate into form.

- Visitors are the asymmetries—the small biases that accumulate into transformation

---

## Memory Without a Mind

The shoreline as a recording medium. Every storm, every calm season, every shift in current—it's all written in the geometry. But there's no retrieval, no playback.

- The website doesn't store a history
- It doesn't narrate its own evolution
- Its current state _is_ the memory
- The form is the only record

Visitors can't compare to what was before. They only see the shoreline as it is now—shaped by everyone who came before them, shaping it imperceptibly for everyone who comes after.

**The inversion:** Every visitor thinks they're observing the site, but actually the site is being _written by_ their observation.

---

# How Visits Shape Sound

## The Sediment Model

Every visit deposits a small trace — not a recording, not a message, but a tiny shift in the parameters that shape the sound. These traces accumulate like sediment.

The piece has **layers**, like geological strata:

### Layer 1: Noise (the surface)
What you hear when the site is "fresh" or unvisited. Diffuse, textured, unpitched. The raw material. Like sand covering everything.

### Layer 2: The Melody (bedrock)
A melody lives underneath the noise — it's always been there, but it's buried. It can only be heard when enough noise has been eroded away. The melody is not "added" by visitors; it's **revealed** by their cumulative presence.

### Layer 3+: Counterpoint (deeper strata)
Below the first melody, there are more voices — transformations of the original melody (transposed, inverted, slowed down). These are the deeper fossils. Reaching them requires sustained visitation over longer periods. A second voice appearing after weeks of visits is like finding a new geological layer exposed by erosion.

## What a visit deposits

When a visitor interacts with the site (visual path, time spent, specific interactions), their visit shifts the sound parameters slightly:

- **Tonality** nudges upward — noise erodes a tiny bit, tone becomes slightly more present
- **Voice parameters** shift — the timbre, vibrato character, or brightness tilts based on the visitor's path
- **Harmonic clarity** may increase — resonators tune slightly more precisely

These changes are small (no single visit causes a big shift) but they **persist**. The next visitor inherits the accumulated state.

## What inactivity deposits

Without visitors, the process reverses slowly — noise accumulates, covering the tone back up. The melody doesn't disappear; it gets buried again. This means:

- A site visited daily sounds different from one visited weekly
- Periods of absence create a kind of silence in the sediment record
- The piece can "breathe" — clarity emerging and receding over days and weeks
- Returning after absence, you find the shoreline has changed

## Simultaneous presence (secondary)

When multiple visitors happen to be present at the same time, the erosion is slightly amplified — not doubled, but resonant. Two waves arriving together cut slightly deeper than two waves arriving separately. This creates a subtle incentive for shared presence without making it required.

---

# Sound Architecture

## The Noise→Tone Spectrum

The fundamental sound parameter is a continuum from noise to tone:

```
noise ──────────────────── tone
(unvisited)              (deeply eroded)
```

This isn't just a filter — it's a crossfade between:
- **Noise layer**: bandpass-filtered noise at the melody's pitch (you hear texture, not notes)
- **Tone layer**: pure sine oscillators at the same pitch (you hear clear melody)

The crossfade position = accumulated visitor erosion. This is the "Sine Emergence" concept.

## Per-Note Expression

Even as the overall tonality shifts with visitor accumulation, each individual note in the melody has its own micro-arc:

- **Attack**: starts noisy (breath, bow scrape — the noise of beginning)
- **Sustain**: crystallizes to the current tonality level
- **Release**: dissolves back toward noise

This means even in a highly "eroded" (tonal) state, each note still has a whisper of noise at its edges — like a singer's breath is always audible, no matter how pure the voice.

## Voices / Counterpoint

Multiple melodic voices exist as geological layers at different depths:

| Voice | Transformation | Erosion depth needed |
|-------|---------------|---------------------|
| 1 | Original melody | Shallow — first to emerge |
| 2 | Canon at the 5th, delayed | Moderate — appears after sustained visits |
| 3 | Augmented (half speed), octave below | Deep — becomes a slow bass line |
| 4 | Inverted | Deepest — only after extensive erosion |

Each voice has its own tonality level based on how far the erosion has reached. Voice 1 might be mostly tonal while Voice 4 is still buried in noise. This creates natural counterpoint: the voices don't all arrive at once, they emerge gradually from the same noise bed.

## Drone Layer

A quiet sustained drone (root + fifth) sits beneath everything, also on the noise→tone spectrum. It provides harmonic grounding even in the most diffuse states. Its tonality is always slightly behind the melody — the last thing to fully emerge, the first thing to be buried again.

---

# Sound Ideas

## Sound Atom: Noise clicks / noise bursts, neutral sound

Noise doesn't become music because it's repeated. It becomes music because it's repeated with care.

### Implementation

- Track inter-event timing consistency per user
- Reward low variance, not speed
- Ignore frantic interaction

### Musical result

- Irregular blips begin to quantize softly
- Rhythmic implication emerges without hard grids
- Beats are suggested, never enforced

Think: pulse before beat.

```
chaos → pulse → pattern
```

Also include silence!, perhaps when low activity of users.

Harmony emerges as spectral order, not chords.

### Technique Ideas for creating spectral sounds from the noise

- Gradual band-pass narrowing
- Formant-like filtering
- Spectral centroid stabilization
- Resonant filters that "lock" under repetition
- **Cascaded bandpass filters** — stacking 1→4 filters narrows bandwidth exponentially, creating tones from noise without adding oscillators

---

## Long-Term Musical Form (Live Website Friendly)

You don't want loops. You want states.

### Example macro-states

1. **Diffuse** – noise, sparse, unstable (few visits, or long absence)
2. **Pulsing** – rhythmic suggestion (some accumulated visits)
3. **Focused** – narrow spectrum, resonance (regular visitation)
4. **Clear** – sustained, harmonically stable, counterpoint audible (deeply eroded)
5. **Fragile** – clarity that can be lost (erosion near its peak, vulnerable to absence)

Transitions are slow and driven by visitor accumulation, not by any single interaction.

Importantly:

- No state is labeled
- No state is "best"
- Clear states require maintenance, not conquest

---

## Player Interactions

### Attentive Agency

- "If I do X, I feel the system change"
- No fixed outcomes
- Progress is internal and perceptual
- Encourages listening, timing, restraint

---

## Agency by Macro-State

### Diffuse — Unreliable Agency

- Actions dissipate
- Space doesn't "hold" intention
- You feel present but ineffective

This teaches patience without punishment.

### Pulsing — Temporal Agency

- Timing starts to matter
- Repetition stabilizes effects
- You feel rhythm, not control

Agency exists, but only through time.

### Focused — Directional Agency

- Small choices have predictable influence
- Attentive movement shapes outcomes
- Sloppiness still works, but less well

This is where users feel skilled without power.

### Clear — Relational Agency

- Your actions matter because of accumulated others
- The clarity you hear was built by everyone before you
- Your contribution sustains it for those who come after

This is collective agency across time, not coordinated action.

### Fragile — Restraint as Agency

- Not acting is powerful
- Overaction degrades
- Presence is contribution

This is the rarest form of agency online.

---

# Think about removing sounds / visuals

Erosion doesn't only reveal — it also removes. Some visits might strip away clarity rather than build it. A visitor who interacts chaotically might add noise rather than erode it. This creates the asymmetry: most visits erode slightly, some visits deposit, and the balance determines the direction of the piece over time.
