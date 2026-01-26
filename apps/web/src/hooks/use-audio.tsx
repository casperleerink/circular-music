"use client";

import { el } from "@elemaudio/core";
import type { NodeRepr_t } from "@elemaudio/core";
import WebRenderer from "@elemaudio/web-renderer";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type SourceEntry = {
  signal: { left: NodeRepr_t; right: NodeRepr_t };
  gain: number;
};

interface AudioContextValue {
  isReady: boolean;
  initialize: () => Promise<AudioContext | undefined>;
  setSource: (
    id: string,
    signal: { left: NodeRepr_t; right: NodeRepr_t },
    options: { gain: number }
  ) => void;
  removeSource: (id: string) => void;
  silence: () => void;
  updateVirtualFileSystem: (entries: Record<string, Float32Array>) => void;
  ctx: AudioContext | null;
  core: WebRenderer | null;
}

const AudioCtx = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const coreRef = useRef<WebRenderer | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const sourcesRef = useRef<Map<string, SourceEntry>>(new Map());

  const initialize = useCallback(async () => {
    if (ctxRef.current) return ctxRef.current;

    const ctx = new AudioContext();
    const core = new WebRenderer();

    core.on("load", () => {
      setIsReady(true);
    });

    const node = await core.initialize(ctx, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });

    node.connect(ctx.destination);

    ctxRef.current = ctx;
    coreRef.current = core;
    nodeRef.current = node;

    return ctx;
  }, []);

  const renderMix = useCallback(() => {
    if (!coreRef.current) return;

    const sources = Array.from(sourcesRef.current.entries());
    if (sources.length === 0) {
      coreRef.current.render(el.const({ value: 0 }), el.const({ value: 0 }));
      return;
    }

    // Apply gains and sum
    const processed = sources.map(([id, src]) => {
      const smoothedGain = el.smooth(
        el.tau2pole(0.02),
        el.const({ key: `mixer:gain:${id}`, value: src.gain })
      );
      return {
        left: el.mul(src.signal.left, smoothedGain),
        right: el.mul(src.signal.right, smoothedGain),
      };
    });

    const mixL = processed.reduce(
      (sum, s) => el.add(sum, s.left),
      el.const({ value: 0 })
    );
    const mixR = processed.reduce(
      (sum, s) => el.add(sum, s.right),
      el.const({ value: 0 })
    );

    coreRef.current.render(mixL, mixR);
  }, []);

  const setSource = useCallback(
    (
      id: string,
      signal: { left: NodeRepr_t; right: NodeRepr_t },
      options: { gain: number }
    ) => {
      sourcesRef.current.set(id, { signal, gain: options.gain });
      renderMix();
    },
    [renderMix]
  );

  const removeSource = useCallback(
    (id: string) => {
      sourcesRef.current.delete(id);
      renderMix();
    },
    [renderMix]
  );

  const silence = useCallback(() => {
    sourcesRef.current.clear();
    renderMix();
  }, [renderMix]);

  const updateVirtualFileSystem = useCallback(
    (entries: Record<string, Float32Array>) => {
      coreRef.current?.updateVirtualFileSystem(entries);
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (nodeRef.current) {
        nodeRef.current.disconnect();
      }
      if (ctxRef.current) {
        ctxRef.current.close();
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      isReady,
      initialize,
      setSource,
      removeSource,
      silence,
      updateVirtualFileSystem,
      ctx: ctxRef.current,
      core: coreRef.current,
    }),
    [isReady, initialize, setSource, removeSource, silence, updateVirtualFileSystem]
  );

  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>;
}

export function useAudio() {
  const context = useContext(AudioCtx);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
}
