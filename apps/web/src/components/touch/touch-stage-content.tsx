"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, List, MessageSquare } from "lucide-react";
import { DeckPreview } from "./deck-preview";
import { Touch4ArtifactTabs } from "./touch-4-artifact-tabs";
import type { HitlStage } from "./hitl-stage-stepper";

interface TouchStageContentProps {
  touchType: string;
  stage: HitlStage;
  content: unknown;
}

export function TouchStageContent({
  touchType,
  stage,
  content,
}: TouchStageContentProps) {
  if (touchType === "touch_4") {
    return <Touch4ArtifactContent stage={stage} content={content} />;
  }

  if (touchType === "touch_1") {
    return <Touch1Content stage={stage} content={content} />;
  }

  // Touch 2 and Touch 3 share the same deck-based content pattern
  return <Touch23Content stage={stage} content={content} />;
}

// ────────────────────────────────────────────────────────────
// Touch 1 Content Renderers
// ────────────────────────────────────────────────────────────

function Touch1Content({
  stage,
  content,
}: {
  stage: HitlStage;
  content: unknown;
}) {
  const data = content as Record<string, unknown> | null;

  if (stage === "skeleton") {
    // Content outline: headline, value proposition, capabilities
    const headline = (data?.headline as string) ?? "";
    const valueProp = (data?.valueProposition as string) ?? "";
    const capabilities = (data?.keyCapabilities as string[]) ?? [];

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <List className="h-4 w-4 text-slate-500" />
            <Badge variant="secondary" className="text-xs">
              Outline
            </Badge>
          </div>
          <CardTitle className="text-lg">{headline || "Content Outline"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {valueProp && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">
                Value Proposition
              </p>
              <p className="leading-relaxed text-slate-700">{valueProp}</p>
            </div>
          )}
          {capabilities.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">
                Key Capabilities
              </p>
              <ul className="list-disc space-y-1 pl-4 text-slate-700">
                {capabilities.map((cap, i) => (
                  <li key={i}>{cap}</li>
                ))}
              </ul>
            </div>
          )}
          {!headline && !valueProp && capabilities.length === 0 && (
            <p className="text-slate-400 italic">No content available yet</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (stage === "lowfi") {
    // Detect structured slots vs old section-aware vs legacy content
    const sections = data?.sections as Array<{
      sectionName: string;
      sectionPurpose: string;
      headlines?: string[];
      bodyParagraphs?: string[];
      metrics?: Array<{ value: string; label: string }>;
      bulletPoints?: string[];
      speakerNotes?: string;
      contentText?: string; // legacy section-aware format
    }> | undefined;

    const isStructuredSlots = Array.isArray(sections) && sections.length > 0
      && Array.isArray(sections[0]?.headlines);
    const isOldSectionAware = !isStructuredSlots
      && Array.isArray(sections) && sections.length > 0
      && typeof sections[0]?.contentText === "string";

    if (isStructuredSlots) {
      // New structured slot format: per-section with headlines, metrics, body, bullets
      const headline = (data?.headline as string) ?? "";
      const callToAction = (data?.callToAction as string) ?? "";

      return (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              <Badge variant="secondary" className="text-xs">
                Structured Draft
              </Badge>
            </div>
            <CardTitle className="text-lg">{headline || "Draft Content"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {sections.map((section, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-3">
                {/* Section header */}
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-800">{section.sectionName}</p>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {section.sectionPurpose}
                  </Badge>
                </div>

                {/* Headlines */}
                {section.headlines && section.headlines.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase text-slate-500">Headlines</p>
                    <div className="space-y-1">
                      {section.headlines.map((h, j) => (
                        <p key={j} className="text-base font-semibold text-slate-800">{h}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Body Paragraphs */}
                {section.bodyParagraphs && section.bodyParagraphs.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase text-slate-500">Content</p>
                    {section.bodyParagraphs.map((bp, j) => (
                      <p key={j} className="whitespace-pre-wrap leading-relaxed text-slate-700 mb-2">{bp}</p>
                    ))}
                  </div>
                )}

                {/* Metrics as value+label cards */}
                {section.metrics && section.metrics.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase text-slate-500">Metrics</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {section.metrics.map((m, j) => (
                        <div key={j} className="rounded-md bg-slate-50 px-3 py-2 text-center">
                          <p className="text-lg font-bold text-blue-600">{m.value}</p>
                          <p className="text-[11px] text-slate-500">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bullet Points */}
                {section.bulletPoints && section.bulletPoints.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase text-slate-500">Key Points</p>
                    <ul className="list-disc space-y-1 pl-4 text-slate-700">
                      {section.bulletPoints.map((bp, j) => (
                        <li key={j}>{bp}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Speaker Notes */}
                {section.speakerNotes && (
                  <div className="flex items-start gap-1.5 rounded bg-slate-50 px-2 py-1.5">
                    <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                    <p className="text-xs text-slate-500">{section.speakerNotes}</p>
                  </div>
                )}
              </div>
            ))}
            {/* Call to action */}
            {callToAction && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase text-slate-500">
                  Call to Action
                </p>
                <p className="leading-relaxed text-slate-700">{callToAction}</p>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    if (isOldSectionAware) {
      // Old section-aware format: contentText per section (backward compat)
      const headline = (data?.headline as string) ?? "";
      const callToAction = (data?.callToAction as string) ?? "";

      return (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              <Badge variant="secondary" className="text-xs">
                Section-Aware Draft
              </Badge>
            </div>
            <CardTitle className="text-lg">{headline || "Draft Content"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {sections.map((section, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-800">{section.sectionName}</p>
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {section.sectionPurpose}
                  </Badge>
                </div>
                <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
                  {section.contentText}
                </p>
                {section.speakerNotes && (
                  <div className="flex items-start gap-1.5 rounded bg-slate-50 px-2 py-1.5">
                    <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                    <p className="text-xs text-slate-500">{section.speakerNotes}</p>
                  </div>
                )}
              </div>
            ))}
            {callToAction && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase text-slate-500">
                  Call to Action
                </p>
                <p className="leading-relaxed text-slate-700">{callToAction}</p>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    // Legacy: PagerContent fields: headline, valueProposition, keyCapabilities, callToAction
    const headline = (data?.headline as string) ?? "";
    const valueProp = (data?.valueProposition as string) ?? "";
    const capabilities = (data?.keyCapabilities as string[]) ?? [];
    const callToAction = (data?.callToAction as string) ?? "";
    const hasContent = headline || valueProp || capabilities.length > 0 || callToAction;

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            <Badge variant="secondary" className="text-xs">
              Draft
            </Badge>
          </div>
          <CardTitle className="text-lg">{headline || "Draft Content"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {valueProp && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">
                Value Proposition
              </p>
              <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
                {valueProp}
              </p>
            </div>
          )}
          {capabilities.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">
                Key Capabilities
              </p>
              <ul className="list-disc space-y-1 pl-4 text-slate-700">
                {capabilities.map((cap, i) => (
                  <li key={i}>{cap}</li>
                ))}
              </ul>
            </div>
          )}
          {callToAction && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-500">
                Call to Action
              </p>
              <p className="leading-relaxed text-slate-700">{callToAction}</p>
            </div>
          )}
          {!hasContent && (
            <p className="text-slate-400 italic">No draft content available yet</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // highfi: Google Slides deck preview
  return <HighFiContent content={data} />;
}

// ────────────────────────────────────────────────────────────
// Touch 2/3 Content Renderers
// ────────────────────────────────────────────────────────────

function Touch23Content({
  stage,
  content,
}: {
  stage: HitlStage;
  content: unknown;
}) {
  const data = content as Record<string, unknown> | null;

  if (stage === "skeleton") {
    // Support both legacy shape (selectedSlides array of objects) and
    // current workflow shape (selectedSlideIds + slideOrder + selectionRationale + sections)
    const legacySlides =
      (data?.selectedSlides as Array<{
        slideId?: string;
        title: string;
        reason: string;
      }>) ?? [];

    const selectedSlideIds = (data?.selectedSlideIds as string[]) ?? [];
    const slideOrder = (data?.slideOrder as string[]) ?? [];
    const selectionRationale = (data?.selectionRationale as string) ?? "";
    const personalizationNotes = (data?.personalizationNotes as string) ?? "";
    const sections = (data?.sections as Array<{
      sectionName: string;
      purpose: string;
      selectedSlideId: string | null;
      rationale: string;
    }>) ?? [];

    // If sections are available, render section-based view
    const hasSections = sections.length > 0;

    // Build display list for non-section view: prefer legacy shape, fall back to workflow shape
    const slides = legacySlides.length > 0
      ? legacySlides
      : (slideOrder.length > 0 ? slideOrder : selectedSlideIds).map((slideId, i) => ({
          slideId,
          title: `Slide ${i + 1}`,
          reason: selectionRationale || personalizationNotes || "Selected for deck",
        }));

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <List className="h-4 w-4 text-slate-500" />
            <Badge variant="secondary" className="text-xs">
              {hasSections ? "Blueprint Selection" : "Slide Selection"}
            </Badge>
          </div>
          <CardTitle className="text-lg">
            {hasSections ? "Deck Sections" : "Selected Slides"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {selectionRationale && (
            <p className="leading-relaxed text-slate-700">{selectionRationale}</p>
          )}
          {hasSections ? (
            <div className="space-y-2">
              {sections.map((section, i) => (
                <div
                  key={section.sectionName}
                  className="rounded-lg border border-slate-200 px-3 py-2 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800">
                      {i + 1}. {section.sectionName}
                    </p>
                    {section.selectedSlideId ? (
                      <Badge variant="default" className="text-[10px] font-normal bg-green-100 text-green-800 hover:bg-green-100">
                        Matched
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] font-normal text-amber-600 border-amber-300">
                        No match
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{section.purpose}</p>
                  <p className="text-xs text-slate-400 italic">{section.rationale}</p>
                </div>
              ))}
            </div>
          ) : slides.length > 0 ? (
            <div className="space-y-2">
              {slides.map((slide, i) => (
                <div
                  key={slide.slideId ?? i}
                  className="rounded-lg border border-slate-200 px-3 py-2"
                >
                  <p className="font-medium text-slate-800">
                    {i + 1}. {slide.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {slide.reason}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 italic">No slide selection available yet</p>
          )}
          {personalizationNotes && !selectionRationale && (
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <p className="text-xs font-medium uppercase text-slate-500 mb-1">Personalization Notes</p>
              <p className="text-slate-600 text-xs">{personalizationNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (stage === "lowfi") {
    // Draft slide order with per-slide notes
    const slideOrder =
      (data?.slideOrder as Array<{
        slideId?: string;
        title: string;
        notes?: string;
      }>) ?? [];
    // Also check slideNotes array (workflow stores notes in this shape)
    const slideNotes =
      (data?.slideNotes as Array<{
        slideId: string;
        notes: string;
        purpose: string;
      }>) ?? [];
    const draftText = (data?.draftText as string) ?? "";

    // slideOrder may be string[] (IDs) or Array<{slideId, title, notes}> (legacy)
    // Prefer slideNotes when available (richer data), fall back to slideOrder objects
    const isStringArray = slideOrder.length > 0 && typeof slideOrder[0] === "string";
    const enrichedSlides = slideNotes.length > 0
      ? slideNotes.map((sn) => ({
          slideId: sn.slideId,
          title: sn.purpose,
          notes: sn.notes,
        }))
      : isStringArray
        ? (slideOrder as unknown as string[]).map((id, i) => ({
            slideId: id,
            title: `Slide ${i + 1}`,
            notes: "",
          }))
        : slideOrder;

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            <Badge variant="secondary" className="text-xs">
              Draft Order
            </Badge>
          </div>
          <CardTitle className="text-lg">Slide Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {enrichedSlides.length > 0 ? (
            <ol className="space-y-2">
              {enrichedSlides.map((slide, i) => {
                // Detect section-enriched notes (start with "Section:")
                const notes = slide.notes ?? "";
                const isSectionNote = notes.startsWith("Section:");

                return (
                  <li
                    key={slide.slideId ?? i}
                    className="rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {isSectionNote ? (
                      <>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-800">
                            {i + 1}. {slide.title}
                          </p>
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {notes.split(" — ")[0]?.replace("Section: ", "") ?? ""}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {notes.split(" — ").slice(1).join(" — ")}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-slate-800">
                          {i + 1}. {slide.title}
                        </p>
                        {notes && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {notes}
                          </p>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : draftText ? (
            <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
              {draftText}
            </p>
          ) : (
            <p className="text-slate-400 italic">No draft order available yet</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // highfi: Google Slides deck preview
  return <HighFiContent content={data} />;
}

// ────────────────────────────────────────────────────────────
// Touch 4 Content (delegates to Touch4ArtifactTabs)
// ────────────────────────────────────────────────────────────

function Touch4ArtifactContent({
  stage,
  content,
}: {
  stage: HitlStage;
  content: unknown;
}) {
  const data = content as Record<string, unknown> | null;
  return (
    <Touch4ArtifactTabs
      stage={stage}
      content={{
        proposal: data?.proposal,
        talkTrack: data?.talkTrack,
        faq: data?.faq,
      }}
    />
  );
}

// ────────────────────────────────────────────────────────────
// Shared High-Fi Content Renderer
// ────────────────────────────────────────────────────────────

function HighFiContent({
  content,
}: {
  content: Record<string, unknown> | null;
}) {
  const presentationId = (content?.presentationId as string) ?? "";
  const driveUrl = (content?.driveUrl as string) ?? "";

  if (presentationId) {
    return (
      <div className="space-y-3">
        <DeckPreview presentationId={presentationId} />
        {driveUrl && (
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in Google Slides
          </a>
        )}
      </div>
    );
  }

  if (driveUrl) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Open Final Artifact
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-8 text-center">
        <p className="text-sm text-slate-400 italic">
          Final artifact is being prepared...
        </p>
      </CardContent>
    </Card>
  );
}
