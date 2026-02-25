import { el } from "@elemaudio/core";
import { useCallback, useEffect, useRef } from "react";
import { useAudio } from "@/hooks/use-audio";
import { createResonator } from "@/lib/audio/resonator";
import { getResonatorParamsAtTime } from "@/lib/audio/resonator-melody";

const SAMPLE_FILE = "acadia_waves.mp3";
const SAMPLE_PATH = "/samples/acadia";
const DURATION = 30; // seconds — matches camera path

// Store sample metadata outside component
let sampleLength: number | null = null;

/**
 * Hook that manages resonator audio for the shoreline scene.
 * Returns a `start` function to call on user interaction (unlocks AudioContext).
 */
export function useShorelineAudio() {
  const audio = useAudio();
  const startedRef = useRef(false);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const lastNoteIndexRef = useRef<number>(-1);

  const updateResonator = useCallback(() => {
    if (!sampleLength) return;

    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    if (elapsed > DURATION) return; // sustain last note, stop updating

    const params = getResonatorParamsAtTime(elapsed);

    // Only re-render when note changes (every ~3.75s)
    const noteIndex = Math.floor(elapsed / (DURATION / 8));
    if (noteIndex === lastNoteIndexRef.current) {
      rafRef.current = requestAnimationFrame(updateResonator);
      return;
    }
    lastNoteIndexRef.current = noteIndex;

    // Rebuild audio graph with new frequencies
    const loopRate = 44100 / sampleLength;
    const phasor = el.phasor(loopRate);
    const sampleSignal = el.table({ path: SAMPLE_PATH }, phasor);

    const resonated = createResonator("resonator", params, {
      left: sampleSignal,
      right: sampleSignal,
    });

    audio.setSource("resonator", resonated, { gain: 0.5 });

    rafRef.current = requestAnimationFrame(updateResonator);
  }, [audio]);

  const start = useCallback(async () => {
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

    // Initial render with first note
    const params = getResonatorParamsAtTime(0);
    const loopRate = 44100 / sampleLength;
    const phasor = el.phasor(loopRate);
    const sampleSignal = el.table({ path: SAMPLE_PATH }, phasor);

    const resonated = createResonator("resonator", params, {
      left: sampleSignal,
      right: sampleSignal,
    });

    audio.setSource("resonator", resonated, { gain: 0.5 });

    // Start update loop
    startTimeRef.current = performance.now();
    lastNoteIndexRef.current = 0;
    rafRef.current = requestAnimationFrame(updateResonator);
  }, [audio, updateResonator]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (startedRef.current) audio.removeSource("resonator");
    };
  }, [audio]);

  return { start };
}
