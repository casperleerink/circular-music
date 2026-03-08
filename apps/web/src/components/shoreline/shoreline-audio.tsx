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

// Store sample metadata outside component
let sampleLength: number | null = null;
let melodyLength: number | null = null;

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

  const renderAtTime = useCallback(
    (elapsed: number) => {
      if (!sampleLength) return;

      const params = getResonatorParamsAtTime(elapsed);
      const loopRate = 44100 / sampleLength;
      const phasor = el.phasor(loopRate);
      const sampleSignal = el.table({ path: SAMPLE_PATH }, phasor);

      const resonated = createResonator("resonator", params, {
        left: sampleSignal,
        right: sampleSignal,
      });

      audio.setSource("resonator", resonated, { gain: 0.5 });

      // Render melody if loaded
      if (melodyLength) {
        const melodyRate = 44100 / melodyLength;
        const melodyPhasor = el.phasor(melodyRate);
        const melodySignal = el.table({ path: MELODY_PATH, key: "melody-table" }, melodyPhasor);
        audio.setSource("melody", {
          left: melodySignal,
          right: melodySignal,
        }, { gain: 0.5 });
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
        }
        rafRef.current = requestAnimationFrame(updateResonator);
        return;
      }
      if (currentState === "playing") {
        // Re-render on resume
        nextChangeRef.current = 0; // force re-render
      }
      prevStateRef.current = currentState;
    }

    if (currentState !== "playing") {
      rafRef.current = requestAnimationFrame(updateResonator);
      return;
    }

    // Only re-render when a band changes pitch
    if (elapsed < nextChangeRef.current) {
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
