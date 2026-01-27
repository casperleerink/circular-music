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
import { createGranular, type GranularParams, type GrainEnvelope } from "@/lib/audio/granular";
import {
  createResonator,
  type ResonatorParams,
} from "@/lib/audio/resonator";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

// Available audio samples
const AUDIO_SAMPLES = [
  { id: "acadia", name: "Acadia Waves", file: "acadia_waves.mp3" },
  { id: "circle", name: "Circle Improv", file: "circle_improv_3.mp3" },
] as const;

type SampleId = (typeof AUDIO_SAMPLES)[number]["id"];

// Sample data stored outside component to persist across renders
const sampleData: Record<SampleId, { buffer: Float32Array; length: number } | null> = {
  acadia: null,
  circle: null,
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
