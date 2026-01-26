import { el } from "@elemaudio/core";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useAudio } from "@/hooks/use-audio";
import { createGranular, type GranularParams } from "@/lib/audio/granular";
import {
  createResonator,
  type ResonatorParams,
} from "@/lib/audio/resonator";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

// Sample data stored outside component to persist across renders
const sampleData: {
  acadia: { buffer: Float32Array; length: number } | null;
} = {
  acadia: null,
};

async function loadSamples(
  ctx: AudioContext,
  updateVFS: (entries: Record<string, Float32Array>) => void,
) {
  // Load acadia_waves.mp3
  const response = await fetch("/audio/acadia_waves.mp3");
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);

  // Store in VFS
  updateVFS({ "/samples/acadia": channelData });

  // Store metadata
  sampleData.acadia = {
    buffer: channelData,
    length: channelData.length,
  };

  console.log("Samples loaded:", {
    acadia: { length: channelData.length, duration: audioBuffer.duration },
  });
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

  // Granular parameter state
  const [grainSize, setGrainSize] = useState(25);
  const [density, setDensity] = useState(10);
  const [position, setPosition] = useState(0.5);
  const [pitch, setPitch] = useState(1);
  const [positionSpray, setPositionSpray] = useState(0.1);
  const [pitchSpray, setPitchSpray] = useState(0.05);
  const [stereoSpread, setStereoSpread] = useState(0.5);
  const [gain, setGain] = useState(0.5);

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

  const getGranularParams = (): GranularParams => ({
    samplePath: "/samples/acadia",
    grainSize,
    density,
    position,
    pitch,
    positionSpray,
    pitchSpray,
    stereoSpread,
    gain,
    envelope: "hann",
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
    if (!audio.isReady || !samplesLoaded || !sampleData.acadia) return;

    if (isPlaying) {
      audio.removeSource("granular");
      setIsPlaying(false);
    } else {
      const granular = createGranular(
        "granular",
        getGranularParams(),
        sampleData.acadia.length
      );
      audio.setSource("granular", granular, { gain });
      setIsPlaying(true);
    }
  };

  const handleResonatorToggle = () => {
    if (!audio.isReady || !samplesLoaded || !sampleData.acadia) return;

    if (isResonatorPlaying) {
      audio.removeSource("resonator");
      setIsResonatorPlaying(false);
    } else {
      // Play sample in a loop using el.table with a phasor
      const loopRate = 44100 / sampleData.acadia.length;
      const phasor = el.phasor(loopRate);
      const sampleSignal = el.table({ path: "/samples/acadia" }, phasor);

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
    if (!isPlaying || !audio.isReady || !sampleData.acadia) return;
    const granular = createGranular(
      "granular",
      getGranularParams(),
      sampleData.acadia.length
    );
    audio.setSource("granular", granular, { gain });
  };

  const handleResonatorSliderCommit = () => {
    if (!isResonatorPlaying || !audio.isReady || !sampleData.acadia) return;
    // Play sample in a loop using el.table with a phasor
    const loopRate = 44100 / sampleData.acadia.length;
    const phasor = el.phasor(loopRate);
    const sampleSignal = el.table({ path: "/samples/acadia" }, phasor);

    const resonated = createResonator("resonator", getResonatorParams(), {
      left: sampleSignal,
      right: sampleSignal,
    });

    audio.setSource("resonator", resonated, { gain: 0.5 });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold">Audio Playground</h1>
        <p className="text-muted-foreground">
          {audio.isReady ? "Audio engine ready" : "Initializing..."}
        </p>
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
