import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useAudio } from "@/hooks/use-audio";
import { createGranular, type GranularParams } from "@/lib/audio/granular";

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

  // Granular parameter state
  const [grainSize, setGrainSize] = useState(25);
  const [density, setDensity] = useState(10);
  const [position, setPosition] = useState(0.5);
  const [pitch, setPitch] = useState(1);
  const [positionSpray, setPositionSpray] = useState(0.1);
  const [pitchSpray, setPitchSpray] = useState(0.05);
  const [stereoSpread, setStereoSpread] = useState(0.5);
  const [gain, setGain] = useState(0.5);

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

  const renderGranular = (params: GranularParams) => {
    if (!sampleData.acadia) return;
    const granular = createGranular(
      "granular",
      params,
      sampleData.acadia.length,
    );
    audio.render(granular.left, granular.right);
  };

  const handleToggle = () => {
    if (!audio.isReady || !samplesLoaded) return;
    if (!sampleData.acadia) return;

    if (isPlaying) {
      audio.silence();
      setIsPlaying(false);
    } else {
      const params = getGranularParams();
      console.log("Granular params:", params);
      renderGranular(params);
      setIsPlaying(true);
    }
  };

  const handleSliderCommit = () => {
    if (!isPlaying || !audio.isReady) return;
    const params = getGranularParams();
    renderGranular(params);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold">Audio Playground</h1>
        <p className="text-muted-foreground">
          {audio.isReady ? "Audio engine ready" : "Initializing..."}
        </p>
      </div>

      <div className="grid w-full max-w-md gap-6">
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
      >
        {!samplesLoaded ? "Loading..." : isPlaying ? "Stop" : "Play"}
      </Button>
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
