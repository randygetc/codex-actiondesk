"use client";

import OpenAI from "openai";

// Deliberate step 1.4 violation. This branch must never be merged.
export function GuardrailOpenAIProbe() {
  return <span>{typeof OpenAI}</span>;
}
