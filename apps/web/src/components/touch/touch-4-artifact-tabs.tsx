"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, HelpCircle, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { HitlStage } from "./hitl-stage-stepper";

interface Touch4ArtifactTabsProps {
  stage: HitlStage;
  content: {
    proposal?: unknown;
    talkTrack?: unknown;
    faq?: unknown;
  };
}

type TabKey = "proposal" | "talk-track" | "faq";

const TAB_CONFIG: Array<{
  key: TabKey;
  label: string;
  icon: typeof FileText;
}> = [
  { key: "proposal", label: "Proposal", icon: FileText },
  { key: "talk-track", label: "Talk Track", icon: MessageSquare },
  { key: "faq", label: "FAQ", icon: HelpCircle },
];

export function Touch4ArtifactTabs({
  stage,
  content,
}: Touch4ArtifactTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("proposal");

  // Reset tab only on stage change (per pitfall #5: don't reset on content update within a stage)
  useEffect(() => {
    setActiveTab("proposal");
  }, [stage]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as TabKey)}
      className="space-y-4"
    >
      <TabsList className="grid w-full grid-cols-3">
        {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
          <TabsTrigger
            key={key}
            value={key}
            className="cursor-pointer gap-1.5"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="proposal">
        <ArtifactPanel
          stage={stage}
          data={content.proposal}
          type="proposal"
        />
      </TabsContent>

      <TabsContent value="talk-track">
        <ArtifactPanel
          stage={stage}
          data={content.talkTrack}
          type="talkTrack"
        />
      </TabsContent>

      <TabsContent value="faq">
        <ArtifactPanel stage={stage} data={content.faq} type="faq" />
      </TabsContent>
    </Tabs>
  );
}

// ────────────────────────────────────────────────────────────
// Artifact Panel: renders content based on stage
// ────────────────────────────────────────────────────────────

function ArtifactPanel({
  stage,
  data,
  type,
}: {
  stage: HitlStage;
  data: unknown;
  type: "proposal" | "talkTrack" | "faq";
}) {
  const record = data as Record<string, unknown> | null;

  if (!record) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-slate-400 italic">
            No {type === "talkTrack" ? "talk track" : type} content available yet
          </p>
        </CardContent>
      </Card>
    );
  }

  if (stage === "skeleton") {
    return <SkeletonPanel data={record} type={type} />;
  }

  if (stage === "lowfi") {
    return <LowfiPanel data={record} type={type} />;
  }

  // highfi: Google Slides/Docs link
  return <HighfiPanel data={record} type={type} />;
}

// ────────────────────────────────────────────────────────────
// Skeleton Stage Renderers
// ────────────────────────────────────────────────────────────

function SkeletonPanel({
  data,
  type,
}: {
  data: Record<string, unknown>;
  type: string;
}) {
  if (type === "proposal") {
    // Pillar breakdown
    const pillars = (data.pillars as Array<{ name: string; description: string }>) ?? [];
    const outline = (data.outline as string) ?? "";
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Proposal Outline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {pillars.length > 0 ? (
            pillars.map((p, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 px-3 py-2"
              >
                <p className="font-medium text-slate-800">{p.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{p.description}</p>
              </div>
            ))
          ) : outline ? (
            <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
              {outline}
            </p>
          ) : (
            <RenderGenericContent data={data} />
          )}
        </CardContent>
      </Card>
    );
  }

  if (type === "talkTrack") {
    // Outline
    const sections =
      (data.sections as Array<{ title: string; points?: string[] }>) ?? [];
    const outline = (data.outline as string) ?? "";
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Talk Track Outline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {sections.length > 0 ? (
            sections.map((s, i) => (
              <div key={i}>
                <p className="font-medium text-slate-800">{s.title}</p>
                {s.points && (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
                    {s.points.map((point, j) => (
                      <li key={j}>{point}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          ) : outline ? (
            <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
              {outline}
            </p>
          ) : (
            <RenderGenericContent data={data} />
          )}
        </CardContent>
      </Card>
    );
  }

  // FAQ: key question areas
  const questions =
    (data.questions as Array<{ area: string; topic?: string }>) ?? [];
  const areas = (data.areas as string[]) ?? [];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Key Question Areas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {questions.length > 0 ? (
          questions.map((q, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 px-3 py-2"
            >
              <p className="text-slate-700">{q.area ?? q.topic}</p>
            </div>
          ))
        ) : areas.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4 text-slate-700">
            {areas.map((area, i) => (
              <li key={i}>{area}</li>
            ))}
          </ul>
        ) : (
          <RenderGenericContent data={data} />
        )}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Lowfi Stage Renderers
// ────────────────────────────────────────────────────────────

function LowfiPanel({
  data,
  type,
}: {
  data: Record<string, unknown>;
  type: string;
}) {
  if (type === "faq") {
    // Full Q&A pairs
    const pairs =
      (data.pairs as Array<{ question: string; answer: string }>) ??
      (data.items as Array<{ question: string; answer: string }>) ??
      [];
    const draftText = (data.draftText as string) ?? (data.text as string) ?? "";

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">FAQ Draft</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {pairs.length > 0 ? (
            pairs.map((pair, i) => (
              <div key={i} className="space-y-1">
                <p className="font-medium text-slate-800">
                  Q: {pair.question}
                </p>
                <p className="leading-relaxed text-slate-600">
                  A: {pair.answer}
                </p>
              </div>
            ))
          ) : draftText ? (
            <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
              {draftText}
            </p>
          ) : (
            <RenderGenericContent data={data} />
          )}
        </CardContent>
      </Card>
    );
  }

  // Proposal or Talk Track: full draft text
  const label =
    type === "proposal" ? "Proposal Draft" : "Talk Track Draft";
  const draftText = (data.draftText as string) ?? (data.text as string) ?? "";
  const sections =
    (data.sections as Array<{ title: string; body: string }>) ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{label}</CardTitle>
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
          : draftText ? (
              <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
                {draftText}
              </p>
            ) : (
              <RenderGenericContent data={data} />
            )}
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Highfi Stage Renderers
// ────────────────────────────────────────────────────────────

function HighfiPanel({
  data,
  type,
}: {
  data: Record<string, unknown>;
  type: string;
}) {
  const url = (data.url as string) ?? (data.driveUrl as string) ?? "";
  const label =
    type === "proposal"
      ? "Google Slides"
      : type === "talkTrack"
        ? "Google Docs"
        : "Google Docs";

  if (!url) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-slate-400 italic">
            Final {type === "talkTrack" ? "talk track" : type} is being prepared...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-center py-8">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
        >
          <ExternalLink className="h-4 w-4" />
          Open in {label}
        </a>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Fallback renderer for unknown content shapes
// ────────────────────────────────────────────────────────────

function RenderGenericContent({
  data,
}: {
  data: Record<string, unknown>;
}) {
  const entries = Object.entries(data).filter(
    ([, v]) => v !== null && v !== undefined
  );

  if (entries.length === 0) {
    return <p className="text-slate-400 italic">No content available yet</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key}>
          <Badge variant="outline" className="mb-1 text-xs">
            {key}
          </Badge>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {typeof value === "string"
              ? value
              : JSON.stringify(value, null, 2)}
          </p>
        </div>
      ))}
    </div>
  );
}
