"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, List } from "lucide-react";
import { DeckPreview } from "./deck-preview";
import { Touch4ArtifactTabs } from "./touch-4-artifact-tabs";
import type { HitlStage } from "./hitl-stage-stepper";

interface TouchStageContentProps {
  touchType: string;
  stage: HitlStage;
  content: unknown;
  displayMode: "inline" | "inline-diff" | "side-by-side";
}

// TODO: "inline-diff" and "side-by-side" modes render the same as "inline" for now.
// They will be enhanced when the chat refinement integration lands.

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
    // Full draft text with sections
    const sections = (data?.sections as Array<{ title: string; body: string }>) ?? [];
    const draftText = (data?.draftText as string) ?? (data?.text as string) ?? "";

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            <Badge variant="secondary" className="text-xs">
              Draft
            </Badge>
          </div>
          <CardTitle className="text-lg">Draft Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {sections.length > 0
            ? sections.map((section, i) => (
                <div key={i}>
                  <h4 className="mb-1 font-semibold text-slate-800">
                    {section.title}
                  </h4>
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
                    {section.body}
                  </p>
                </div>
              ))
            : draftText && (
                <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
                  {draftText}
                </p>
              )}
          {sections.length === 0 && !draftText && (
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
    // Slide selection rationale
    const slides =
      (data?.selectedSlides as Array<{
        slideId?: string;
        title: string;
        reason: string;
      }>) ?? [];

    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <List className="h-4 w-4 text-slate-500" />
            <Badge variant="secondary" className="text-xs">
              Slide Selection
            </Badge>
          </div>
          <CardTitle className="text-lg">Selected Slides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {slides.length > 0 ? (
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
    const draftText = (data?.draftText as string) ?? "";

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
          {slideOrder.length > 0 ? (
            <ol className="space-y-2">
              {slideOrder.map((slide, i) => (
                <li
                  key={slide.slideId ?? i}
                  className="rounded-lg border border-slate-200 px-3 py-2"
                >
                  <p className="font-medium text-slate-800">
                    {i + 1}. {slide.title}
                  </p>
                  {slide.notes && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {slide.notes}
                    </p>
                  )}
                </li>
              ))}
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
