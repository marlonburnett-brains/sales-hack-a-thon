"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ExternalLink } from "lucide-react";

export function IntegrationsStatus() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Google Workspace card */}
      <Card className="border border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Google Workspace
            </CardTitle>
            <Badge className="gap-1 border-transparent bg-green-50 text-green-700 hover:bg-green-50">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-slate-500">
            Google Slides access for template ingestion and deck generation.
          </p>
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            Manage in Google
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>

      {/* AtlusAI card */}
      <Card className="border border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">AtlusAI</CardTitle>
            <Badge className="gap-1 border-transparent bg-green-50 text-green-700 hover:bg-green-50">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-slate-500">
            AI-powered discovery and content intelligence for sales proposals.
          </p>
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            Manage AtlusAI
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
