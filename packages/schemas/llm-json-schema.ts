/**
 * zodToLlmJsonSchema -- Zod-to-LLM JSON Schema Bridge
 *
 * Thin wrapper around Zod v4's native z.toJSONSchema() that:
 * 1. Generates standard JSON Schema from a Zod schema
 * 2. Strips the $schema key (not needed by LLM providers, avoids SDK backward compat shim)
 * 3. Inherits z.toJSONSchema()'s throw behavior on unsupported features
 *    (transforms, maps, sets, symbols, etc.) -- fail fast at build time
 *
 * Returns a plain JSON Schema object for use with @google/genai's
 * responseJsonSchema config property. No coupling to any specific LLM provider.
 */

import { z } from "zod";

/**
 * Convert a Zod schema to an LLM-compatible JSON Schema object.
 *
 * @param schema - A flat Zod schema (no transforms, no optionals for LLM use)
 * @returns Plain JSON Schema object compatible with LLM structured output
 * @throws If the schema contains unsupported Zod features (transforms, maps, sets, etc.)
 */
export function zodToLlmJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // z.toJSONSchema throws on unsupported types: transforms, maps, sets,
  // symbols, bigint, date, etc. This is the "fail fast" behavior
  // required by CONTEXT.md.
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;

  // Strip $schema -- LLM providers don't need it, and leaving it in
  // triggers the SDK's backward compat shim on responseSchema
  delete jsonSchema["$schema"];

  return jsonSchema;
}
