/**
 * Chat Refinement — Streaming LLM chat for deck structure refinement
 *
 * Users provide feedback on AI-inferred deck structures through conversation.
 * The assistant streams a response, then re-runs inference with updated constraints,
 * producing a diff of structural changes.
 */

import { GoogleGenAI } from "@google/genai";
import { env } from "../env";
import { prisma } from "../lib/db";
import {
  buildEmptyDeckStructureOutput,
  GENERIC_TOUCH_4_UNAVAILABLE_MESSAGE,
  inferDeckStructure,
  isUnsupportedGenericTouch4,
} from "./infer-deck-structure";
import type { DeckStructureOutput, DeckSection } from "./deck-structure-schema";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StructureDiff {
  added: string[];
  modified: string[];
  removed: string[];
}

export interface ChatRefinementResult {
  aiResponse: string;
  updatedStructure: DeckStructureOutput;
  diff: StructureDiff;
}

// ────────────────────────────────────────────────────────────
// Diff Calculation
// ────────────────────────────────────────────────────────────

function computeStructureDiff(
  oldSections: DeckSection[],
  newSections: DeckSection[],
): StructureDiff {
  const oldNames = new Set(oldSections.map((s) => s.name));
  const newNames = new Set(newSections.map((s) => s.name));

  const added: string[] = [];
  const modified: string[] = [];
  const removed: string[] = [];

  // New sections not in old
  for (const name of newNames) {
    if (!oldNames.has(name)) {
      added.push(name);
    }
  }

  // Old sections not in new
  for (const name of oldNames) {
    if (!newNames.has(name)) {
      removed.push(name);
    }
  }

  // Sections in both but with different properties
  const oldByName = new Map(oldSections.map((s) => [s.name, s]));
  for (const newSec of newSections) {
    const oldSec = oldByName.get(newSec.name);
    if (oldSec) {
      // Check for meaningful changes
      if (
        oldSec.order !== newSec.order ||
        oldSec.purpose !== newSec.purpose ||
        oldSec.isOptional !== newSec.isOptional ||
        oldSec.variationCount !== newSec.variationCount
      ) {
        modified.push(newSec.name);
      }
    }
  }

  return { added, modified, removed };
}

// ────────────────────────────────────────────────────────────
// Chat Context Summarization
// ────────────────────────────────────────────────────────────

async function summarizeOldMessages(
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: env.GOOGLE_CLOUD_PROJECT,
    location: env.GOOGLE_CLOUD_LOCATION,
  });

  const conversationText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `Summarize the following conversation about deck structure refinement into a concise list of constraints and requirements that should be maintained going forward. Only include actionable constraints, not pleasantries or questions.

Conversation:
${conversationText}

Return a bullet-point list of constraints:`,
  });

  return result.text ?? "";
}

// ────────────────────────────────────────────────────────────
// Stream Chat Refinement
// ────────────────────────────────────────────────────────────

/**
 * Stream a chat refinement response for a given touch type.
 *
 * 1. Loads existing deck structure and chat history
 * 2. Streams AI response to the user's message
 * 3. Re-runs inference with updated constraints
 * 4. Saves messages and computes structure diff
 */
