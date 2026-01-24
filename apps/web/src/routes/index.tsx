import { el } from "@elemaudio/core";
import type { NodeRepr_t } from "@elemaudio/core";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAudio } from "@/hooks/use-audio";
import { createDiffuseWorld } from "@/lib/audio/diffuse-world";
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
  const [diffuseActive, setDiffuseActive] = useState(false);
  const diffuseActiveRef = useRef(false);

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    diffuseActiveRef.current = diffuseActive;
  }, [diffuseActive]);

  // Creates the trigger voice signal (returns the signal, doesn't render)
  const createTriggerVoice = useCallback((gate: number): NodeRepr_t => {
    const key = voiceKey.current;

    const gateSignal = el.const({ key: `${key}:gate`, value: gate });

    // Filter frequency envelope: starts high, drops for that "blip" movement
    const filterSeq = el.sparseq(
      {
        key: `${key}:filter-seq`,
        seq: [
          { value: 1, tickTime: 0 },
          { value: 0.3, tickTime: 60 },
        ],
      },
      el.train(1000),
      gateSignal
    );
    const smoothedFilter = el.smooth(
      el.tau2pole(0.02),
      el.mul(gateSignal, filterSeq)
    );

    // Bandpass center frequency with envelope
    const filterFreq = el.add(600, el.mul(smoothedFilter, 1200));

    // Noise source
    const noise = el.noise({ key: `${key}:noise` });

    // Resonant bandpass filter with moving frequency - gives character without being tonal
    const bandpassed = el.bandpass(filterFreq, 4, noise);

    // Additional filtering to soften the sound
    const filtered = el.lowpass(2500, 0.7, bandpassed);

    // Main envelope - punchy but not too short
    const env = createEnvelope({
      key,
      gate,
      attack: 0.002,
      sustain: 0.15,
      release: 0.2,
      sustainTickTime: 30,
    });

    // Master gain to control overall volume
    const masterGain = 0.25;

    // Apply envelope to filtered noise
    const dryHit = el.mul(masterGain, applyEnvelope(env, filtered, 0.5));

    // Reverb using multiple delay taps with feedback
    const d1 = el.delay({ size: 44100 }, el.ms2samps(23), 0.6, dryHit);
    const d2 = el.delay({ size: 44100 }, el.ms2samps(41), 0.55, dryHit);
    const d3 = el.delay({ size: 44100 }, el.ms2samps(67), 0.5, dryHit);
    const d4 = el.delay({ size: 44100 }, el.ms2samps(97), 0.45, dryHit);

    // Mix delays and apply warmth
    const reverbMix = el.add(d1, el.add(d2, el.add(d3, d4)));
    const warmReverb = el.lowpass(3000, 0.7, reverbMix);

    // Combine dry + wet
    return el.add(dryHit, el.mul(warmReverb, 0.4));
  }, []);

  // Combined render function that mixes trigger voice with diffuse world
  const renderAudio = useCallback(
    (gate: number) => {
      const triggerVoice = createTriggerVoice(gate);
      const diffuse = createDiffuseWorld(
        "diffuse",
        diffuseActiveRef.current
      );

      // Mix both voices
      const output = el.add(triggerVoice, diffuse);
      audio.render(output, output);
    },
    [audio, createTriggerVoice]
  );

  // Reference to track current gate state for diffuse-only renders
  const currentGateRef = useRef(0);

  const handlePointerDown = () => {
    if (!audio.isReady || isGateOpen.current) return;

    // Ensure rising edge by setting gate to 0 first, then 1
    currentGateRef.current = 0;
    renderAudio(0);
    requestAnimationFrame(() => {
      currentGateRef.current = 1;
      renderAudio(1);
      isGateOpen.current = true;
    });
  };

  const handlePointerUp = () => {
    if (!isGateOpen.current) return;

    currentGateRef.current = 0;
    renderAudio(0);
    isGateOpen.current = false;
  };

  // Toggle diffuse world on/off
  const handleDiffuseToggle = () => {
    const newState = !diffuseActive;
    setDiffuseActive(newState);
    diffuseActiveRef.current = newState;

    // Re-render to apply the change
    if (audio.isReady) {
      renderAudio(currentGateRef.current);
    }
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

        <Button
          size="lg"
          variant={diffuseActive ? "default" : "outline"}
          onClick={handleDiffuseToggle}
          disabled={!audio.isReady}
        >
          {diffuseActive ? "Diffuse: On" : "Diffuse: Off"}
        </Button>
      </div>

      {diffuseActive && (
        <p className="text-sm text-muted-foreground max-w-md text-center">
          Diffuse — sparse noise bursts, unpredictable filters, vapor and static
        </p>
      )}
    </div>
  );
}
