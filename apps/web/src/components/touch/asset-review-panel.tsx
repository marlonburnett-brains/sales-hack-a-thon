"use client";

import { FileText, HelpCircle, ExternalLink, Presentation } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function getEmbedUrl(driveUrl: string, type: "slides" | "docs"): string {
  const id = driveUrl.split("/d/")[1]?.split("/")[0];
  if (!id) return driveUrl;
  if (type === "slides") {
    return `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false&delayms=3000`;
  }
  return `https://docs.google.com/document/d/${id}/preview`;
}

interface AssetReviewPanelProps {
  outputRefs: {
    deckUrl: string;
    talkTrackUrl: string;
    faqUrl: string;
  };
}

export function AssetReviewPanel({ outputRefs }: AssetReviewPanelProps) {
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
          <iframe
            src={getEmbedUrl(outputRefs.deckUrl, "slides")}
            className="h-[450px] w-full rounded-md border"
            allowFullScreen
            title="Proposal Deck preview"
          />
        </CardContent>
      </Card>

      {/* Talk Track */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-green-600" />
              Talk Track
            </CardTitle>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="cursor-pointer gap-1.5"
            >
              <a
                href={outputRefs.talkTrackUrl}
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
          <iframe
            src={getEmbedUrl(outputRefs.talkTrackUrl, "docs")}
            className="h-[350px] w-full rounded-md border"
            allowFullScreen
            title="Talk Track preview"
          />
        </CardContent>
      </Card>

      {/* Buyer FAQ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="h-5 w-5 text-purple-600" />
              Buyer FAQ
            </CardTitle>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="cursor-pointer gap-1.5"
            >
              <a
                href={outputRefs.faqUrl}
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
          <iframe
            src={getEmbedUrl(outputRefs.faqUrl, "docs")}
            className="h-[350px] w-full rounded-md border"
            allowFullScreen
            title="Buyer FAQ preview"
          />
        </CardContent>
      </Card>
    </div>
  );
}
