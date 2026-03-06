/**
 * Maps raw error messages to user-friendly, actionable messages.
 * No raw stack traces or technical details are surfaced to the user.
 */
export function mapToFriendlyError(raw: string): string {
  const lower = raw.toLowerCase();

  if (lower.includes("timeout") || lower.includes("polling timeout")) {
    return "The generation is taking longer than expected. Please try again.";
  }

  if (lower.includes("drive") || lower.includes("folder")) {
    return "We couldn't save the file to Google Drive. Please try again.";
  }

  if (lower.includes("api") || lower.includes("model")) {
    return "AI generation encountered an issue. Please try again.";
  }

  if (lower.includes("workflow failed")) {
    return "The generation pipeline encountered an error. Please try again.";
  }

  if (lower.includes("network") || lower.includes("fetch")) {
    return "Connection issue. Check your network and try again.";
  }

  if (lower.includes("agent api error")) {
    return "The server encountered an issue. Please try again in a moment.";
  }

  return "Something went wrong. Please try again, or contact support if this continues.";
}
