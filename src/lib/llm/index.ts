import "server-only";

import OpenAI from "openai";

// Lazy construction: builds and scaffold tests require no API key or paid calls.
export function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  return new OpenAI({ apiKey });
}
