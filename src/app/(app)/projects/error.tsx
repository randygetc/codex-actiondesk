"use client";
export default function ProjectsError({ reset }: { reset: () => void }) {
  return <main><h1 className="text-3xl font-semibold">Projects unavailable</h1>
    <p role="alert" className="mt-4">Your projects could not be loaded. Please try again.</p>
    <button onClick={reset} className="mt-6 rounded-lg border px-4 py-2">Try again</button></main>;
}
