import { Loader } from "@/components/Loader";

// Shown during route transitions to server components.
export default function Loading() {
  return <Loader label="Fetching fresh picks…" />;
}
