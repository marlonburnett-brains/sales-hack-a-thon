/**
 * test-gemini-connection.ts -- Quick smoke test for Gemini Flash Lite on Vertex AI
 *
 * Probes available model IDs, then tests structured output.
 *
 * Run: npx tsx -r dotenv/config src/validation/test-gemini-connection.ts
 */

import { GoogleAuth } from "google-auth-library";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import "dotenv/config";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT!;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION!;
const SA_KEY = process.env.VERTEX_SERVICE_ACCOUNT_KEY!;

// Write SA key to temp file for @google/genai SDK (mirrors env.ts behavior)
if (SA_KEY && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const tmpPath = join(tmpdir(), `vertex-sa-test-${process.pid}.json`);
  writeFileSync(tmpPath, SA_KEY, "utf-8");
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
}

// Candidate model IDs to try (most preferred first)
const CANDIDATES = [
  "gemini-2.5-flash-lite-preview-06-25",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-lite-001",
  "gemini-1.5-flash",
];

async function findWorkingModel(): Promise<string> {
  console.log("Probing available Gemini Flash Lite models...\n");
  const ai = new GoogleGenAI({
    vertexai: true,
    project: PROJECT,
    location: LOCATION,
  });

  for (const model of CANDIDATES) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: "Say hi",
        config: { maxOutputTokens: 10 },
      });
      if (response.text) {
        console.log(`  ✓ ${model} — available (response: "${response.text.trim()}")`);
        return model;
      }
    } catch (error) {
      const msg = (error as Error).message?.slice(0, 80) || "unknown error";
      console.log(`  ✗ ${model} — ${msg}`);
    }
  }
  throw new Error("No Gemini Flash Lite model found!");
}

async function testOpenAICompatibleEndpoint(modelId: string): Promise<void> {
  console.log("\n━━━ Test: OpenAI-compatible endpoint (Mastra path) ━━━\n");

  const baseURL = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}/endpoints/openapi`;

  const auth = new GoogleAuth({
    credentials: JSON.parse(SA_KEY),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new Error("Failed to get access token");

  const openai = new OpenAI({ baseURL, apiKey: tokenResponse.token });

  // The OpenAI-compatible endpoint requires publisher/model format
  const openaiModelId = `google/${modelId}`;

  // Basic text generation
  console.log(`1. Basic text generation (model: ${openaiModelId})...`);
  const textResponse = await openai.chat.completions.create({
    model: openaiModelId,
    messages: [{ role: "user", content: "Say hello in exactly 5 words." }],
    max_tokens: 50,
  });
  const text = textResponse.choices[0]?.message?.content;
  console.log(`   Response: ${text}`);
  if (!text) throw new Error("No text response");
  console.log("   ✓ PASS\n");

  // Structured output: json_object
  console.log("2. Structured output (response_format: json_object)...");
  const jsonResponse = await openai.chat.completions.create({
    model: openaiModelId,
    messages: [
      {
        role: "user",
        content: 'Return a JSON object with keys "name" (string), "items" (array of 3 strings), "count" (number). Topic: fruits.',
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 200,
  });
  const jsonText = jsonResponse.choices[0]?.message?.content;
  console.log(`   Raw: ${jsonText}`);
  const parsed = JSON.parse(jsonText!);
  console.log(`   Parsed: name=${parsed.name}, items=[${parsed.items}], count=${parsed.count}`);
  console.log("   ✓ PASS\n");

  // Structured output: json_schema
  console.log("3. Structured output (response_format: json_schema)...");
  try {
    const schemaResponse = await openai.chat.completions.create({
      model: openaiModelId,
      messages: [
        { role: "user", content: "Generate a person record. Name: Alice, age: 30, skills: TypeScript, Python." },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "person",
          strict: true,
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "number" },
              skills: { type: "array", items: { type: "string" } },
            },
            required: ["name", "age", "skills"],
            additionalProperties: false,
          },
        },
      },
      max_tokens: 200,
    });
    const schemaText = schemaResponse.choices[0]?.message?.content;
    console.log(`   Raw: ${schemaText}`);
    const schemaParsed = JSON.parse(schemaText!);
    console.log(`   Parsed: name=${schemaParsed.name}, age=${schemaParsed.age}, skills=[${schemaParsed.skills}]`);
    console.log("   ✓ PASS\n");
  } catch (error) {
    console.log(`   ✗ json_schema not supported: ${(error as Error).message?.slice(0, 100)}`);
    console.log("   (json_object mode works — Mastra can use that instead)\n");
  }
}

async function testGoogleGenAISDK(modelId: string): Promise<void> {
  console.log("━━━ Test: @google/genai SDK (provider path) ━━━\n");

  const ai = new GoogleGenAI({
    vertexai: true,
    project: PROJECT,
    location: LOCATION,
  });

  // Structured output with responseSchema
  console.log("1. Structured output (responseMimeType + responseSchema)...");
  const response = await ai.models.generateContent({
    model: modelId,
    contents: "Generate a person record. Name: Bob, age: 25, skills: Go, Rust.",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
          age: { type: "number" as const },
          skills: { type: "array" as const, items: { type: "string" as const } },
        },
        required: ["name", "age", "skills"],
      },
    },
  });
  const text = response.text;
  console.log(`   Raw: ${text}`);
  const parsed = JSON.parse(text!);
  console.log(`   Parsed: name=${parsed.name}, age=${parsed.age}, skills=[${parsed.skills}]`);
  console.log("   ✓ PASS\n");
}

async function main(): Promise<void> {
  console.log("=== Gemini Flash Lite Connection & Structured Output Test ===\n");
  console.log(`Project: ${PROJECT}`);
  console.log(`Location: ${LOCATION}\n`);

  const modelId = await findWorkingModel();
  console.log(`\n▶ Using model: ${modelId}\n`);

  let failed = false;

  try {
    await testOpenAICompatibleEndpoint(modelId);
  } catch (error) {
    console.error("✗ OpenAI-compatible endpoint FAILED:", (error as Error).message);
    failed = true;
  }

  try {
    await testGoogleGenAISDK(modelId);
  } catch (error) {
    console.error("✗ @google/genai SDK FAILED:", (error as Error).message);
    failed = true;
  }

  if (failed) {
    console.log("\n=== SOME TESTS FAILED ===");
    process.exitCode = 1;
  } else {
    console.log(`=== ALL TESTS PASSED ===`);
    console.log(`\nRecommended model ID for codebase: ${modelId}`);
    console.log(`OpenAI-compatible model ID: google/${modelId}`);
    console.log(`Mastra MODEL_ID: vertex/google/${modelId}`);
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exitCode = 1;
});
