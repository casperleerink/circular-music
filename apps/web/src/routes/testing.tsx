import { el } from "@elemaudio/core";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useAudio } from "@/hooks/use-audio";
import {
  createResonantTide,
  DEFAULT_RESONANT_TIDE_PARAMS,
  type ResonantTideParams,
  createSineEmergence,
  DEFAULT_SINE_EMERGENCE_PARAMS,
  type SineEmergenceParams,
  createKarplusTide,
  DEFAULT_KARPLUS_TIDE_PARAMS,
  type KarplusTideParams,
  createCascadedResonance,
  DEFAULT_CASCADED_RESONANCE_PARAMS,
  type CascadedResonanceParams,
} from "@/lib/audio/expressive-synths";
import { createGranular, type GranularParams, type GrainEnvelope } from "@/lib/audio/granular";
import {
  createMelodicEmergence,
  DEFAULT_MELODIC_EMERGENCE_PARAMS,
  type MelodicEmergenceParams,
} from "@/lib/audio/melodic-emergence";
import {
  createTidalEmergence,
  DEFAULT_TIDAL_EMERGENCE_PARAMS,
  type TidalEmergenceParams,
} from "@/lib/audio/tidal-emergence";
import {
  createMelodySynth,
  DEFAULT_MELODY_PARAMS,
  type MelodySynthParams,
  type MelodyWaveform,
} from "@/lib/audio/melody-synth";
import {
  createResonator,
  type ResonatorParams,
} from "@/lib/audio/resonator";

export const Route = createFileRoute("/testing")({
  component: HomeComponent,
});

// Available audio samples
const AUDIO_SAMPLES = [
  { id: "acadia", name: "Acadia Waves", file: "acadia_waves.mp3" },
  { id: "circle", name: "Circle Improv", file: "circle_improv_3.mp3" },
  { id: "melody", name: "Melody Loop", file: "melody_loop.mp3" },
] as const;

type SampleId = (typeof AUDIO_SAMPLES)[number]["id"];

// Sample data stored outside component to persist across renders
const sampleData: Record<SampleId, { buffer: Float32Array; length: number } | null> = {
  acadia: null,
  circle: null,
  melody: null,
};

