/**
 * Chat Refinement — Streaming LLM chat for deck structure refinement
 *
 * Users provide feedback on AI-inferred deck structures through conversation.
 * The assistant streams a response, then re-runs inference with updated constraints,
 * producing a diff of structural changes.
 */

import { type ArtifactType } from "@lumenalta/schemas";
import { prisma } from "../lib/db";
import {
  createJsonResponseOptions,
  executeRuntimeProviderNamedAgent,
  streamRuntimeProviderNamedAgent,
} from "../lib/agent-executor";
import { resolveDeckStructureKey } from "./deck-structure-key";
import { DECK_STRUCTURE_SCHEMA } from "./deck-structure-schema";
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
  const conversationText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const result = await executeRuntimeProviderNamedAgent({
    agentId: "deck-structure-refinement-assistant",
    messages: [
      {
        role: "user",
        content: `Summarize the following conversation about deck structure refinement into a concise list of constraints and requirements that should be maintained going forward. Only include actionable constraints, not pleasantries or questions.

Conversation:
${conversationText}

Return a bullet-point list of constraints:`,
      },
    ],
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
  artifactType: ArtifactType | null = null,
): Promise<ChatRefinementResult> {
  const key = resolveDeckStructureKey(touchType, artifactType);

  if (isUnsupportedGenericTouch4(key.touchType, key.artifactType)) {
    onChunk(GENERIC_TOUCH_4_UNAVAILABLE_MESSAGE);
    return {
      aiResponse: GENERIC_TOUCH_4_UNAVAILABLE_MESSAGE,
      updatedStructure: buildEmptyDeckStructureOutput(
        key.touchType,
        GENERIC_TOUCH_4_UNAVAILABLE_MESSAGE,
      ),
      diff: { added: [], modified: [], removed: [] },
    };
  }

  // 1. Load existing DeckStructure
  const existing = await prisma.deckStructure.findFirst({
    where: {
      touchType: key.touchType,
      artifactType: key.artifactType,
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
    key.touchType,
    currentStructureJson,
    existingContext,
    recentMessages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
    userMessage,
  );

  // 3. Stream AI response
  let fullResponse = "";

  try {
    // Try streaming first
    const streamResult = await streamRuntimeProviderNamedAgent({
      agentId: "deck-structure-refinement-assistant",
      messages: [{ role: "user", content: chatPrompt }],
    });

    for await (const chunk of streamResult.stream) {
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

    const result = await executeRuntimeProviderNamedAgent({
      agentId: "deck-structure-refinement-assistant",
      messages: [{ role: "user", content: chatPrompt }],
    });

    fullResponse = result.text ?? "I encountered an issue processing your feedback. Please try again.";
    onChunk(fullResponse);
  }

  // 4. Update structure from the chat feedback, with re-inference fallback
  const constraintSummary = extractConstraints(fullResponse, userMessage);
  const updatedConstraints = existingContext
    ? `${existingContext}\n\n--- Latest refinement ---\n${constraintSummary}`
    : constraintSummary;

  const currentStructure: DeckStructureOutput = {
    sections: oldSections,
    sequenceRationale: (() => {
      try {
        const parsed = JSON.parse(currentStructureJson) as DeckStructureOutput;
        return parsed.sequenceRationale ?? "";
      } catch {
        return "";
      }
    })(),
  };

  const refinedStructure = await refineStructureFromChat(
    key.touchType,
    currentStructureJson,
    currentStructure,
    existingContext,
    recentMessages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
    fullResponse,
    userMessage,
  );

  const updatedStructure =
    refinedStructure ?? (await inferDeckStructure(key, updatedConstraints));

  // 5. Compute diff
  const diff = computeStructureDiff(oldSections, updatedStructure.sections);

  // 6. Save messages
  const deckStructure = await prisma.deckStructure.findFirst({
    where: {
      touchType: key.touchType,
      artifactType: key.artifactType,
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
        structureJson: JSON.stringify(updatedStructure),
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

function normalizeDeckStructure(
  value: unknown,
  fallback: DeckStructureOutput,
): DeckStructureOutput {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<DeckStructureOutput>;
  const fallbackByName = new Map(
    fallback.sections.map((section) => [section.name, section]),
  );

  const sections = Array.isArray(candidate.sections)
    ? candidate.sections
        .map((section, index) => {
          if (!section || typeof section !== "object") {
            return null;
          }

          const normalizedSection = section as Partial<DeckSection>;
          const fallbackSection =
            typeof normalizedSection.name === "string"
              ? fallbackByName.get(normalizedSection.name)
              : undefined;

          const slideIds = Array.isArray(normalizedSection.slideIds)
            ? normalizedSection.slideIds.filter(
                (slideId): slideId is string => typeof slideId === "string",
              )
            : (fallbackSection?.slideIds ?? []);

          return {
            order:
              typeof normalizedSection.order === "number" &&
              Number.isFinite(normalizedSection.order)
                ? normalizedSection.order
                : index + 1,
            name:
              typeof normalizedSection.name === "string" &&
              normalizedSection.name.trim().length > 0
                ? normalizedSection.name.trim()
                : fallbackSection?.name ?? `Section ${index + 1}`,
            purpose:
              typeof normalizedSection.purpose === "string" &&
              normalizedSection.purpose.trim().length > 0
                ? normalizedSection.purpose.trim()
                : fallbackSection?.purpose ?? "Explain this part of the deck flow.",
            isOptional:
              typeof normalizedSection.isOptional === "boolean"
                ? normalizedSection.isOptional
                : (fallbackSection?.isOptional ?? false),
            variationCount:
              typeof normalizedSection.variationCount === "number" &&
              Number.isFinite(normalizedSection.variationCount)
                ? normalizedSection.variationCount
                : (fallbackSection?.variationCount ?? 0),
            slideIds,
          };
        })
        .filter((section): section is DeckSection => Boolean(section))
    : [];

  return {
    sections: sections.length > 0 ? sections : fallback.sections,
    sequenceRationale:
      typeof candidate.sequenceRationale === "string" &&
      candidate.sequenceRationale.trim().length > 0
        ? candidate.sequenceRationale.trim()
        : fallback.sequenceRationale,
  };
}

function buildStructureRefinementPrompt(
  touchType: string,
  structureJson: string,
  chatContext: string,
  recentMessages: Array<{ role: string; content: string }>,
  assistantResponse: string,
  userMessage: string,
): string {
  let prompt = `You are updating the current deck structure for "${touchType}" presentations based on explicit user refinement feedback.

## Current Deck Structure
\`\`\`json
${structureJson}
\`\`\`

## Latest User Request
${userMessage}

## Assistant Explanation
${assistantResponse}

Your job is to UPDATE the current structure so it follows the user's request as directly as possible.

Rules:
1. Treat the latest user request as a hard requirement unless it conflicts with itself.
2. Modify the existing structure directly instead of re-inferring the whole deck from examples.
3. Preserve existing slideIds and variationCount for unchanged sections whenever possible.
4. For newly added sections, use an empty slideIds array and variationCount 0 unless the current structure already contains a clear match.
5. Reorder sections when the user asked for a positional change.
6. Return only valid JSON matching the required schema.`;

  if (chatContext) {
    prompt += `\n\n## Existing Constraint Memory\n${chatContext}`;
  }

  if (recentMessages.length > 0) {
    prompt += "\n\n## Recent Conversation\n";
    for (const msg of recentMessages) {
      prompt += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n`;
    }
  }

  return prompt;
}

async function refineStructureFromChat(
  touchType: string,
  currentStructureJson: string,
  fallbackStructure: DeckStructureOutput,
  chatContext: string,
  recentMessages: Array<{ role: string; content: string }>,
  assistantResponse: string,
  userMessage: string,
): Promise<DeckStructureOutput | null> {
  try {
    const response = await executeRuntimeProviderNamedAgent({
      agentId: "deck-structure-refinement-assistant",
      messages: [
        {
          role: "user",
          content: buildStructureRefinementPrompt(
            touchType,
            currentStructureJson,
            chatContext,
            recentMessages,
            assistantResponse,
            userMessage,
          ),
        },
      ],
      options: createJsonResponseOptions(
        DECK_STRUCTURE_SCHEMA as Record<string, unknown>,
      ),
    });

    const text = response.text ?? "{}";
    const parsed = JSON.parse(text) as DeckStructureOutput;
    return normalizeDeckStructure(parsed, fallbackStructure);
  } catch (error) {
    console.warn(
      "[chat-refinement] Structured refinement failed, falling back to re-inference:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}
