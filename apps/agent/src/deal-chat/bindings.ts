import type {
  DealChatBinding,
  DealChatRefineBeforeSave,
  DealChatRouteContext,
  DealChatTouchType,
  DealContextSource,
} from "@lumenalta/schemas";

type RecentBinding = {
  touchType: DealChatTouchType | null;
  interactionId: string | null;
  createdAt: Date;
  reason: string;
};

type InteractionSummary = {
  id: string;
  touchType: DealChatTouchType;
  updatedAt: Date;
};

type InferDealContextBindingInput = {
  routeContext: DealChatRouteContext;
  source: DealContextSource;
  recentBindings: RecentBinding[];
  interactions: InteractionSummary[];
};

export type InferredDealContextBinding = {
  binding: DealChatBinding;
  touchType: DealChatTouchType | null;
  interactionId: string | null;
  requiresConfirmation: boolean;
  reason: string;
  confidence: "high" | "medium" | "low";
};

const TRANSCRIPT_NOISE_PATTERNS = [/\[inaudible\]/i, /\?\?\?/, /\.\.\./, /joining late/i];

function buildConfirmationLabel(touchType: DealChatTouchType | null): string {
  if (!touchType) {
    return "Save as general deal notes";
  }

  return `Save to ${touchType.replace("_", " ")}`;
}

function buildBinding(
  source: DealContextSource,
  touchType: DealChatTouchType | null,
  requiresConfirmation: boolean,
  reason: string,
): DealChatBinding {
  return {
    status: requiresConfirmation ? "needs_confirmation" : "confirmed",
    source,
    guessedTouchType: touchType,
    confirmationLabel: buildConfirmationLabel(touchType),
    reason,
  };
}

function sortByDateDesc<T extends { createdAt?: Date; updatedAt?: Date }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftTime = (left.createdAt ?? left.updatedAt ?? new Date(0)).getTime();
    const rightTime = (right.createdAt ?? right.updatedAt ?? new Date(0)).getTime();
    return rightTime - leftTime;
  });
}

export function inferDealContextBinding(
  input: InferDealContextBindingInput,
): InferredDealContextBinding {
  const { routeContext, source, recentBindings, interactions } = input;

  if (source.touchType) {
    return {
      binding: buildBinding(source, source.touchType, false, "Source already includes a touch binding."),
      touchType: source.touchType,
      interactionId: null,
      requiresConfirmation: false,
      reason: "Source already includes a touch binding.",
      confidence: "high",
    };
  }

  if (routeContext.section === "touch" && routeContext.touchType) {
    return {
      binding: buildBinding(source, routeContext.touchType, false, "Current route is already scoped to this touch."),
      touchType: routeContext.touchType,
      interactionId: null,
      requiresConfirmation: false,
      reason: "Current route is already scoped to this touch.",
      confidence: "high",
    };
  }

  const recentMatch = sortByDateDesc(recentBindings)[0] ?? null;
  const historyMatch = sortByDateDesc(interactions)[0] ?? null;

  if (
    source.sourceType === "transcript" &&
    recentMatch?.touchType &&
    historyMatch?.touchType &&
    recentMatch.touchType !== historyMatch.touchType
  ) {
    const reason =
      "This could belong to multiple touches, so keep it as general deal notes until the seller confirms the right binding.";

    return {
      binding: buildBinding(source, null, true, reason),
      touchType: null,
      interactionId: null,
      requiresConfirmation: true,
      reason,
      confidence: "low",
    };
  }

  if (recentMatch?.touchType) {
    const reason = `Recent chat context points to ${recentMatch.touchType}. Confirm before saving.`;
    return {
      binding: buildBinding(source, recentMatch.touchType, true, reason),
      touchType: recentMatch.touchType,
      interactionId: recentMatch.interactionId,
      requiresConfirmation: true,
      reason,
      confidence: "medium",
    };
  }

  if (historyMatch?.touchType) {
    const reason = `Recent deal history points to ${historyMatch.touchType}. Confirm before saving.`;
    return {
      binding: buildBinding(source, historyMatch.touchType, true, reason),
      touchType: historyMatch.touchType,
      interactionId: historyMatch.id,
      requiresConfirmation: true,
      reason,
      confidence: "medium",
    };
  }

  const reason =
    routeContext.section === "overview" || routeContext.section === "briefing"
      ? "No touch signal is strong enough yet, so save it as general deal notes unless the seller chooses a touch."
      : "No touch signal is strong enough yet. Confirm the target before saving.";

  return {
    binding: buildBinding(source, null, true, reason),
    touchType: null,
    interactionId: null,
    requiresConfirmation: true,
    reason,
    confidence: "low",
  };
}

export function detectDealContextNeedsReview(
  source: Pick<DealContextSource, "sourceType" | "rawText">,
): DealChatRefineBeforeSave {
  const normalized = source.rawText.trim();
  const lower = normalized.toLowerCase();
  const looksMessy =
    normalized.length < 80 || TRANSCRIPT_NOISE_PATTERNS.some((pattern) => pattern.test(lower));

  if (source.sourceType === "transcript" && looksMessy) {
    return {
      required: true,
      reason: "This transcript looks messy or partial, so it should be reviewed before save.",
      suggestedPrompt: "Please clean up this transcript into clear seller-ready notes before saving.",
      draftText: normalized,
    };
  }

  return {
    required: false,
    reason: "Input looks clear enough to save.",
    suggestedPrompt: null,
    draftText: normalized,
  };
}
