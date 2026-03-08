import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { Timeline } from "@/hooks/use-timeline";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28a1 1 0 0 0-1.5.86Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

export function TransportControls({ timeline }: { timeline: Timeline }) {
  const { time, state, duration, play, pause, stop, seek } = timeline;

  return (
    <div className="absolute bottom-6 left-1/2 flex w-[min(80vw,600px)] -translate-x-1/2 items-center gap-3 border border-white/20 bg-black/30 px-4 py-2 backdrop-blur-md">
      <div className="flex items-center gap-1">
        {state === "playing" ? (
          <Button variant="ghost" size="icon-xs" onClick={pause}>
            <PauseIcon />
          </Button>
        ) : (
          <Button variant="ghost" size="icon-xs" onClick={play}>
            <PlayIcon />
          </Button>
        )}
        <Button variant="ghost" size="icon-xs" onClick={stop}>
          <StopIcon />
        </Button>
      </div>

      <span className="w-10 text-xs tabular-nums text-white/70">
        {formatTime(time)}
      </span>

      <Slider
        className="min-w-0 flex-1"
        min={0}
        max={duration}
        step={0.1}
        value={[time]}
        onValueChange={(val) => seek(Array.isArray(val) ? val[0] : val)}
      />

      <span className="w-10 text-xs tabular-nums text-white/70">
        {formatTime(duration)}
      </span>
    </div>
  );
}
