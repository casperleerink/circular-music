import { useCallback, useEffect, useRef, useState } from "react";

export type TimelineState = "stopped" | "playing" | "paused";

const DURATION = 236; // seconds — 3m56s, matches camera path + melody delay

export interface Timeline {
  /** Current time in seconds */
  time: number;
  /** Playback state */
  state: TimelineState;
  /** Duration in seconds */
  duration: number;
  /** Ref that can be read synchronously (e.g. inside useFrame) */
  timeRef: React.RefObject<number>;
  stateRef: React.RefObject<TimelineState>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
}

export function useTimeline(): Timeline {
  const [time, setTime] = useState(0);
  const [state, setState] = useState<TimelineState>("stopped");

  const timeRef = useRef(0);
  const stateRef = useRef<TimelineState>("stopped");
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

  const tick = useCallback(() => {
    const now = performance.now();
    const delta = (now - lastFrameRef.current) / 1000;
    lastFrameRef.current = now;

    const next = Math.min(timeRef.current + delta, DURATION);
    timeRef.current = next;
    setTime(next);

    if (next >= DURATION) {
      stateRef.current = "paused";
      setState("paused");
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const play = useCallback(() => {
    if (stateRef.current === "playing") return;
    // If at end, reset to start
    if (timeRef.current >= DURATION) {
      timeRef.current = 0;
      setTime(0);
    }
    stateRef.current = "playing";
    setState("playing");
    lastFrameRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    if (stateRef.current !== "playing") return;
    stateRef.current = "paused";
    setState("paused");
    cancelAnimationFrame(rafRef.current);
  }, []);

  const stop = useCallback(() => {
    stateRef.current = "stopped";
    setState("stopped");
    cancelAnimationFrame(rafRef.current);
    timeRef.current = 0;
    setTime(0);
  }, []);

  const seek = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(t, DURATION));
      timeRef.current = clamped;
      setTime(clamped);
      // If playing, restart the loop from new position
      if (stateRef.current === "playing") {
        cancelAnimationFrame(rafRef.current);
        lastFrameRef.current = performance.now();
        rafRef.current = requestAnimationFrame(tick);
      }
    },
    [tick],
  );

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return {
    time,
    state,
    duration: DURATION,
    timeRef,
    stateRef,
    play,
    pause,
    stop,
    seek,
  };
}
