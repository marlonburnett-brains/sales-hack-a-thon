/**
 * Brand Compliance Checker -- Pure Logic (No LLM, No API, No DB)
 *
 * Runs programmatic checks on SlideJSON before HITL-2 triggers.
 * Issues are surfaced as warnings (not blockers) in the review panel.
 *
 * 8 checks in 2 categories:
 *   Slide Structure: deck length, slide titles, bullet counts, speaker notes
 *   Content Quality: client name, empty content, problem restatement, next steps
 */

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface ComplianceCheck {
  check: string;
  message: string;
  severity: "pass" | "warn";
}

export interface ComplianceResult {
  passed: boolean;
  warnings: ComplianceCheck[];
}

interface SlideInput {
  slideTitle: string;
  bullets: string[];
  speakerNotes: string;
  sectionType: string;
  sourceType: string;
}

// ────────────────────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────────────────────

export function runBrandComplianceChecks(params: {
  slideJSON: { slides: SlideInput[] };
  companyName: string;
}): ComplianceResult {
  const { slideJSON, companyName } = params;
  const { slides } = slideJSON;
  const checks: ComplianceCheck[] = [];

  // ── Slide Structure Checks ───────────────────────────────

  // 1. Deck length within 8-18 range
  if (slides.length < 8 || slides.length > 18) {
    checks.push({
      check: "deck_length",
      message: `Deck has ${slides.length} slides (expected 8-18).`,
      severity: "warn",
    });
  } else {
    checks.push({
      check: "deck_length",
      message: `Deck has ${slides.length} slides (within 8-18 range).`,
      severity: "pass",
    });
  }

  // 2. Every slide has a non-empty title
  const missingTitleSlides: number[] = [];
  for (let i = 0; i < slides.length; i++) {
    if (!slides[i].slideTitle || slides[i].slideTitle.trim() === "") {
      missingTitleSlides.push(i + 1);
    }
  }
  if (missingTitleSlides.length > 0) {
    checks.push({
      check: "slide_titles",
      message: `Slides missing titles: ${missingTitleSlides.join(", ")}.`,
      severity: "warn",
    });
  } else {
    checks.push({
      check: "slide_titles",
      message: "All slides have titles.",
      severity: "pass",
    });
  }

  // 3. Bullet count 3-6 per slide (skip title-only slides)
  const bulletIssueSlides: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    // Skip title-only slides (sectionType "title" or "cover" or slides with no bullets by design)
    if (
      slide.sectionType === "title" ||
      slide.sectionType === "cover" ||
      slide.sectionType === "title_slide"
    ) {
      continue;
    }
    const bulletCount = slide.bullets.length;
    if (bulletCount < 3 || bulletCount > 6) {
      bulletIssueSlides.push(`Slide ${i + 1} (${bulletCount} bullets)`);
    }
  }
  if (bulletIssueSlides.length > 0) {
    checks.push({
      check: "bullet_counts",
      message: `Bullet count outside 3-6 range: ${bulletIssueSlides.join("; ")}.`,
      severity: "warn",
    });
  } else {
    checks.push({
      check: "bullet_counts",
      message: "All slides have 3-6 bullets (or are title-only).",
      severity: "pass",
    });
  }

  // 4. Speaker notes present on every slide
  const missingSpeakerNotes: number[] = [];
  for (let i = 0; i < slides.length; i++) {
    if (!slides[i].speakerNotes || slides[i].speakerNotes.trim() === "") {
      missingSpeakerNotes.push(i + 1);
    }
  }
  if (missingSpeakerNotes.length > 0) {
    checks.push({
      check: "speaker_notes",
      message: `Slides missing speaker notes: ${missingSpeakerNotes.join(", ")}.`,
      severity: "warn",
    });
  } else {
    checks.push({
      check: "speaker_notes",
      message: "All slides have speaker notes.",
      severity: "pass",
    });
  }

  // ── Content Quality Checks ───────────────────────────────

  // 5. Client name appears in at least one slide (title or bullets)
  const normalizedName = companyName.toLowerCase();
  const clientNameFound = slides.some((slide) => {
    const titleMatch = slide.slideTitle.toLowerCase().includes(normalizedName);
    const bulletMatch = slide.bullets.some((b) =>
      b.toLowerCase().includes(normalizedName)
    );
    return titleMatch || bulletMatch;
  });
  if (!clientNameFound) {
    checks.push({
      check: "client_name",
      message: `Client name "${companyName}" not found in any slide title or bullet.`,
      severity: "warn",
    });
  } else {
    checks.push({
      check: "client_name",
      message: `Client name "${companyName}" appears in deck content.`,
      severity: "pass",
    });
  }

  // 6. No empty content blocks -- at least one bullet per non-title slide
  const emptyContentSlides: number[] = [];
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (
      slide.sectionType === "title" ||
      slide.sectionType === "cover" ||
      slide.sectionType === "title_slide"
    ) {
      continue;
    }
    if (slide.bullets.length === 0) {
      emptyContentSlides.push(i + 1);
    }
  }
  if (emptyContentSlides.length > 0) {
    checks.push({
      check: "empty_content",
      message: `Slides with no content: ${emptyContentSlides.join(", ")}.`,
      severity: "warn",
    });
  } else {
    checks.push({
      check: "empty_content",
      message: "All content slides have at least one bullet.",
      severity: "pass",
    });
  }

  // 7. Problem restatement slide present (sectionType === "problem_restatement")
  const hasProblemRestatement = slides.some(
    (s) => s.sectionType === "problem_restatement"
  );
  if (!hasProblemRestatement) {
    checks.push({
      check: "problem_restatement",
      message: "No problem restatement slide found (sectionType: problem_restatement).",
      severity: "warn",
    });
  } else {
    checks.push({
      check: "problem_restatement",
      message: "Problem restatement slide present.",
      severity: "pass",
    });
  }

  // 8. Next steps slide present (sectionType === "next_steps")
  const hasNextSteps = slides.some((s) => s.sectionType === "next_steps");
  if (!hasNextSteps) {
    checks.push({
      check: "next_steps",
      message: "No next steps slide found (sectionType: next_steps).",
      severity: "warn",
    });
  } else {
    checks.push({
      check: "next_steps",
      message: "Next steps slide present.",
      severity: "pass",
    });
  }

  // ── Result ───────────────────────────────────────────────

  const warnings = checks.filter((c) => c.severity === "warn");
  return {
    passed: warnings.length === 0,
    warnings: checks, // Include all checks (pass and warn) for full visibility
  };
}
