/**
 * Validate LLM-generated content fields are substantive (not truncated/abbreviated).
 *
 * Guards against LLM structured output returning stub values like "L..." or
 * single-word placeholders for fields that should contain full sentences.
 */

const MIN_FIELD_LENGTHS: Record<string, number> = {
  headline: 10,
  valueProposition: 20,
  callToAction: 10,
};

const MIN_CAPABILITY_LENGTH = 5;
const MIN_CAPABILITIES_COUNT = 2;

interface ContentFields {
  headline?: string;
  valueProposition?: string;
  callToAction?: string;
  keyCapabilities?: string[];
}

/**
 * Returns an array of human-readable validation failure messages.
 * Empty array means content passes validation.
 */
export function validateLlmContent(content: ContentFields): string[] {
  const failures: string[] = [];

  for (const [field, minLen] of Object.entries(MIN_FIELD_LENGTHS)) {
    const value = content[field as keyof ContentFields];
    if (typeof value === "string" && value.length < minLen) {
      failures.push(
        `${field} is too short (${value.length} chars, min ${minLen}): "${value}"`
      );
    }
  }

  const caps = content.keyCapabilities;
  if (Array.isArray(caps)) {
    if (caps.length < MIN_CAPABILITIES_COUNT) {
      failures.push(
        `keyCapabilities has only ${caps.length} items (min ${MIN_CAPABILITIES_COUNT})`
      );
    }
    caps.forEach((cap, i) => {
      if (cap.length < MIN_CAPABILITY_LENGTH) {
        failures.push(
          `keyCapabilities[${i}] is too short (${cap.length} chars): "${cap}"`
        );
      }
    });
  }

  return failures;
}

/**
 * Throws if content fields appear truncated or implausibly short.
 */
export function assertLlmContentQuality(content: ContentFields): void {
  const failures = validateLlmContent(content);
  if (failures.length > 0) {
    throw new Error(
      `LLM output quality check failed:\n${failures.join("\n")}`
    );
  }
}
