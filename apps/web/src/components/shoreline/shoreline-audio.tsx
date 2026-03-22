import { el } from "@elemaudio/core";
import { useCallback, useEffect, useRef } from "react";
import { useAudio } from "@/hooks/use-audio";
import { createResonator } from "@/lib/audio/resonator";
import {
  getResonatorParamsAtTime,
  getNextChangeTime,
} from "@/lib/audio/resonator-melody";
import type { TimelineState } from "@/hooks/use-timeline";

const SAMPLE_FILE = "acadia_waves.mp3";
const SAMPLE_PATH = "/samples/acadia";
const MELODY_FILE = "circular-music-melody.mp3";
const MELODY_PATH = "/samples/melody";
const MELODY_DELAY = 5; // seconds — melody starts after this delay
const SAMPLE_RATE = 44100;

// Store sample metadata outside component
let sampleLength: number | null = null;
let melodyLength: number | null = null;

/**
 * Calculate the startOffset (in samples) for a looping sample at a given time.
 */
function loopOffset(elapsed: number, lengthInSamples: number): number {
  const durationSec = lengthInSamples / SAMPLE_RATE;
  return Math.floor((elapsed % durationSec) * SAMPLE_RATE);
}

/**
 * Hook that manages resonator audio for the shoreline scene.
 * Accepts timeline refs to sync audio with transport controls.
 */
export function useShorelineAudio(
  timeRef: React.RefObject<number>,
  stateRef: React.RefObject<TimelineState>,
) {
  const audio = useAudio();
  const startedRef = useRef(false);
  const rafRef = useRef<number>(0);
  const nextChangeRef = useRef<number>(0);
  const prevStateRef = useRef<TimelineState>("stopped");
  const melodyStartedRef = useRef(false);
  const prevElapsedRef = useRef(0);
  const seekCountRef = useRef(0);

  const renderAtTime = useCallback(
    (elapsed: number) => {
      if (!sampleLength) return;

      const params = getResonatorParamsAtTime(elapsed);
      const sk = seekCountRef.current;

      // Use el.sample in loop mode with startOffset so scrubbing repositions audio
      const offset = loopOffset(elapsed, sampleLength);
      const sampleSignal = el.sample(
        { path: SAMPLE_PATH, mode: "loop" as const, startOffset: offset, key: `sample-${sk}` },
        1, 1,
      );

      const resonated = createResonator("resonator", params, {
        left: sampleSignal,
        right: sampleSignal,
      });

      audio.setSource("resonator", resonated, { gain: 0.5 });

      // Render melody if loaded and past delay
      if (melodyLength && elapsed >= MELODY_DELAY) {
        const melodyElapsed = elapsed - MELODY_DELAY;
        const melodyOffset = loopOffset(melodyElapsed, melodyLength);
        const melodySignal = el.sample(
          { path: MELODY_PATH, mode: "loop" as const, startOffset: melodyOffset, key: `melody-${sk}` },
          1, 1,
        );
        audio.setSource("melody", {
          left: melodySignal,
          right: melodySignal,
        }, { gain: 0.5 });
      } else if (melodyLength && elapsed < MELODY_DELAY) {
        audio.removeSource("melody");
      }
    },
    [audio],
  );

  const updateResonator = useCallback(() => {
    if (!sampleLength) return;

    const currentState = stateRef.current;
    const elapsed = timeRef.current;

    // Handle state transitions
    if (currentState !== prevStateRef.current) {
      if (currentState === "stopped" || currentState === "paused") {
        // Mute on stop/pause
        audio.removeSource("resonator");
        audio.removeSource("melody");
        prevStateRef.current = currentState;
        if (currentState === "stopped") {
          nextChangeRef.current = 0;
          melodyStartedRef.current = false;
          seekCountRef.current++;
        }
        rafRef.current = requestAnimationFrame(updateResonator);
        return;
      }
      if (currentState === "playing") {
        // Re-render on resume — reset seek tracking to avoid false detection
        nextChangeRef.current = 0;
        prevElapsedRef.current = elapsed;
      }
      prevStateRef.current = currentState;
    }

    if (currentState !== "playing") {
      rafRef.current = requestAnimationFrame(updateResonator);
      return;
    }

    // Detect seek: time jumped backwards or forward by more than expected
    const timeDelta = elapsed - prevElapsedRef.current;
    prevElapsedRef.current = elapsed;
    const isSeek = timeDelta < -0.05 || timeDelta > 0.2;
    if (isSeek) {
      seekCountRef.current++;
      nextChangeRef.current = 0; // force re-render
    }

    // Force re-render when melody delay is crossed
    const melodyReady = elapsed >= MELODY_DELAY;
    const melodyJustStarted = melodyReady && !melodyStartedRef.current;
    melodyStartedRef.current = melodyReady;

    // Only re-render when a band changes pitch, melody just started, or user seeked
    if (elapsed < nextChangeRef.current && !melodyJustStarted && !isSeek) {
      rafRef.current = requestAnimationFrame(updateResonator);
      return;
    }
    nextChangeRef.current = getNextChangeTime(elapsed);

    renderAtTime(elapsed);

    rafRef.current = requestAnimationFrame(updateResonator);
  }, [audio, timeRef, stateRef, renderAtTime]);

  const initialize = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    const ctx = await audio.initialize();
    if (!ctx) return;

    // Load acadia sample
    const response = await fetch(`/audio/${SAMPLE_FILE}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);

    sampleLength = channelData.length;
    audio.updateVirtualFileSystem({ [SAMPLE_PATH]: channelData });

    // Load melody sample
    const melodyResponse = await fetch(`/audio/${MELODY_FILE}`);
    const melodyArrayBuffer = await melodyResponse.arrayBuffer();
    const melodyAudioBuffer = await ctx.decodeAudioData(melodyArrayBuffer);
    const melodyChannelData = melodyAudioBuffer.getChannelData(0);

    melodyLength = melodyChannelData.length;
    audio.updateVirtualFileSystem({ [MELODY_PATH]: melodyChannelData });

    // Initial render
    renderAtTime(0);

    // Start update loop
    nextChangeRef.current = getNextChangeTime(0);
    rafRef.current = requestAnimationFrame(updateResonator);
  }, [audio, renderAtTime, updateResonator]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (startedRef.current) {
        audio.removeSource("resonator");
        audio.removeSource("melody");
      }
    };
  }, [audio]);

  return { initialize };
}
