import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShorelineScene } from "../components/shoreline/shoreline-scene";
import { useShorelineAudio } from "../components/shoreline/shoreline-audio";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const [started, setStarted] = useState(false);
  const { start } = useShorelineAudio();

  const handleStart = async () => {
    await start();
    setStarted(true);
  };

  return (
    <div className="relative h-screen w-screen">
      <ShorelineScene started={started} />
      {!started && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={handleStart}
            className="rounded-full bg-white/80 px-8 py-4 text-lg font-medium text-neutral-800 backdrop-blur-sm transition-colors hover:bg-white"
          >
            Get Started
          </button>
        </div>
      )}
    </div>
  );
}