async function loadSamples(
  ctx: AudioContext,
  updateVFS: (entries: Record<string, Float32Array>) => void,
) {
  const vfsEntries: Record<string, Float32Array> = {};

  // Load all audio samples in parallel
  await Promise.all(
    AUDIO_SAMPLES.map(async (sample) => {
      const response = await fetch(`/audio/${sample.file}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const channelData = audioBuffer.getChannelData(0);

      // Add to VFS entries
      vfsEntries[`/samples/${sample.id}`] = channelData;

      // Store metadata
      sampleData[sample.id] = {
        buffer: channelData,
        length: channelData.length,
      };

      console.log(`Sample loaded: ${sample.name}`, {
        length: channelData.length,
        duration: audioBuffer.duration,
      });
    })
  );

  // Update VFS with all samples at once
  updateVFS(vfsEntries);
}

function HomeComponent() {
  const [started, setStarted] = useState(false);
  const [samplesLoaded, setSamplesLoaded] = useState(false);
  const audio = useAudio();

  const handleStart = async () => {
    const ctx = await audio.initialize();
    setStarted(true);

    // Load samples after audio context is ready
    if (ctx) {
      await loadSamples(ctx, audio.updateVirtualFileSystem);
      setSamplesLoaded(true);
    }
  };

  if (!started) {
    return <WelcomeScreen onStart={handleStart} />;
  }

  return <AudioPlayground samplesLoaded={samplesLoaded} />;
}

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-4xl font-bold tracking-tight">Circular Music</h1>
        <p className="text-muted-foreground">Generative audio experiments</p>
      </div>
      <Button size="lg" onClick={onStart}>
        Get Started
      </Button>
    </div>
  );
}

function AudioPlayground({ samplesLoaded }: { samplesLoaded: boolean }) {
  const audio = useAudio();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isResonatorPlaying, setIsResonatorPlaying] = useState(false);
  const [isMelodyPlaying, setIsMelodyPlaying] = useState(false);
  const [selectedSample, setSelectedSample] = useState<SampleId>("acadia");

  // Granular parameter state
  const [grainSize, setGrainSize] = useState(25);
  const [density, setDensity] = useState(10);
  const [position, setPosition] = useState(0.5);
  const [pitch, setPitch] = useState(1);
  const [positionSpray, setPositionSpray] = useState(0.1);
  const [pitchSpray, setPitchSpray] = useState(0.05);
  const [stereoSpread, setStereoSpread] = useState(0.5);
  const [gain, setGain] = useState(0.5);
  const [envelope, setEnvelope] = useState<GrainEnvelope>("hann");

  // Melody synth parameter state
  const [melodyWaveform, setMelodyWaveform] = useState<MelodyWaveform>(DEFAULT_MELODY_PARAMS.waveform);
  const [melodyDetune, setMelodyDetune] = useState(DEFAULT_MELODY_PARAMS.detune);
  const [melodyAttack, setMelodyAttack] = useState(DEFAULT_MELODY_PARAMS.attack);
  const [melodyRelease, setMelodyRelease] = useState(DEFAULT_MELODY_PARAMS.release);
  const [melodyReverbMix, setMelodyReverbMix] = useState(DEFAULT_MELODY_PARAMS.reverbMix);
  const [melodyGain, setMelodyGain] = useState(DEFAULT_MELODY_PARAMS.gain);
  const [filterCutoff, setFilterCutoff] = useState(DEFAULT_MELODY_PARAMS.filterCutoff);
  const [filterEnvAmount, setFilterEnvAmount] = useState(DEFAULT_MELODY_PARAMS.filterEnvAmount);
  const [filterAttack, setFilterAttack] = useState(DEFAULT_MELODY_PARAMS.filterAttack);
  const [filterRelease, setFilterRelease] = useState(DEFAULT_MELODY_PARAMS.filterRelease);
  const [filterQ, setFilterQ] = useState(DEFAULT_MELODY_PARAMS.filterQ);

  // === Sine Emergence parameter state ===
  const [isSineEmergencePlaying, setIsSineEmergencePlaying] = useState(false);
  const [seTonality, setSeTonality] = useState(DEFAULT_SINE_EMERGENCE_PARAMS.tonality);
  const [seRootNote, setSeRootNote] = useState(DEFAULT_SINE_EMERGENCE_PARAMS.rootNote);
  const [seDrift, setSeDrift] = useState(DEFAULT_SINE_EMERGENCE_PARAMS.drift);
  const [seTideRate, setSeTideRate] = useState(DEFAULT_SINE_EMERGENCE_PARAMS.tideRate);
  const [seTideDepth, setSeTideDepth] = useState(DEFAULT_SINE_EMERGENCE_PARAMS.tideDepth);
  const [seHarmonicSpread, setSeHarmonicSpread] = useState(DEFAULT_SINE_EMERGENCE_PARAMS.harmonicSpread);
  const [seNoiseColor, setSeNoiseColor] = useState(DEFAULT_SINE_EMERGENCE_PARAMS.noiseColor);
  const [seBrightness, setSeBrightness] = useState(DEFAULT_SINE_EMERGENCE_PARAMS.brightness);
  const [seGain, setSeGain] = useState(DEFAULT_SINE_EMERGENCE_PARAMS.gain);

  // === Karplus Tide parameter state ===
  const [isKarplusTidePlaying, setIsKarplusTidePlaying] = useState(false);
  const [ktRootNote, setKtRootNote] = useState(DEFAULT_KARPLUS_TIDE_PARAMS.rootNote);
  const [ktSustain, setKtSustain] = useState(DEFAULT_KARPLUS_TIDE_PARAMS.sustain);
  const [ktDamping, setKtDamping] = useState(DEFAULT_KARPLUS_TIDE_PARAMS.damping);
  const [ktExcitationRate, setKtExcitationRate] = useState(DEFAULT_KARPLUS_TIDE_PARAMS.excitationRate);
  const [ktDrift, setKtDrift] = useState(DEFAULT_KARPLUS_TIDE_PARAMS.drift);
  const [ktHarmonicSpread, setKtHarmonicSpread] = useState(DEFAULT_KARPLUS_TIDE_PARAMS.harmonicSpread);
  const [ktTideRate, setKtTideRate] = useState(DEFAULT_KARPLUS_TIDE_PARAMS.tideRate);
  const [ktTideDepth, setKtTideDepth] = useState(DEFAULT_KARPLUS_TIDE_PARAMS.tideDepth);
  const [ktGain, setKtGain] = useState(DEFAULT_KARPLUS_TIDE_PARAMS.gain);

  // === Cascaded Resonance parameter state ===
  const [isCascadedResPlaying, setIsCascadedResPlaying] = useState(false);
  const [crRootNote, setCrRootNote] = useState(DEFAULT_CASCADED_RESONANCE_PARAMS.rootNote);
  const [crResonanceDepth, setCrResonanceDepth] = useState(DEFAULT_CASCADED_RESONANCE_PARAMS.resonanceDepth);
  const [crQ, setCrQ] = useState(DEFAULT_CASCADED_RESONANCE_PARAMS.q);
  const [crDrift, setCrDrift] = useState(DEFAULT_CASCADED_RESONANCE_PARAMS.drift);
  const [crTideRate, setCrTideRate] = useState(DEFAULT_CASCADED_RESONANCE_PARAMS.tideRate);
  const [crTideDepth, setCrTideDepth] = useState(DEFAULT_CASCADED_RESONANCE_PARAMS.tideDepth);
  const [crHarmonicSpread, setCrHarmonicSpread] = useState(DEFAULT_CASCADED_RESONANCE_PARAMS.harmonicSpread);
  const [crNoiseColor, setCrNoiseColor] = useState(DEFAULT_CASCADED_RESONANCE_PARAMS.noiseColor);
  const [crGain, setCrGain] = useState(DEFAULT_CASCADED_RESONANCE_PARAMS.gain);

  // === Melodic Emergence parameter state ===
  const [isMelodicEmergencePlaying, setIsMelodicEmergencePlaying] = useState(false);
  const [meTonalityFloor, setMeTonalityFloor] = useState(DEFAULT_MELODIC_EMERGENCE_PARAMS.tonalityFloor);
  const [meTonalityCeil, setMeTonalityCeil] = useState(DEFAULT_MELODIC_EMERGENCE_PARAMS.tonalityCeil);
  const [meTonalityAttack, setMeTonalityAttack] = useState(DEFAULT_MELODIC_EMERGENCE_PARAMS.tonalityAttack);
  const [meTonalityRelease, setMeTonalityRelease] = useState(DEFAULT_MELODIC_EMERGENCE_PARAMS.tonalityRelease);
  const [meAttack, setMeAttack] = useState(DEFAULT_MELODIC_EMERGENCE_PARAMS.attack);
  const [meRelease, setMeRelease] = useState(DEFAULT_MELODIC_EMERGENCE_PARAMS.release);
  const [mePortamento, setMePortamento] = useState(DEFAULT_MELODIC_EMERGENCE_PARAMS.portamento);
  const [meVibratoRate, setMeVibratoRate] = useState(DEFAULT_MELODIC_EMERGENCE_PARAMS.vibratoRate);
  const [meVibratoDepth, setMeVibratoDepth] = useState(DEFAULT_MELODIC_EMERGENCE_PARAMS.vibratoDepth);
  const [meVibratoDelay, setMeVibratoDelay] = useState(DEFAULT_MELODIC_EMERGENCE_PARAMS.vibratoDelay);
  const [meDroneLevel, setMeDroneLevel] = useState(DEFAULT_MELODIC_EMERGENCE_PARAMS.droneLevel);
  const [meDroneTonality, setMeDroneTonality] = useState(DEFAULT_MELODIC_EMERGENCE_PARAMS.droneTonality);
  const [meNoiseColor, setMeNoiseColor] = useState(DEFAULT_MELODIC_EMERGENCE_PARAMS.noiseColor);
  const [meNoiseQ, setMeNoiseQ] = useState(DEFAULT_MELODIC_EMERGENCE_PARAMS.noiseQ);
  const [meReverbMix, setMeReverbMix] = useState(DEFAULT_MELODIC_EMERGENCE_PARAMS.reverbMix);
  const [meGain, setMeGain] = useState(DEFAULT_MELODIC_EMERGENCE_PARAMS.gain);

  // === Tidal Emergence parameter state ===
  const [isTidalEmergencePlaying, setIsTidalEmergencePlaying] = useState(false);
  const [teErosion, setTeErosion] = useState(DEFAULT_TIDAL_EMERGENCE_PARAMS.erosion);
  const [teVoice1Tonality, setTeVoice1Tonality] = useState(DEFAULT_TIDAL_EMERGENCE_PARAMS.voice1Tonality);
  const [teVoice2Tonality, setTeVoice2Tonality] = useState(DEFAULT_TIDAL_EMERGENCE_PARAMS.voice2Tonality);
  const [teVoice3Tonality, setTeVoice3Tonality] = useState(DEFAULT_TIDAL_EMERGENCE_PARAMS.voice3Tonality);
  const [teUseErosion, setTeUseErosion] = useState(DEFAULT_TIDAL_EMERGENCE_PARAMS.useErosion);
  const [tePortamento, setTePortamento] = useState(DEFAULT_TIDAL_EMERGENCE_PARAMS.portamento);
  const [teVibratoRate, setTeVibratoRate] = useState(DEFAULT_TIDAL_EMERGENCE_PARAMS.vibratoRate);
  const [teVibratoDepth, setTeVibratoDepth] = useState(DEFAULT_TIDAL_EMERGENCE_PARAMS.vibratoDepth);
  const [teNoiseColor, setTeNoiseColor] = useState(DEFAULT_TIDAL_EMERGENCE_PARAMS.noiseColor);
  const [teNoiseQ, setTeNoiseQ] = useState(DEFAULT_TIDAL_EMERGENCE_PARAMS.noiseQ);
  const [teReverbMix, setTeReverbMix] = useState(DEFAULT_TIDAL_EMERGENCE_PARAMS.reverbMix);
  const [teGain, setTeGain] = useState(DEFAULT_TIDAL_EMERGENCE_PARAMS.gain);

  // === Resonant Tide parameter state ===
  const [isResonantTidePlaying, setIsResonantTidePlaying] = useState(false);
  const [rtRootNote, setRtRootNote] = useState(DEFAULT_RESONANT_TIDE_PARAMS.rootNote);
  const [rtClarity, setRtClarity] = useState(DEFAULT_RESONANT_TIDE_PARAMS.clarity);
  const [rtDrift, setRtDrift] = useState(DEFAULT_RESONANT_TIDE_PARAMS.drift);
  const [rtTideRate, setRtTideRate] = useState(DEFAULT_RESONANT_TIDE_PARAMS.tideRate);
  const [rtTideDepth, setRtTideDepth] = useState(DEFAULT_RESONANT_TIDE_PARAMS.tideDepth);
  const [rtHarmonicSpread, setRtHarmonicSpread] = useState(DEFAULT_RESONANT_TIDE_PARAMS.harmonicSpread);
  const [rtNoiseColor, setRtNoiseColor] = useState(DEFAULT_RESONANT_TIDE_PARAMS.noiseColor);
  const [rtGain, setRtGain] = useState(DEFAULT_RESONANT_TIDE_PARAMS.gain);

  // Resonator parameter state
  const [band1Freq, setBand1Freq] = useState(220);
  const [band1Q, setBand1Q] = useState(80);
  const [band1Gain, setBand1Gain] = useState(0.8);
  const [band2Freq, setBand2Freq] = useState(440);
  const [band2Q, setBand2Q] = useState(80);
  const [band2Gain, setBand2Gain] = useState(0.6);
  const [band3Freq, setBand3Freq] = useState(880);
  const [band3Q, setBand3Q] = useState(80);
  const [band3Gain, setBand3Gain] = useState(0.4);
  const [resonatorMix, setResonatorMix] = useState(0.7);

  const currentSampleData = sampleData[selectedSample];
  const samplePath = `/samples/${selectedSample}`;

  const getGranularParams = (): GranularParams => ({
    samplePath,
    grainSize,
    density,
    position,
    pitch,
    positionSpray,
    pitchSpray,
    stereoSpread,
    gain,
    envelope,
  });

  const getResonatorParams = (): ResonatorParams => ({
    bands: [
      { freq: band1Freq, q: band1Q, gain: band1Gain },
      { freq: band2Freq, q: band2Q, gain: band2Gain },
      { freq: band3Freq, q: band3Q, gain: band3Gain },
    ],
    mix: resonatorMix,
  });

  const getMelodyParams = (): MelodySynthParams => ({
    waveform: melodyWaveform,
    detune: melodyDetune,
    attack: melodyAttack,
    release: melodyRelease,
    reverbMix: melodyReverbMix,
    gain: melodyGain,
    filterCutoff,
    filterEnvAmount,
    filterAttack,
    filterRelease,
    filterQ,
  });

  // === Melodic Emergence handlers ===
  const getMelodicEmergenceParams = (): MelodicEmergenceParams => ({
    tonalityFloor: meTonalityFloor,
    tonalityCeil: meTonalityCeil,
    tonalityAttack: meTonalityAttack,
    tonalityRelease: meTonalityRelease,
    attack: meAttack,
    release: meRelease,
    portamento: mePortamento,
    vibratoRate: meVibratoRate,
    vibratoDepth: meVibratoDepth,
    vibratoDelay: meVibratoDelay,
    droneLevel: meDroneLevel,
    droneTonality: meDroneTonality,
    noiseColor: meNoiseColor,
    noiseQ: meNoiseQ,
    reverbMix: meReverbMix,
    gain: meGain,
  });

  const handleMelodicEmergenceToggle = () => {
    if (!audio.isReady) return;
    if (isMelodicEmergencePlaying) {
      audio.removeSource("melodicEmergence");
      setIsMelodicEmergencePlaying(false);
    } else {
      const synth = createMelodicEmergence("melodicEmergence", getMelodicEmergenceParams());
      audio.setSource("melodicEmergence", synth, { gain: meGain });
      setIsMelodicEmergencePlaying(true);
    }
  };

  const handleMelodicEmergenceCommit = () => {
    if (!isMelodicEmergencePlaying || !audio.isReady) return;
    const synth = createMelodicEmergence("melodicEmergence", getMelodicEmergenceParams());
    audio.setSource("melodicEmergence", synth, { gain: meGain });
  };

  // === Tidal Emergence handlers ===
  const getTidalEmergenceParams = (): TidalEmergenceParams => ({
    erosion: teErosion,
    voice1Tonality: teVoice1Tonality,
    voice2Tonality: teVoice2Tonality,
    voice3Tonality: teVoice3Tonality,
    useErosion: teUseErosion,
    portamento: tePortamento,
    vibratoRate: teVibratoRate,
    vibratoDepth: teVibratoDepth,
    noiseColor: teNoiseColor,
    noiseQ: teNoiseQ,
    reverbMix: teReverbMix,
    gain: teGain,
  });

  const handleTidalEmergenceToggle = () => {
    if (!audio.isReady) return;
    if (isTidalEmergencePlaying) {
      audio.removeSource("tidalEmergence");
      setIsTidalEmergencePlaying(false);
    } else {
      const synth = createTidalEmergence("tidalEmergence", getTidalEmergenceParams());
      audio.setSource("tidalEmergence", synth, { gain: teGain });
      setIsTidalEmergencePlaying(true);
    }
  };

  const handleTidalEmergenceCommit = () => {
    if (!isTidalEmergencePlaying || !audio.isReady) return;
    const synth = createTidalEmergence("tidalEmergence", getTidalEmergenceParams());
    audio.setSource("tidalEmergence", synth, { gain: teGain });
  };

  // === Sine Emergence handlers ===
  const getSineEmergenceParams = (): SineEmergenceParams => ({
    rootNote: seRootNote,
    tonality: seTonality,
    drift: seDrift,
    tideRate: seTideRate,
    tideDepth: seTideDepth,
    harmonicSpread: seHarmonicSpread,
    noiseColor: seNoiseColor,
    brightness: seBrightness,
    gain: seGain,
  });

  const handleSineEmergenceToggle = () => {
    if (!audio.isReady) return;
    if (isSineEmergencePlaying) {
      audio.removeSource("sineEmergence");
      setIsSineEmergencePlaying(false);
    } else {
      const synth = createSineEmergence("sineEmergence", getSineEmergenceParams());
      audio.setSource("sineEmergence", synth, { gain: seGain });
      setIsSineEmergencePlaying(true);
    }
  };

  const handleSineEmergenceCommit = () => {
    if (!isSineEmergencePlaying || !audio.isReady) return;
    const synth = createSineEmergence("sineEmergence", getSineEmergenceParams());
    audio.setSource("sineEmergence", synth, { gain: seGain });
  };

  // === Karplus Tide handlers ===
  const getKarplusTideParams = (): KarplusTideParams => ({
    rootNote: ktRootNote,
    sustain: ktSustain,
    damping: ktDamping,
    excitationRate: ktExcitationRate,
    drift: ktDrift,
    harmonicSpread: ktHarmonicSpread,
    tideRate: ktTideRate,
    tideDepth: ktTideDepth,
    gain: ktGain,
  });

  const handleKarplusTideToggle = () => {
    if (!audio.isReady) return;
    if (isKarplusTidePlaying) {
      audio.removeSource("karplusTide");
      setIsKarplusTidePlaying(false);
    } else {
      const synth = createKarplusTide("karplusTide", getKarplusTideParams());
      audio.setSource("karplusTide", synth, { gain: ktGain });
      setIsKarplusTidePlaying(true);
    }
  };

  const handleKarplusTideCommit = () => {
    if (!isKarplusTidePlaying || !audio.isReady) return;
    const synth = createKarplusTide("karplusTide", getKarplusTideParams());
    audio.setSource("karplusTide", synth, { gain: ktGain });
  };

  // === Cascaded Resonance handlers ===
  const getCascadedResParams = (): CascadedResonanceParams => ({
    rootNote: crRootNote,
    resonanceDepth: crResonanceDepth,
    q: crQ,
    drift: crDrift,
    tideRate: crTideRate,
    tideDepth: crTideDepth,
    harmonicSpread: crHarmonicSpread,
    noiseColor: crNoiseColor,
    gain: crGain,
  });

  const handleCascadedResToggle = () => {
    if (!audio.isReady) return;
    if (isCascadedResPlaying) {
      audio.removeSource("cascadedRes");
      setIsCascadedResPlaying(false);
    } else {
      const synth = createCascadedResonance("cascadedRes", getCascadedResParams());
      audio.setSource("cascadedRes", synth, { gain: crGain });
      setIsCascadedResPlaying(true);
    }
  };

  const handleCascadedResCommit = () => {
    if (!isCascadedResPlaying || !audio.isReady) return;
    const synth = createCascadedResonance("cascadedRes", getCascadedResParams());
    audio.setSource("cascadedRes", synth, { gain: crGain });
  };

  // === Resonant Tide handlers ===
  const getResonantTideParams = (): ResonantTideParams => ({
    rootNote: rtRootNote,
    clarity: rtClarity,
    drift: rtDrift,
    tideRate: rtTideRate,
    tideDepth: rtTideDepth,
    harmonicSpread: rtHarmonicSpread,
    noiseColor: rtNoiseColor,
    gain: rtGain,
  });

  const handleResonantTideToggle = () => {
    if (!audio.isReady) return;
    if (isResonantTidePlaying) {
      audio.removeSource("resonantTide");
      setIsResonantTidePlaying(false);
    } else {
      const synth = createResonantTide("resonantTide", getResonantTideParams());
      audio.setSource("resonantTide", synth, { gain: rtGain });
      setIsResonantTidePlaying(true);
    }
  };

  const handleResonantTideCommit = () => {
    if (!isResonantTidePlaying || !audio.isReady) return;
    const synth = createResonantTide("resonantTide", getResonantTideParams());
    audio.setSource("resonantTide", synth, { gain: rtGain });
  };

  const handleMelodyToggle = () => {
    if (!audio.isReady) return;

    if (isMelodyPlaying) {
      audio.removeSource("melody");
      setIsMelodyPlaying(false);
    } else {
      const melody = createMelodySynth("melody", getMelodyParams());
      audio.setSource("melody", melody, { gain: melodyGain });
      setIsMelodyPlaying(true);
    }
  };

  const handleMelodySliderCommit = () => {
    if (!isMelodyPlaying || !audio.isReady) return;
    const melody = createMelodySynth("melody", getMelodyParams());
    audio.setSource("melody", melody, { gain: melodyGain });
  };

  const handleToggle = () => {
    if (!audio.isReady || !samplesLoaded || !currentSampleData) return;

    if (isPlaying) {
      audio.removeSource("granular");
      setIsPlaying(false);
    } else {
      const granular = createGranular(
        "granular",
        getGranularParams(),
        currentSampleData.length
      );
      audio.setSource("granular", granular, { gain });
      setIsPlaying(true);
    }
  };

  const handleResonatorToggle = () => {
    if (!audio.isReady || !samplesLoaded || !currentSampleData) return;

    if (isResonatorPlaying) {
      audio.removeSource("resonator");
      setIsResonatorPlaying(false);
    } else {
      // Play sample in a loop using el.table with a phasor
      const loopRate = 44100 / currentSampleData.length;
      const phasor = el.phasor(loopRate);
      const sampleSignal = el.table({ path: samplePath }, phasor);

      // Process through resonator
      const resonated = createResonator("resonator", getResonatorParams(), {
        left: sampleSignal,
        right: sampleSignal,
      });

      audio.setSource("resonator", resonated, { gain: 0.5 });
      setIsResonatorPlaying(true);
    }
  };

  const handleSliderCommit = () => {
    if (!isPlaying || !audio.isReady || !currentSampleData) return;
    const granular = createGranular(
      "granular",
      getGranularParams(),
      currentSampleData.length
    );
    audio.setSource("granular", granular, { gain });
  };

  const handleResonatorSliderCommit = () => {
    if (!isResonatorPlaying || !audio.isReady || !currentSampleData) return;
    // Play sample in a loop using el.table with a phasor
    const loopRate = 44100 / currentSampleData.length;
    const phasor = el.phasor(loopRate);
    const sampleSignal = el.table({ path: samplePath }, phasor);

    const resonated = createResonator("resonator", getResonatorParams(), {
      left: sampleSignal,
      right: sampleSignal,
    });

    audio.setSource("resonator", resonated, { gain: 0.5 });
  };

  // Handle sample change - update playing sources
  const handleSampleChange = (value: SampleId) => {
    setSelectedSample(value);
    const newSampleData = sampleData[value];
    if (!newSampleData) return;
    const newSamplePath = `/samples/${value}`;

    // Update granular if playing
    if (isPlaying && audio.isReady) {
      const granular = createGranular(
        "granular",
        { ...getGranularParams(), samplePath: newSamplePath },
        newSampleData.length
      );
      audio.setSource("granular", granular, { gain });
    }

    // Update resonator if playing
    if (isResonatorPlaying && audio.isReady) {
      const loopRate = 44100 / newSampleData.length;
      const phasor = el.phasor(loopRate);
      const sampleSignal = el.table({ path: newSamplePath }, phasor);

      const resonated = createResonator("resonator", getResonatorParams(), {
        left: sampleSignal,
        right: sampleSignal,
      });

      audio.setSource("resonator", resonated, { gain: 0.5 });
    }
  };

  const handleEnvelopeChange = (value: GrainEnvelope | null) => {
    if (!value) return;
    setEnvelope(value);
    if (isPlaying && audio.isReady && currentSampleData) {
      const granular = createGranular(
        "granular",
        { ...getGranularParams(), envelope: value },
        currentSampleData.length
      );
      audio.setSource("granular", granular, { gain });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold">Audio Playground</h1>
        <p className="text-muted-foreground">
          {audio.isReady ? "Audio engine ready" : "Initializing..."}
        </p>
      </div>

      {/* Sample Selector */}
      <div className="w-full max-w-4xl">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Audio Source</span>
          <Select
            value={selectedSample}
            onValueChange={(v) => handleSampleChange(v as SampleId)}
            disabled={!samplesLoaded}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUDIO_SAMPLES.map((sample) => (
                <SelectItem key={sample.id} value={sample.id}>
                  {sample.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Melody Synth Controls */}
      <div className="w-full max-w-4xl space-y-6">
        <h2 className="text-lg font-semibold">Melody Synth</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Waveform</span>
              <Select
                value={melodyWaveform}
                onValueChange={(v) => {
                  setMelodyWaveform(v as MelodyWaveform);
                  if (isMelodyPlaying && audio.isReady) {
                    const melody = createMelodySynth("melody", {
                      ...getMelodyParams(),
                      waveform: v as MelodyWaveform,
                    });
                    audio.setSource("melody", melody, { gain: melodyGain });
                  }
                }}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sine">Sine</SelectItem>
                  <SelectItem value="triangle">Triangle</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SliderControl
              label="Detune"
              value={melodyDetune}
              onChange={setMelodyDetune}
              onCommit={handleMelodySliderCommit}
              min={0}
              max={50}
              step={1}
              unit="cents"
            />
            <SliderControl
              label="Attack"
              value={melodyAttack}
              onChange={setMelodyAttack}
              onCommit={handleMelodySliderCommit}
              min={0.001}
              max={0.5}
              step={0.001}
              unit="s"
            />
          </div>
          <div className="space-y-4">
            <SliderControl
              label="Release"
              value={melodyRelease}
              onChange={setMelodyRelease}
              onCommit={handleMelodySliderCommit}
              min={0.01}
              max={1}
              step={0.01}
              unit="s"
            />
            <SliderControl
              label="Reverb Mix"
              value={melodyReverbMix}
              onChange={setMelodyReverbMix}
              onCommit={handleMelodySliderCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Gain"
              value={melodyGain}
              onChange={setMelodyGain}
              onCommit={handleMelodySliderCommit}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
        </div>
        <h3 className="text-sm font-medium text-muted-foreground">Filter</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <SliderControl
              label="Cutoff"
              value={filterCutoff}
              onChange={setFilterCutoff}
              onCommit={handleMelodySliderCommit}
              min={100}
              max={8000}
              step={10}
              unit="Hz"
            />
            <SliderControl
              label="Env Amount"
              value={filterEnvAmount}
              onChange={setFilterEnvAmount}
              onCommit={handleMelodySliderCommit}
              min={0}
              max={8000}
              step={10}
              unit="Hz"
            />
            <SliderControl
              label="Resonance (Q)"
              value={filterQ}
              onChange={setFilterQ}
              onCommit={handleMelodySliderCommit}
              min={0.5}
              max={10}
              step={0.1}
            />
          </div>
          <div className="space-y-4">
            <SliderControl
              label="Filter Attack"
              value={filterAttack}
              onChange={setFilterAttack}
              onCommit={handleMelodySliderCommit}
              min={0.001}
              max={0.5}
              step={0.001}
              unit="s"
            />
            <SliderControl
              label="Filter Release"
              value={filterRelease}
              onChange={setFilterRelease}
              onCommit={handleMelodySliderCommit}
              min={0.01}
              max={2}
              step={0.01}
              unit="s"
            />
          </div>
        </div>
        <Button
          size="lg"
          variant={isMelodyPlaying ? "default" : "outline"}
          onClick={handleMelodyToggle}
          disabled={!audio.isReady}
          className="w-full"
        >
          {isMelodyPlaying ? "Stop Melody" : "Play Melody"}
        </Button>
      </div>

      {/* ======== TIDAL EMERGENCE ======== */}
      <div className="w-full max-w-4xl space-y-6 border-2 border-foreground/20 rounded-lg p-6">
        <div>
          <h2 className="text-xl font-bold">Tidal Emergence</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Three voices exist simultaneously inside shared noise. As erosion increases, voices progressively resolve from the noise bed — first the original melody, then a canon at the 5th below, then an augmented bass line an octave below. The noise IS the unresolved sum of all voices.
          </p>
        </div>

        <h3 className="text-sm font-medium text-muted-foreground">Erosion / Tonality</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                teUseErosion
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-foreground border-foreground/30"
              }`}
              onClick={() => {
                setTeUseErosion(true);
                if (isTidalEmergencePlaying && audio.isReady) {
                  const synth = createTidalEmergence("tidalEmergence", { ...getTidalEmergenceParams(), useErosion: true });
                  audio.setSource("tidalEmergence", synth, { gain: teGain });
                }
              }}
            >
              Erosion Mode
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                !teUseErosion
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-foreground border-foreground/30"
              }`}
              onClick={() => {
                setTeUseErosion(false);
                if (isTidalEmergencePlaying && audio.isReady) {
                  const synth = createTidalEmergence("tidalEmergence", { ...getTidalEmergenceParams(), useErosion: false });
                  audio.setSource("tidalEmergence", synth, { gain: teGain });
                }
              }}
            >
              Per-Voice Manual
            </button>
          </div>

          {teUseErosion ? (
            <SliderControl
              label="Global Erosion"
              value={teErosion}
              onChange={setTeErosion}
              onCommit={handleTidalEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SliderControl
                label="Voice 1 (Original)"
                value={teVoice1Tonality}
                onChange={setTeVoice1Tonality}
                onCommit={handleTidalEmergenceCommit}
                min={0}
                max={1}
                step={0.01}
              />
              <SliderControl
                label="Voice 2 (Canon -5th)"
                value={teVoice2Tonality}
                onChange={setTeVoice2Tonality}
                onCommit={handleTidalEmergenceCommit}
                min={0}
                max={1}
                step={0.01}
              />
              <SliderControl
                label="Voice 3 (Aug -8va)"
                value={teVoice3Tonality}
                onChange={setTeVoice3Tonality}
                onCommit={handleTidalEmergenceCommit}
                min={0}
                max={1}
                step={0.01}
              />
            </div>
          )}
        </div>

        <h3 className="text-sm font-medium text-muted-foreground">Expression</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SliderControl
            label="Portamento"
            value={tePortamento}
            onChange={setTePortamento}
            onCommit={handleTidalEmergenceCommit}
            min={0}
            max={0.5}
            step={0.01}
            unit="s"
          />
          <SliderControl
            label="Vibrato Rate"
            value={teVibratoRate}
            onChange={setTeVibratoRate}
            onCommit={handleTidalEmergenceCommit}
            min={3}
            max={8}
            step={0.1}
            unit="Hz"
          />
          <SliderControl
            label="Vibrato Depth"
            value={teVibratoDepth}
            onChange={setTeVibratoDepth}
            onCommit={handleTidalEmergenceCommit}
            min={0}
            max={1}
            step={0.01}
            unit="st"
          />
        </div>

        <h3 className="text-sm font-medium text-muted-foreground">Sound</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <SliderControl
              label="Noise Color"
              value={teNoiseColor}
              onChange={setTeNoiseColor}
              onCommit={handleTidalEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Noise Q"
              value={teNoiseQ}
              onChange={setTeNoiseQ}
              onCommit={handleTidalEmergenceCommit}
              min={5}
              max={40}
              step={1}
            />
          </div>
          <div className="space-y-4">
            <SliderControl
              label="Reverb Mix"
              value={teReverbMix}
              onChange={setTeReverbMix}
              onCommit={handleTidalEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Gain"
              value={teGain}
              onChange={setTeGain}
              onCommit={handleTidalEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
        </div>

        <Button
          size="lg"
          variant={isTidalEmergencePlaying ? "default" : "outline"}
          onClick={handleTidalEmergenceToggle}
          disabled={!audio.isReady}
          className="w-full"
        >
          {isTidalEmergencePlaying ? "Stop Tidal Emergence" : "Play Tidal Emergence"}
        </Button>
      </div>

      {/* ======== MELODIC EMERGENCE ======== */}
      <div className="w-full max-w-4xl space-y-6 border-2 border-foreground/20 rounded-lg p-6">
        <div>
          <h2 className="text-xl font-bold">Melodic Emergence</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Each note is born from noise, crystallizes into tone, and dissolves back. The melody plays a 24s loop with 3 phrases. Uses the Sine Emergence concept with per-note tonality envelopes, delayed vibrato, and portamento.
          </p>
        </div>

        <h3 className="text-sm font-medium text-muted-foreground">Tonality Envelope (per note)</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <SliderControl
              label="Tonality Floor"
              value={meTonalityFloor}
              onChange={setMeTonalityFloor}
              onCommit={handleMelodicEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Tonality Ceil"
              value={meTonalityCeil}
              onChange={setMeTonalityCeil}
              onCommit={handleMelodicEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
          <div className="space-y-4">
            <SliderControl
              label="Tonality Attack"
              value={meTonalityAttack}
              onChange={setMeTonalityAttack}
              onCommit={handleMelodicEmergenceCommit}
              min={0.01}
              max={2}
              step={0.01}
              unit="s"
            />
            <SliderControl
              label="Tonality Release"
              value={meTonalityRelease}
              onChange={setMeTonalityRelease}
              onCommit={handleMelodicEmergenceCommit}
              min={0.01}
              max={2}
              step={0.01}
              unit="s"
            />
          </div>
        </div>

        <h3 className="text-sm font-medium text-muted-foreground">Envelope & Expression</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <SliderControl
              label="Attack"
              value={meAttack}
              onChange={setMeAttack}
              onCommit={handleMelodicEmergenceCommit}
              min={0.01}
              max={1}
              step={0.01}
              unit="s"
            />
            <SliderControl
              label="Release"
              value={meRelease}
              onChange={setMeRelease}
              onCommit={handleMelodicEmergenceCommit}
              min={0.01}
              max={2}
              step={0.01}
              unit="s"
            />
            <SliderControl
              label="Portamento"
              value={mePortamento}
              onChange={setMePortamento}
              onCommit={handleMelodicEmergenceCommit}
              min={0}
              max={0.5}
              step={0.01}
              unit="s"
            />
          </div>
          <div className="space-y-4">
            <SliderControl
              label="Vibrato Rate"
              value={meVibratoRate}
              onChange={setMeVibratoRate}
              onCommit={handleMelodicEmergenceCommit}
              min={3}
              max={8}
              step={0.1}
              unit="Hz"
            />
            <SliderControl
              label="Vibrato Depth"
              value={meVibratoDepth}
              onChange={setMeVibratoDepth}
              onCommit={handleMelodicEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
              unit="st"
            />
            <SliderControl
              label="Vibrato Delay"
              value={meVibratoDelay}
              onChange={setMeVibratoDelay}
              onCommit={handleMelodicEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
              unit="s"
            />
          </div>
        </div>

        <h3 className="text-sm font-medium text-muted-foreground">Drone & Sound</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <SliderControl
              label="Drone Level"
              value={meDroneLevel}
              onChange={setMeDroneLevel}
              onCommit={handleMelodicEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Drone Tonality"
              value={meDroneTonality}
              onChange={setMeDroneTonality}
              onCommit={handleMelodicEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Noise Color"
              value={meNoiseColor}
              onChange={setMeNoiseColor}
              onCommit={handleMelodicEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
          <div className="space-y-4">
            <SliderControl
              label="Noise Q"
              value={meNoiseQ}
              onChange={setMeNoiseQ}
              onCommit={handleMelodicEmergenceCommit}
              min={5}
              max={40}
              step={1}
            />
            <SliderControl
              label="Reverb Mix"
              value={meReverbMix}
              onChange={setMeReverbMix}
              onCommit={handleMelodicEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Gain"
              value={meGain}
              onChange={setMeGain}
              onCommit={handleMelodicEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
        </div>

        <Button
          size="lg"
          variant={isMelodicEmergencePlaying ? "default" : "outline"}
          onClick={handleMelodicEmergenceToggle}
          disabled={!audio.isReady}
          className="w-full"
        >
          {isMelodicEmergencePlaying ? "Stop Melodic Emergence" : "Play Melodic Emergence"}
        </Button>
      </div>

      {/* ======== NOISE → TONE EXPLORATIONS ======== */}
      <div className="w-full max-w-4xl">
        <h1 className="text-2xl font-bold mb-2">Noise → Tone</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Four approaches to the same idea: how does pitched, tonal sound emerge from noise? Each uses a fundamentally different technique.
        </p>
      </div>

      {/* Original: Resonant Tide */}
      <div className="w-full max-w-4xl space-y-6 border rounded-lg p-6">
        <div>
          <h2 className="text-lg font-semibold">Original: Resonant Tide</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Noise through single bandpass filters. Clarity controls Q (2→80). The tones hint but never fully emerge — that's the starting point.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <SliderControl
              label="Root Note (MIDI)"
              value={rtRootNote}
              onChange={setRtRootNote}
              onCommit={handleResonantTideCommit}
              min={36}
              max={72}
              step={1}
            />
            <SliderControl
              label="Clarity"
              value={rtClarity}
              onChange={setRtClarity}
              onCommit={handleResonantTideCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Drift"
              value={rtDrift}
              onChange={setRtDrift}
              onCommit={handleResonantTideCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Tide Rate"
              value={rtTideRate}
              onChange={setRtTideRate}
              onCommit={handleResonantTideCommit}
              min={0.02}
              max={0.5}
              step={0.01}
              unit="Hz"
            />
          </div>
          <div className="space-y-4">
            <SliderControl
              label="Tide Depth"
              value={rtTideDepth}
              onChange={setRtTideDepth}
              onCommit={handleResonantTideCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Harmonic Spread"
              value={rtHarmonicSpread}
              onChange={setRtHarmonicSpread}
              onCommit={handleResonantTideCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Noise Color"
              value={rtNoiseColor}
              onChange={setRtNoiseColor}
              onCommit={handleResonantTideCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Gain"
              value={rtGain}
              onChange={setRtGain}
              onCommit={handleResonantTideCommit}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
        </div>
        <Button
          size="lg"
          variant={isResonantTidePlaying ? "default" : "outline"}
          onClick={handleResonantTideToggle}
          disabled={!audio.isReady}
          className="w-full"
        >
          {isResonantTidePlaying ? "Stop Resonant Tide" : "Play Resonant Tide"}
        </Button>
      </div>

      {/* Variation A: Sine Emergence */}
      <div className="w-full max-w-4xl space-y-6 border rounded-lg p-6">
        <div>
          <h2 className="text-lg font-semibold">A. Sine Emergence</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Adds pure sine oscillators at the same frequencies. Tonality crossfades from filtered noise to clean sines — the tones ARE there, you just reveal them.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <SliderControl
              label="Root Note (MIDI)"
              value={seRootNote}
              onChange={setSeRootNote}
              onCommit={handleSineEmergenceCommit}
              min={36}
              max={72}
              step={1}
            />
            <SliderControl
              label="Tonality"
              value={seTonality}
              onChange={setSeTonality}
              onCommit={handleSineEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Drift"
              value={seDrift}
              onChange={setSeDrift}
              onCommit={handleSineEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Brightness"
              value={seBrightness}
              onChange={setSeBrightness}
              onCommit={handleSineEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
          <div className="space-y-4">
            <SliderControl
              label="Harmonic Spread"
              value={seHarmonicSpread}
              onChange={setSeHarmonicSpread}
              onCommit={handleSineEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Noise Color"
              value={seNoiseColor}
              onChange={setSeNoiseColor}
              onCommit={handleSineEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Tide Rate"
              value={seTideRate}
              onChange={setSeTideRate}
              onCommit={handleSineEmergenceCommit}
              min={0.02}
              max={0.5}
              step={0.01}
              unit="Hz"
            />
            <SliderControl
              label="Tide Depth"
              value={seTideDepth}
              onChange={setSeTideDepth}
              onCommit={handleSineEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Gain"
              value={seGain}
              onChange={setSeGain}
              onCommit={handleSineEmergenceCommit}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
        </div>
        <Button
          size="lg"
          variant={isSineEmergencePlaying ? "default" : "outline"}
          onClick={handleSineEmergenceToggle}
          disabled={!audio.isReady}
          className="w-full"
        >
          {isSineEmergencePlaying ? "Stop Sine Emergence" : "Play Sine Emergence"}
        </Button>
      </div>

      {/* Variation B: Karplus Tide */}
      <div className="w-full max-w-4xl space-y-6 border rounded-lg p-6">
        <div>
          <h2 className="text-lg font-semibold">B. Karplus Tide</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Physical string modeling: noise bursts excite delay-line "strings." Sustain controls feedback — at low values, noise; at high values, clear ringing tones that sustain.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <SliderControl
              label="Root Note (MIDI)"
              value={ktRootNote}
              onChange={setKtRootNote}
              onCommit={handleKarplusTideCommit}
              min={36}
              max={72}
              step={1}
            />
            <SliderControl
              label="Sustain"
              value={ktSustain}
              onChange={setKtSustain}
              onCommit={handleKarplusTideCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Damping"
              value={ktDamping}
              onChange={setKtDamping}
              onCommit={handleKarplusTideCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Excitation Rate"
              value={ktExcitationRate}
              onChange={setKtExcitationRate}
              onCommit={handleKarplusTideCommit}
              min={0.1}
              max={5}
              step={0.1}
              unit="Hz"
            />
          </div>
          <div className="space-y-4">
            <SliderControl
              label="Drift"
              value={ktDrift}
              onChange={setKtDrift}
              onCommit={handleKarplusTideCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Harmonic Spread"
              value={ktHarmonicSpread}
              onChange={setKtHarmonicSpread}
              onCommit={handleKarplusTideCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Tide Rate"
              value={ktTideRate}
              onChange={setKtTideRate}
              onCommit={handleKarplusTideCommit}
              min={0.02}
              max={0.5}
              step={0.01}
              unit="Hz"
            />
            <SliderControl
              label="Tide Depth"
              value={ktTideDepth}
              onChange={setKtTideDepth}
              onCommit={handleKarplusTideCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Gain"
              value={ktGain}
              onChange={setKtGain}
              onCommit={handleKarplusTideCommit}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
        </div>
        <Button
          size="lg"
          variant={isKarplusTidePlaying ? "default" : "outline"}
          onClick={handleKarplusTideToggle}
          disabled={!audio.isReady}
          className="w-full"
        >
          {isKarplusTidePlaying ? "Stop Karplus Tide" : "Play Karplus Tide"}
        </Button>
      </div>

      {/* Variation C: Cascaded Resonance */}
      <div className="w-full max-w-4xl space-y-6 border rounded-lg p-6">
        <div>
          <h2 className="text-lg font-semibold">C. Cascaded Resonance</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Stacks 1→4 bandpass filters in series. Each pass narrows the bandwidth further. The tone genuinely emerges from the noise — no added oscillators.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <SliderControl
              label="Root Note (MIDI)"
              value={crRootNote}
              onChange={setCrRootNote}
              onCommit={handleCascadedResCommit}
              min={36}
              max={72}
              step={1}
            />
            <SliderControl
              label="Resonance Depth"
              value={crResonanceDepth}
              onChange={setCrResonanceDepth}
              onCommit={handleCascadedResCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Q (per pass)"
              value={crQ}
              onChange={setCrQ}
              onCommit={handleCascadedResCommit}
              min={5}
              max={60}
              step={1}
            />
            <SliderControl
              label="Drift"
              value={crDrift}
              onChange={setCrDrift}
              onCommit={handleCascadedResCommit}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
          <div className="space-y-4">
            <SliderControl
              label="Harmonic Spread"
              value={crHarmonicSpread}
              onChange={setCrHarmonicSpread}
              onCommit={handleCascadedResCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Noise Color"
              value={crNoiseColor}
              onChange={setCrNoiseColor}
              onCommit={handleCascadedResCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Tide Rate"
              value={crTideRate}
              onChange={setCrTideRate}
              onCommit={handleCascadedResCommit}
              min={0.02}
              max={0.5}
              step={0.01}
              unit="Hz"
            />
            <SliderControl
              label="Tide Depth"
              value={crTideDepth}
              onChange={setCrTideDepth}
              onCommit={handleCascadedResCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Gain"
              value={crGain}
              onChange={setCrGain}
              onCommit={handleCascadedResCommit}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
        </div>
        <Button
          size="lg"
          variant={isCascadedResPlaying ? "default" : "outline"}
          onClick={handleCascadedResToggle}
          disabled={!audio.isReady}
          className="w-full"
        >
          {isCascadedResPlaying ? "Stop Cascaded Resonance" : "Play Cascaded Resonance"}
        </Button>
      </div>

      <div className="grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
        {/* Granular Controls */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Granular Synth</h2>
          <div className="grid gap-4">
            <SliderControl
              label="Grain Size"
              value={grainSize}
              onChange={setGrainSize}
              onCommit={handleSliderCommit}
              min={5}
              max={200}
              step={1}
              unit="ms"
            />
            <SliderControl
              label="Density"
              value={density}
              onChange={setDensity}
              onCommit={handleSliderCommit}
              min={1}
              max={50}
              step={1}
              unit="grains/s"
            />
            <SliderControl
              label="Position"
              value={position}
              onChange={setPosition}
              onCommit={handleSliderCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Pitch"
              value={pitch}
              onChange={setPitch}
              onCommit={handleSliderCommit}
              min={0.25}
              max={4}
              step={0.01}
            />
            <SliderControl
              label="Position Spray"
              value={positionSpray}
              onChange={setPositionSpray}
              onCommit={handleSliderCommit}
              min={0}
              max={0.5}
              step={0.01}
            />
            <SliderControl
              label="Pitch Spray"
              value={pitchSpray}
              onChange={setPitchSpray}
              onCommit={handleSliderCommit}
              min={0}
              max={0.5}
              step={0.01}
            />
            <SliderControl
              label="Stereo Spread"
              value={stereoSpread}
              onChange={setStereoSpread}
              onCommit={handleSliderCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderControl
              label="Gain"
              value={gain}
              onChange={setGain}
              onCommit={handleSliderCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <div className="flex items-center justify-between">
              <span className="text-sm">Envelope</span>
              <Select value={envelope} onValueChange={handleEnvelopeChange}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hann">Hann</SelectItem>
                  <SelectItem value="trapezoid">Trapezoid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            size="lg"
            variant={isPlaying ? "default" : "outline"}
            onClick={handleToggle}
            disabled={!audio.isReady || !samplesLoaded}
            className="w-full"
          >
            {!samplesLoaded ? "Loading..." : isPlaying ? "Stop Granular" : "Play Granular"}
          </Button>
        </div>

        {/* Resonator Controls */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Resonator</h2>
          <div className="grid gap-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Band 1</h3>
              <SliderControl
                label="Frequency"
                value={band1Freq}
                onChange={setBand1Freq}
                onCommit={handleResonatorSliderCommit}
                min={20}
                max={2000}
                step={1}
                unit="Hz"
              />
              <SliderControl
                label="Q"
                value={band1Q}
                onChange={setBand1Q}
                onCommit={handleResonatorSliderCommit}
                min={10}
                max={100}
                step={1}
              />
              <SliderControl
                label="Gain"
                value={band1Gain}
                onChange={setBand1Gain}
                onCommit={handleResonatorSliderCommit}
                min={0}
                max={1}
                step={0.01}
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Band 2</h3>
              <SliderControl
                label="Frequency"
                value={band2Freq}
                onChange={setBand2Freq}
                onCommit={handleResonatorSliderCommit}
                min={20}
                max={4000}
                step={1}
                unit="Hz"
              />
              <SliderControl
                label="Q"
                value={band2Q}
                onChange={setBand2Q}
                onCommit={handleResonatorSliderCommit}
                min={10}
                max={100}
                step={1}
              />
              <SliderControl
                label="Gain"
                value={band2Gain}
                onChange={setBand2Gain}
                onCommit={handleResonatorSliderCommit}
                min={0}
                max={1}
                step={0.01}
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Band 3</h3>
              <SliderControl
                label="Frequency"
                value={band3Freq}
                onChange={setBand3Freq}
                onCommit={handleResonatorSliderCommit}
                min={20}
                max={8000}
                step={1}
                unit="Hz"
              />
              <SliderControl
                label="Q"
                value={band3Q}
                onChange={setBand3Q}
                onCommit={handleResonatorSliderCommit}
                min={10}
                max={100}
                step={1}
              />
              <SliderControl
                label="Gain"
                value={band3Gain}
                onChange={setBand3Gain}
                onCommit={handleResonatorSliderCommit}
                min={0}
                max={1}
                step={0.01}
              />
            </div>
            <SliderControl
              label="Dry/Wet Mix"
              value={resonatorMix}
              onChange={setResonatorMix}
              onCommit={handleResonatorSliderCommit}
              min={0}
              max={1}
              step={0.01}
            />
          </div>
          <Button
            size="lg"
            variant={isResonatorPlaying ? "default" : "outline"}
            onClick={handleResonatorToggle}
            disabled={!audio.isReady || !samplesLoaded}
            className="w-full"
          >
            {!samplesLoaded ? "Loading..." : isResonatorPlaying ? "Stop Resonator" : "Play Resonator"}
          </Button>
        </div>
      </div>

      <div className="w-full max-w-4xl space-y-4">
        <h2 className="text-lg font-semibold">Inspiratie</h2>
        <img
          src="/moodboard1.png"
          alt="Moodboard"
          className="w-full"
        />
        <a
          href="https://www.youtube.com/watch?v=uMh-fULT-Lg"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          Barry Truax - East Wind
        </a>
      </div>
    </div>
  );
}

function SliderControl({
  label,
  value,
  onChange,
  onCommit,
  min,
  max,
  step,
  unit,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {value.toFixed(step < 1 ? 2 : 0)}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        onValueCommitted={onCommit}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}
