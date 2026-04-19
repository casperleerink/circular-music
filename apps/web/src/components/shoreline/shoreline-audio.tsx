import type { NodeRepr_t } from "@elemaudio/core";
import { useCallback, useEffect, useRef } from "react";
import { useAudio, type AudioRef } from "@/hooks/use-audio";
import {
  createTidalEmergence,
  DEFAULT_TIDAL_EMERGENCE_PARAMS,
  TIDAL_EMERGENCE_LOOP_DURATION,
  TIDAL_EMERGENCE_TICK_RATE,
} from "@/lib/audio/tidal-emergence";
import type { TimelineState } from "@/hooks/use-timeline";

const SOURCE_ID = "tidalEmergence";
const PARAMS = DEFAULT_TIDAL_EMERGENCE_PARAMS;

type SynthSignal = { left: NodeRepr_t; right: NodeRepr_t };

/**
 * Drives Tidal Emergence for the shoreline scene.
 *
 * Transport:
 *   play   -> setSource attaches the synth
 *   pause  -> removeSource silences (position held in timeRef)
 *   stop   -> removeSource + timeRef reset drives tickTime to 0
 *   seek   -> tickTime ref jumps; sparseq2 looks up the new tick
 *
 * `tickTime` / `erosion` use `core.createRef` so seek and the (future)
 * location-driven erosion never rebuild the audio graph.
 *
 * Implementation note: the transport RAF loop runs via a *stable* useEffect
 * (empty deps). We avoid tying the effect's lifecycle to the `audio` context
 * object — that changes identity when `isReady` flips, which would otherwise
 * re-run cleanup and detach the synth mid-playback.
 */
export function useShorelineAudio(
  timeRef: React.RefObject<number>,
  stateRef: React.RefObject<TimelineState>,
) {
  const audio = useAudio();
  const audioRef = useRef(audio);
  audioRef.current = audio;

  const startedRef = useRef(false);
  const rafRef = useRef<number>(0);
  const synthMountedRef = useRef(false);
  const tickSetterRef = useRef<AudioRef[1] | null>(null);
  const erosionSetterRef = useRef<AudioRef[1] | null>(null);
  const synthRef = useRef<SynthSignal | null>(null);
  const prevStateRef = useRef<TimelineState>("stopped");

  const attachSynth = useCallback(() => {
    if (!synthRef.current) return;
    audioRef.current.setSource(SOURCE_ID, synthRef.current, {
      gain: PARAMS.gain,
    });
    synthMountedRef.current = true;
  }, []);

  const detachSynth = useCallback(() => {
    audioRef.current.removeSource(SOURCE_ID);
    synthMountedRef.current = false;
  }, []);

  const initialize = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    const ctx = await audioRef.current.initialize();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (err) {
        console.error("[shoreline-audio] ctx.resume failed", err);
      }
    }

    const [tickNode, setTick] = audioRef.current.createRef("const", {
      value: 0,
    });
    const [erosionNode, setErosion] = audioRef.current.createRef("const", {
      value: PARAMS.erosion,
    });

    tickSetterRef.current = setTick;
    erosionSetterRef.current = setErosion;

    synthRef.current = createTidalEmergence(SOURCE_ID, PARAMS, {
      tickTime: tickNode,
      erosion: erosionNode,
    });

    attachSynth();
  }, [attachSynth]);

  const setErosion = useCallback((value: number) => {
    try {
      erosionSetterRef.current?.({ value });
    } catch (err) {
      console.error("[shoreline-audio] erosion setter failed", err);
    }
  }, []);

  // Stable RAF loop — mount once, cleanup on unmount only.
  useEffect(() => {
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);

      const state = stateRef.current;
      const prev = prevStateRef.current;

      if (state !== prev) {
        if (state === "playing" && !synthMountedRef.current) {
          attachSynth();
        } else if (
          (state === "paused" || state === "stopped") &&
          synthMountedRef.current
        ) {
          detachSynth();
        }
        prevStateRef.current = state;
      }

      if (synthMountedRef.current) {
        const tick =
          (timeRef.current % TIDAL_EMERGENCE_LOOP_DURATION) *
          TIDAL_EMERGENCE_TICK_RATE;
        try {
          tickSetterRef.current?.({ value: tick });
        } catch (err) {
          console.error("[shoreline-audio] tick setter failed", err);
        }
      }
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (synthMountedRef.current) {
        audioRef.current.removeSource(SOURCE_ID);
        synthMountedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { initialize, setErosion };
}
