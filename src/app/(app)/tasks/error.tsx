"use client";
export default function ErrorPage({ reset }: {
    reset: () => void;
}) { return <main><p role="alert">Tasks could not be loaded.</p><button onClick={reset}>Try again</button></main>; }
