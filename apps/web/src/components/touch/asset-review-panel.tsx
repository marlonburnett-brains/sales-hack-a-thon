"use client";

import { FileText, HelpCircle, ExternalLink, Presentation } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeckPreview } from "./deck-preview";

function extractPresentationId(driveUrl: string): string | null {
  return driveUrl.split("/d/")[1]?.split("/")[0] ?? null;
}

interface AssetReviewPanelProps {
  outputRefs: {
    deckUrl: string;
    talkTrackUrl: string;
    faqUrl: string;
  };
}

function DriveDocCard({
  title,
  icon,
  url,
}: {
  title: string;
  icon: React.ReactNode;
  url: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {title}
          </CardTitle>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="cursor-pointer gap-1.5"
          >
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Drive
            </a>
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}

export function AssetReviewPanel({ outputRefs }: AssetReviewPanelProps) {
  const deckId = extractPresentationId(outputRefs.deckUrl);

  return (
    <div className="space-y-6">
      {/* Proposal Deck */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Presentation className="h-5 w-5 text-blue-600" />
              Proposal Deck
            </CardTitle>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="cursor-pointer gap-1.5"
            >
              <a
                href={outputRefs.deckUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Drive
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {deckId ? (
            <DeckPreview presentationId={deckId} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Deck URL not available
            </p>
          )}
        </CardContent>
      </Card>

      {/* Talk Track */}
      <DriveDocCard
        title="Talk Track"
        icon={<FileText className="h-5 w-5 text-green-600" />}
        url={outputRefs.talkTrackUrl}
      />

      {/* Buyer FAQ */}
      <DriveDocCard
        title="Buyer FAQ"
        icon={<HelpCircle className="h-5 w-5 text-purple-600" />}
        url={outputRefs.faqUrl}
      />
    </div>
  );
}
