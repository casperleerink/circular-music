import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAudio } from "@/hooks/use-audio";
import {
  createGranular,
  type GranularParams,
  type GrainEnvelope,
} from "@/lib/audio/granular";

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

  return <AudioPlayground audio={audio} samplesLoaded={samplesLoaded} />;
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

function AudioPlayground({
  audio,
  samplesLoaded,
}: {
  audio: ReturnType<typeof useAudio>;
  samplesLoaded: boolean;
}) {
  const isGranularPlaying = useRef(false);

  // Generate random granular parameters
  const generateRandomGranularParams = (): GranularParams => {
    const envelopes: GrainEnvelope[] = ["hann", "trapezoid"];
    return {
      samplePath: "/samples/acadia",
      grainSize: 10 + Math.random() * 40, // 20-300ms
      density: 2 + Math.random() * 40, // 2-20 grains/sec
      position: Math.random(), // 0-1
      pitch: 0.5 + Math.random() * 1.5, // 0.5-2.0
      positionSpray: Math.random() * 0.3, // 0-0.3
      pitchSpray: Math.random() * 0.2, // 0-0.2
      stereoSpread: 0.3 + Math.random() * 0.7, // 0.3-1.0
      gain: 0.4 + Math.random() * 0.3, // 0.4-0.7
      envelope: "hann",
    };
  };

  // Granular synthesis handlers
  const handleGranularDown = () => {
    if (!audio.isReady || !samplesLoaded || isGranularPlaying.current) return;
    if (!sampleData.acadia) return;

    const params = generateRandomGranularParams();
    console.log("Granular params:", params);

    const granular = createGranular(
      "granular",
      params,
      sampleData.acadia.length,
    );
    audio.render(granular.left, granular.right);
    isGranularPlaying.current = true;
  };

  const handleGranularUp = () => {
    if (!isGranularPlaying.current) return;

    audio.silence();
    isGranularPlaying.current = false;
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold">Audio Playground</h1>
        <p className="text-muted-foreground">
          {audio.isReady ? "Audio engine ready" : "Initializing..."}
        </p>
      </div>

      <Button
        size="lg"
        variant="outline"
        onPointerDown={handleGranularDown}
        onPointerUp={handleGranularUp}
        onPointerLeave={handleGranularUp}
        disabled={!audio.isReady || !samplesLoaded}
      >
        {samplesLoaded ? "Granular" : "Loading..."}
      </Button>
    </div>
  );
}
