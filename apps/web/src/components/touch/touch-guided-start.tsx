"use client";

import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TouchGuidedStartProps {
  touchNumber: number;
  touchType: string;
  dealId: string;
  companyName: string;
  industry: string;
  onGenerate: () => void;
  isGenerating?: boolean;
}

const TOUCH_DESCRIPTIONS: Record<number, string> = {
  1: "Generate a first-contact pager with headline, value proposition, and capabilities",
  2: "Generate a Meet Lumenalta deck with curated slide selection",
  3: "Generate a capability alignment deck for your use cases",
  4: "Generate a sales proposal, talk track, and buyer FAQ",
};

export function TouchGuidedStart({
  touchNumber,
  companyName,
  industry,
  onGenerate,
  isGenerating = false,
}: TouchGuidedStartProps) {
  const description =
    TOUCH_DESCRIPTIONS[touchNumber] ?? "Generate content for this touch";

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
          <Sparkles className="h-5 w-5 text-blue-600" />
        </div>
        <CardTitle className="text-lg">Ready to Generate</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Deal context */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge variant="secondary">{companyName}</Badge>
          <Badge variant="outline">{industry}</Badge>
        </div>

        {/* Touch-specific description */}
        <p className="text-center text-sm leading-relaxed text-slate-600">
          {description}
        </p>

        {/* Generate button */}
        <Button
          onClick={onGenerate}
          disabled={isGenerating}
          size="lg"
          className="w-full cursor-pointer"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            "Generate"
          )}
        </Button>

        {/* Subtle help text */}
        <p className="text-center text-xs text-slate-400">
          You can refine the output at each stage before approving
        </p>
      </CardContent>
    </Card>
  );
}