export async function streamChatRefinement(
  touchType: string,
  userMessage: string,
  onChunk: (text: string) => void,
): Promise<ChatRefinementResult> {
  if (isUnsupportedGenericTouch4(touchType)) {
    onChunk(GENERIC_TOUCH_4_UNAVAILABLE_MESSAGE);
    return {
      aiResponse: GENERIC_TOUCH_4_UNAVAILABLE_MESSAGE,
      updatedStructure: buildEmptyDeckStructureOutput(
        touchType,
        GENERIC_TOUCH_4_UNAVAILABLE_MESSAGE,
      ),
      diff: { added: [], modified: [], removed: [] },
    };
  }

  // 1. Load existing DeckStructure
  const existing = await prisma.deckStructure.findFirst({
    where: {
      touchType,
      artifactType: null,
    },
    include: {
      chatMessages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  let oldSections: DeckSection[] = [];
  let currentStructureJson = "{}";
  if (existing) {
    currentStructureJson = existing.structureJson;
    try {
      const parsed = JSON.parse(existing.structureJson) as DeckStructureOutput;
      oldSections = parsed.sections ?? [];
    } catch {
      // ignore parse errors
    }
  }

  // 2. Build chat prompt
  const chatHistory = existing?.chatMessages ?? [];
  const recentMessages = chatHistory.slice(-5); // last 5 messages
  const existingContext = existing?.chatContextJson ?? "";

  const chatPrompt = buildChatPrompt(
    touchType,
    currentStructureJson,
    existingContext,
    recentMessages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
    userMessage,
  );

  // 3. Stream AI response
  const ai = new GoogleGenAI({
    vertexai: true,
    project: env.GOOGLE_CLOUD_PROJECT,
    location: env.GOOGLE_CLOUD_LOCATION,
  });

  let fullResponse = "";

  try {
    // Try streaming first
    const streamResult = await ai.models.generateContentStream({
      model: "gemini-2.0-flash",
      contents: chatPrompt,
    });

    for await (const chunk of streamResult) {
      const text = chunk.text ?? "";
      if (text) {
        fullResponse += text;
        onChunk(text);
      }
    }
  } catch (streamError) {
    // Fallback to non-streaming if streaming fails (per RESEARCH.md)
    console.warn(
      "[chat-refinement] Streaming failed, falling back to non-streaming:",
      streamError instanceof Error ? streamError.message : String(streamError),
    );

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: chatPrompt,
    });

    fullResponse = result.text ?? "I encountered an issue processing your feedback. Please try again.";
    onChunk(fullResponse);
  }

  // 4. Re-run inference with updated constraints
  const constraintSummary = extractConstraints(fullResponse, userMessage);
  const updatedConstraints = existingContext
    ? `${existingContext}\n\n--- Latest refinement ---\n${constraintSummary}`
    : constraintSummary;

  const updatedStructure = await inferDeckStructure(touchType, updatedConstraints);

  // 5. Compute diff
  const diff = computeStructureDiff(oldSections, updatedStructure.sections);

  // 6. Save messages
  const deckStructure = await prisma.deckStructure.findFirst({
    where: {
      touchType,
      artifactType: null,
    },
  });

  if (deckStructure) {
    // Save user message
    await prisma.deckChatMessage.create({
      data: {
        deckStructureId: deckStructure.id,
        role: "user",
        content: userMessage,
      },
    });

    // Save assistant response with diff
    await prisma.deckChatMessage.create({
      data: {
        deckStructureId: deckStructure.id,
        role: "assistant",
        content: fullResponse,
        structureDiff: JSON.stringify(diff),
      },
    });

    // Update lastChatAt for active session protection
    await prisma.deckStructure.update({
      where: { id: deckStructure.id },
      data: {
        lastChatAt: new Date(),
        chatContextJson: updatedConstraints,
      },
    });

    // 7. Chat context summarization: if >10 messages, summarize oldest
    const totalMessages = await prisma.deckChatMessage.count({
      where: { deckStructureId: deckStructure.id },
    });

    if (totalMessages > 10) {
      const allMessages = await prisma.deckChatMessage.findMany({
        where: { deckStructureId: deckStructure.id },
        orderBy: { createdAt: "asc" },
      });

      // Keep last 6, summarize the rest
      const toSummarize = allMessages.slice(0, allMessages.length - 6);
      const summary = await summarizeOldMessages(
        toSummarize.map((m) => ({ role: m.role, content: m.content })),
      );

      // Update context with summary and delete old messages
      await prisma.deckStructure.update({
        where: { id: deckStructure.id },
        data: {
          chatContextJson: `## Summarized conversation history\n${summary}\n\n--- Latest refinement ---\n${constraintSummary}`,
        },
      });

      // Delete summarized messages
      await prisma.deckChatMessage.deleteMany({
        where: {
          id: { in: toSummarize.map((m) => m.id) },
        },
      });
    }
  }

  return {
    aiResponse: fullResponse,
    updatedStructure,
    diff,
  };
}

// ────────────────────────────────────────────────────────────
// Prompt Builders
// ────────────────────────────────────────────────────────────

function buildChatPrompt(
  touchType: string,
  structureJson: string,
  chatContext: string,
  recentMessages: Array<{ role: string; content: string }>,
  newMessage: string,
): string {
  let prompt = `You are an AI assistant helping refine the deck structure for "${touchType}" presentations.

## Current Deck Structure
\`\`\`json
${structureJson}
\`\`\`
`;

  if (chatContext) {
    prompt += `\n## Previous Constraints & Context\n${chatContext}\n`;
  }

  if (recentMessages.length > 0) {
    prompt += `\n## Recent Conversation\n`;
    for (const msg of recentMessages) {
      prompt += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n`;
    }
  }

  prompt += `\n## New User Message\nUser: ${newMessage}

## Instructions
1. Analyze the user's feedback about the current deck structure.
2. Explain what changes you would recommend and why.
3. Be specific about which sections would be added, removed, modified, or reordered.
4. Keep your response concise and actionable (2-4 paragraphs max).
5. Do NOT output JSON — just explain the changes in natural language.`;

  return prompt;
}

function extractConstraints(aiResponse: string, userMessage: string): string {
  // Extract key actionable items from the AI response and user message
  return `User requested: "${userMessage}"\nAI recommended changes: ${aiResponse.substring(0, 500)}`;
}
