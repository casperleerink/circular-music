import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShorelineScene } from "../components/shoreline/shoreline-scene";
import { useShorelineAudio } from "../components/shoreline/shoreline-audio";
import { TransportControls } from "../components/shoreline/transport-controls";
import { useTimeline } from "../hooks/use-timeline";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const [started, setStarted] = useState(false);
  const timeline = useTimeline();
  const { initialize } = useShorelineAudio(timeline.timeRef, timeline.stateRef);

  const handleStart = async () => {
    await initialize();
    setStarted(true);
    timeline.play();
  };

  return (
    <div className="relative h-screen w-screen">
      <ShorelineScene
        started={started}
        timeRef={timeline.timeRef}
        stateRef={timeline.stateRef}
      />
      {!started && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={handleStart}
            className="group flex h-20 w-20 z-20 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-500 hover:scale-110 hover:bg-white/20"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="ml-1 h-8 w-8 text-black transition-colors duration-500 group-hover:text-black/20"
            >
              <path
                d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28a1 1 0 0 0-1.5.86Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      )}
      {started && <TransportControls timeline={timeline} />}
    </div>
  );
}
