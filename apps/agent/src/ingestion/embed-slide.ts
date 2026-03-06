/**
 * Vertex AI Embedding Generation
 *
 * Generates 768-dimension text embeddings using Vertex AI text-embedding-005
 * for slide content similarity search via pgvector.
 */

import { GoogleGenAI } from "@google/genai";
import { env } from "../env";

const ai = new GoogleGenAI({
  vertexai: true,
  project: env.GOOGLE_CLOUD_PROJECT,
  location: env.GOOGLE_CLOUD_LOCATION,
});

/**
 * Generate a 768-dimension embedding for the given text.
 * Returns a zero vector if input is empty (avoids unnecessary API call).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const EMBEDDING_DIMENSIONS = 768;

  // Handle empty/very short text: return zero vector
  if (!text || text.trim().length === 0) {
    return new Array(EMBEDDING_DIMENSIONS).fill(0);
  }

  const response = await ai.models.embedContent({
    model: "text-embedding-005",
    contents: text,
    config: { taskType: "RETRIEVAL_DOCUMENT" },
  });

  return response.embeddings![0]!.values!;
}
