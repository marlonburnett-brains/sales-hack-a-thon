import type {
  DealChatBinding,
  DealChatMeta,
  DealChatPromptVersion,
  DealChatRefineBeforeSave,
  DealChatRouteContext,
  DealChatSuggestion,
  DealChatTranscriptUpload,
  DealContextSource,
} from "@lumenalta/schemas";

import { searchSlides } from "../lib/atlusai-search";
import { streamRuntimeProviderNamedAgent } from "../lib/agent-executor";

import {
  detectDealContextNeedsReview,
  inferDealContextBinding,
} from "./bindings";
import { loadDealChatContext } from "./context";
import { isWebResearchAvailable, searchWeb } from "./web-research";

type RunDealChatTurnParams = {
  dealId: string;
  message: string;
  routeContext: DealChatRouteContext;
  transcriptUpload?: DealChatTranscriptUpload | null;
};

type RunDealChatTurnResult = {
  text: string;
  meta: DealChatMeta;
};

function normalizeTouchLabel(touchType: string | null | undefined): string {
  if (!touchType) {
    return "general deal context";
  }

  return touchType.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function truncate(text: string, limit = 160): string {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit - 1).trimEnd()}...`;
}

function looksLikeKnowledgeQuery(message: string): boolean {
  return /(similar|example|examples|case study|case studies|slides|use cases|use case)/i.test(
    message,
  );
}

function inferSourceType(message: string): "note" | "transcript" {
  if (/(transcript|speaker|meeting notes|call notes|inaudible|verbatim|recording)/i.test(message)) {
    return "transcript";
  }

  return "note";
}

function looksLikeSaveIntent(message: string): boolean {
  return (
    message.length > 60 ||
    /(save|note|notes|transcript|meeting|call recap|paste|pasted|inaudible|can you hear me|joining late|\?\?\?)/i.test(
      message,
    )
  );
}

function looksLikeWebResearchQuery(message: string): boolean {
  return /(research|look up|lookup|find out about|tell me about|what does .+ do|who is|company info|client info|background on|web search|search the web|google)/i.test(
    message,
  );
}

function getTurnInputText(params: RunDealChatTurnParams): string {
  return params.transcriptUpload?.text.trim() || params.message.trim();
}

function buildRuntimeSellerMessage(params: RunDealChatTurnParams): string {
  if (!params.transcriptUpload) {
    return params.message;
  }

  const lines = [`Uploaded transcript: ${params.transcriptUpload.fileName}`];
  const instruction = params.message.trim();

  if (instruction) {
    lines.push(`Seller instructions: ${instruction}`);
  }

  lines.push(`Transcript content:\n${params.transcriptUpload.text.trim()}`);

  return lines.join("\n\n");
}

function buildPromptVersionMeta(promptVersion: {
  agentId: string;
  id: string;
  version: number;
  publishedAt: Date | null;
  publishedBy: string | null;
}): DealChatPromptVersion {
  return {
    agentId: promptVersion.agentId,
    id: promptVersion.id,
    version: promptVersion.version,
    publishedAt: promptVersion.publishedAt?.toISOString() ?? null,
    publishedBy: promptVersion.publishedBy,
  };
}

async function collectStreamText(stream: AsyncIterable<{ text?: string }>): Promise<string> {
  let text = "";

  for await (const chunk of stream) {
    if (chunk.text) {
      text += chunk.text;
    }
  }

  return text.trim();
}

export function buildDealChatSuggestions(routeContext: DealChatRouteContext): DealChatSuggestion[] {
  const pageLabel = routeContext.pageLabel;

  const suggestions: DealChatSuggestion[] = [
    {
      id: `${routeContext.section}-history`,
      label: `What changed on ${pageLabel}?`,
      prompt: `What changed on ${pageLabel}?`,
      kind: "question",
    },
    {
      id: `${routeContext.section}-knowledge`,
      label: "Find similar cases",
      prompt: `Show similar cases for ${pageLabel}`,
      kind: "question",
    },
    {
      id: `${routeContext.section}-note`,
      label: "Save notes from this page",
      prompt: `Save these notes from ${pageLabel}`,
      kind: "save_note",
    },
  ];

  if (isWebResearchAvailable()) {
    suggestions.push({
      id: `${routeContext.section}-web-research`,
      label: "Research this client",
      prompt: "Research this client on the web",
      kind: "question",
    });
  }

  return suggestions;
}

function formatDealChatText(meta: DealChatMeta): string {
  const lines = [`Direct answer: ${meta.response.directAnswer}`];

  if (meta.response.supportingBullets.length > 0) {
    lines.push("", "Supporting details:");
    for (const bullet of meta.response.supportingBullets) {
      lines.push(`- ${bullet}`);
    }
  }

  if (meta.response.missingInfoCallouts.length > 0) {
    lines.push("", "Missing info:");
    for (const callout of meta.response.missingInfoCallouts) {
      lines.push(`- ${callout}`);
    }
  }

  if (meta.response.knowledgeMatches.length > 0) {
    lines.push("", "Top matches:");
    for (const match of meta.response.knowledgeMatches) {
      lines.push(`- ${match.title}: ${match.whyFit}`);
    }
  }

  if (meta.response.nextSteps.length > 0) {
    lines.push("", "Next steps:");
    for (const step of meta.response.nextSteps) {
      lines.push(`- ${step}`);
    }
  }

  return lines.join("\n");
}

function buildPendingBinding(binding: DealChatBinding): DealChatBinding {
  return {
    ...binding,
    status: "needs_confirmation",
  };
}

export async function runDealChatTurn(
  params: RunDealChatTurnParams,
): Promise<RunDealChatTurnResult> {
  const turnInputText = getTurnInputText(params);
  const context = await loadDealChatContext({
    dealId: params.dealId,
    routeContext: params.routeContext,
  });

  const runtime = await streamRuntimeProviderNamedAgent({
    agentId: "deal-chat-assistant",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          sellerMessage: buildRuntimeSellerMessage(params),
          deal: context.deal,
          routeContext: context.routeContext,
          promptSummary: context.promptSummary,
          recentMessages: context.recentMessages.slice(-4),
          interactions: context.interactions.slice(0, 4),
          sources: context.sources.slice(0, 4).map((source) => ({
            sourceType: source.sourceType,
            touchType: source.touchType,
            originPage: source.originPage,
            text: source.refinedText ?? source.rawText,
          })),
        }),
      },
    ],
  });

  const streamedText = await collectStreamText(runtime.stream);
  const suggestions = buildDealChatSuggestions(params.routeContext);
  const promptVersion = buildPromptVersionMeta(runtime.promptVersion);
  const knowledgeQuery = looksLikeKnowledgeQuery(params.message);
  const saveIntent = Boolean(params.transcriptUpload) || (!knowledgeQuery && looksLikeSaveIntent(turnInputText));

  let directAnswer = streamedText || `I grounded this answer in ${context.deal.company.name}'s deal context.`;
  let supportingBullets: string[] = [];
  let missingInfoCallouts: string[] = [];
  let nextSteps: string[] = [];
  let knowledgeMatches: DealChatMeta["response"]["knowledgeMatches"] = [];
  let binding: DealChatBinding | null = null;
  let refineBeforeSave: DealChatRefineBeforeSave | null = null;
  const confirmationChips: DealChatMeta["confirmationChips"] = [];

  if (knowledgeQuery) {
    const results = await searchSlides({
      query: params.message,
      industry: context.deal.company.industry,
      touchType: params.routeContext.touchType ?? undefined,
      limit: 3,
    });

    knowledgeMatches = results.slice(0, 3).map((result) => ({
      id: result.slideId,
      title: result.documentTitle,
      whyFit: `Fits ${context.deal.company.industry} because it references ${truncate(result.textContent || result.speakerNotes || "relevant outcomes", 72)}.`,
      summary: truncate(result.textContent || result.speakerNotes || "Relevant knowledge result."),
      sourceLabel: result.source === "mcp" ? "AtlusAI semantic search" : "Drive knowledge search",
      touchType:
        typeof result.metadata?.touchType === "string" ? result.metadata.touchType : null,
    }));

    directAnswer =
      knowledgeMatches.length > 0
        ? `I found ${knowledgeMatches.length} strong matches for this deal.`
        : "I did not find a strong knowledge match yet, so refine the ask with a pillar, industry, or touch.";
    supportingBullets = knowledgeMatches.map((match) => `${match.title} is relevant because ${match.whyFit}`);
    nextSteps =
      knowledgeMatches.length > 0
        ? [
            "Open the strongest match and pull proof points into the next seller talk track.",
            "Ask for another search scoped to a specific touch if you want tighter examples.",
          ]
        : ["Try adding the solution pillar or current touch to narrow the search."];
  } else if (isWebResearchAvailable() && looksLikeWebResearchQuery(params.message)) {
    const webResults = await searchWeb({
      query: params.message,
      companyName: context.deal.company.name,
      industry: context.deal.company.industry,
      maxResults: 5,
    });

    knowledgeMatches = webResults.results.slice(0, 3).map((result, index) => ({
      id: `web-${index}`,
      title: result.title,
      whyFit: truncate(result.content, 120),
      summary: truncate(result.content, 160),
      sourceLabel: "Web research",
      touchType: null,
    }));

    directAnswer = webResults.answer
      ? webResults.answer
      : `I found ${knowledgeMatches.length} web results about ${context.deal.company.name}.`;
    supportingBullets = webResults.results
      .slice(0, 3)
      .map((r) => `${r.title}: ${truncate(r.content, 100)}`);
    nextSteps = [
      "Ask me to save any of these findings as deal notes.",
      "Refine the search with a more specific question about the client.",
    ];
  } else if (saveIntent) {
    const source: DealContextSource = {
      id: null,
      sourceType: params.transcriptUpload ? "transcript" : inferSourceType(turnInputText),
      touchType: null,
      title: null,
      rawText: turnInputText,
      refinedText: null,
      routeContext: params.routeContext,
    };
    const inferred = inferDealContextBinding({
      routeContext: params.routeContext,
      source,
      recentBindings: context.sources
        .filter((entry) => entry.status === "saved")
        .slice(0, 3)
        .map((entry) => ({
          touchType: (entry.touchType as DealContextSource["touchType"]) ?? null,
          interactionId: null,
          createdAt: entry.createdAt,
          reason: `Saved from ${entry.originPage}`,
        })),
      interactions: context.interactions.slice(0, 4).map((interaction) => ({
        id: interaction.id,
        touchType: interaction.touchType,
        updatedAt: interaction.updatedAt,
      })),
    });
    const review = detectDealContextNeedsReview({
      sourceType: source.sourceType,
      rawText: source.rawText,
    });

    binding = buildPendingBinding(inferred.binding);
    refineBeforeSave = review.required ? review : null;
    suggestions.unshift({
      id: `${params.routeContext.section}-${source.sourceType}-confirm`,
      label:
        source.sourceType === "transcript"
          ? "Review transcript before save"
          : "Confirm note target",
      prompt:
        source.sourceType === "transcript"
          ? "Clean up this transcript before saving it"
          : "Confirm where this note should be saved",
      kind: source.sourceType === "transcript" ? "save_transcript" : "save_note",
    });
    directAnswer = review.required
      ? "This looks like transcript-like content that should be cleaned up before anything is saved."
      : `I can save this once you confirm the ${normalizeTouchLabel(binding.guessedTouchType)} target.`;
    supportingBullets = [
      `Best current guess: ${normalizeTouchLabel(binding.guessedTouchType)}.`,
      binding.reason ?? inferred.reason,
    ];
    nextSteps = review.required
      ? [
          "Use the refine-before-save action to clean the text first.",
          "Confirm the target touch or save it as general deal notes after the cleanup.",
        ]
      : [
          "Confirm the suggested target if it looks right.",
          "Choose a different touch or save as general deal notes if needed.",
        ];
  } else {
    const latestInteraction = context.interactions[0];
    const latestSource = context.sources[0];

    directAnswer = latestInteraction
      ? `Since ${normalizeTouchLabel(params.routeContext.touchType ?? "touch_2")}, the deal has advanced through ${normalizeTouchLabel(latestInteraction.touchType)} and the team has newer context to use.`
      : `I can answer from the saved deal context, but this deal still has limited interaction history.`;
    supportingBullets = [
      latestInteraction
        ? `${normalizeTouchLabel(latestInteraction.touchType)} is the freshest recorded interaction with status ${latestInteraction.status}.`
        : "No recent interaction has been saved yet.",
      latestSource
        ? `Latest saved context from ${latestSource.originPage}: ${truncate(latestSource.refinedText ?? latestSource.rawText, 120)}`
        : "No saved notes or transcripts are available yet.",
    ];
    missingInfoCallouts = latestSource
      ? []
      : ["There is no saved transcript or note for the current page yet, so this answer leans on interaction status only."];
    nextSteps = [
      `Open ${params.routeContext.pageLabel} and save any fresh seller notes if the answer needs more detail.`,
      "Ask for similar cases if you want proof points to support the next conversation.",
    ];
  }

  const meta: DealChatMeta = {
    response: {
      directAnswer,
      supportingBullets,
      missingInfoCallouts,
      nextSteps,
      knowledgeMatches,
    },
    suggestions,
    binding,
    refineBeforeSave,
    confirmationChips,
    promptVersion,
  };

  return {
    text: formatDealChatText(meta),
    meta,
  };
}
