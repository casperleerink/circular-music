import { createFileRoute } from "@tanstack/react-router";
import { ShorelineScene } from "../components/shoreline/shoreline-scene";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return <ShorelineScene />;
}
