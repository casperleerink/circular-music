import { el } from "@elemaudio/core";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAudio } from "@/hooks/use-audio";
import { createEnvelope, applyEnvelope } from "@/lib/audio/envelope";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const [started, setStarted] = useState(false);
  const audio = useAudio();

  const handleStart = async () => {
    await audio.initialize();
    setStarted(true);
  };

  if (!started) {
    return <WelcomeScreen onStart={handleStart} />;
  }

  return <AudioPlayground audio={audio} />;
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
}: {
  audio: ReturnType<typeof useAudio>;
}) {
  const voiceKey = useRef("voice-0");
  const isGateOpen = useRef(false);

  // Renders the synth voice with current gate state
  const renderVoice = (gate: number) => {
    const key = voiceKey.current;

    // Noise source - key stays the same so graph is stable
    const noise = el.noise({ key: `${key}:noise` });

    // Bandpass filter for interesting tonal character
    const filtered = el.bandpass(1200, 2.5, noise);

    // Create envelope using sparseq pattern
    const env = createEnvelope({
      key,
      gate,
      attack: 0.005, // 5ms attack
      sustain: 0.6, // Sustain at 60%
      release: 0.4, // 400ms release for nice tail
      sustainTickTime: 50,
    });

    // Apply envelope to filtered noise
    const dryHit = applyEnvelope(env, filtered, 0.5);

    // Reverb using multiple delay taps with feedback
    const d1 = el.delay({ size: 44100 }, el.ms2samps(23), 0.6, dryHit);
    const d2 = el.delay({ size: 44100 }, el.ms2samps(41), 0.55, dryHit);
    const d3 = el.delay({ size: 44100 }, el.ms2samps(67), 0.5, dryHit);
    const d4 = el.delay({ size: 44100 }, el.ms2samps(97), 0.45, dryHit);

    // Mix delays and apply warmth
    const reverbMix = el.add(d1, el.add(d2, el.add(d3, d4)));
    const warmReverb = el.lowpass(3000, 0.7, reverbMix);

    // Combine dry + wet
    const output = el.add(dryHit, el.mul(warmReverb, 0.4));

    audio.render(output, output);
  };

  const handlePointerDown = () => {
    if (!audio.isReady || isGateOpen.current) return;

    // Ensure rising edge by setting gate to 0 first, then 1
    renderVoice(0);
    requestAnimationFrame(() => {
      renderVoice(1);
      isGateOpen.current = true;
    });
  };

  const handlePointerUp = () => {
    if (!isGateOpen.current) return;

    renderVoice(0);
    isGateOpen.current = false;
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold">Audio Playground</h1>
        <p className="text-muted-foreground">
          {audio.isReady ? "Audio engine ready" : "Initializing..."}
        </p>
      </div>

      <div className="flex gap-4">
        <Button
          size="lg"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          disabled={!audio.isReady}
        >
          Hold to Play
        </Button>
      </div>
    </div>
  );
}
