"use client";

import { el } from "@elemaudio/core";
import type { NodeRepr_t } from "@elemaudio/core";
import WebRenderer from "@elemaudio/web-renderer";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface AudioContextValue {
  isReady: boolean;
  initialize: () => Promise<AudioContext | undefined>;
  render: (left: NodeRepr_t, right: NodeRepr_t) => void;
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

  const render = useCallback((left: NodeRepr_t, right: NodeRepr_t) => {
    if (!coreRef.current) return;
    coreRef.current.render(left, right);
  }, []);

  const silence = useCallback(() => {
    if (!coreRef.current) return;
    coreRef.current.render(el.const({ value: 0 }), el.const({ value: 0 }));
  }, []);

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

  return (
    <AudioCtx.Provider
      value={{
        isReady,
        initialize,
        render,
        silence,
        updateVirtualFileSystem,
        ctx: ctxRef.current,
        core: coreRef.current,
      }}
    >
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioCtx);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
}
