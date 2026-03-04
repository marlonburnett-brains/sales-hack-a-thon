"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Lock } from "lucide-react";
import { Touch1Form } from "./touch-1-form";
import { Touch2Form } from "./touch-2-form";
import { Touch3Form } from "./touch-3-form";
import { Touch4Form } from "./touch-4-form";
import type { InteractionRecord } from "@/lib/api-client";

interface TouchFlowCardProps {
  dealId: string;
  touchNumber: number;
  touchName: string;
  description: string;
  available: boolean;
  companyName: string;
  industry: string;
  salespersonName?: string;
  interactions: InteractionRecord[];
}

const TOUCH_COLORS: Record<number, string> = {
  1: "bg-blue-50 border-blue-200",
  2: "bg-green-50 border-green-200",
  3: "bg-purple-50 border-purple-200",
  4: "bg-amber-50 border-amber-200",
};

export function TouchFlowCard({
  dealId,
  touchNumber,
  touchName,
  description,
  available,
  companyName,
  industry,
  salespersonName,
  interactions,
}: TouchFlowCardProps) {
  const [showForm, setShowForm] = useState(false);

  const hasCompleted = interactions.some(
    (i) =>
      i.status === "approved" ||
      i.status === "edited" ||
      i.status === "overridden"
  );

  const statusBadge = hasCompleted ? (
    <Badge variant="default" className="bg-green-600">
      Complete
    </Badge>
  ) : available ? (
    <Badge variant="secondary">Available</Badge>
  ) : (
    <Badge variant="outline" className="text-slate-400">
      Coming soon
    </Badge>
  );

  return (
    <Card
      className={`${TOUCH_COLORS[touchNumber] ?? ""} ${!available ? "opacity-60" : ""}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-semibold">
            Touch {touchNumber}: {touchName}
          </CardTitle>
          {statusBadge}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600">{description}</p>

        {available && !showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="w-full cursor-pointer gap-2"
            variant={hasCompleted ? "outline" : "default"}
          >
            <Sparkles className="h-4 w-4" />
            {hasCompleted ? "Generate Another" : "Generate"}
          </Button>
        )}

        {!available && (
          <Button disabled className="w-full gap-2" variant="outline">
            <Lock className="h-4 w-4" />
            Coming soon
          </Button>
        )}

        {showForm && touchNumber === 1 && (
          <Touch1Form
            dealId={dealId}
            companyName={companyName}
            industry={industry}
            salespersonName={salespersonName}
            onClose={() => setShowForm(false)}
          />
        )}

        {showForm && touchNumber === 2 && (
          <Touch2Form
            dealId={dealId}
            companyName={companyName}
            industry={industry}
            salespersonName={salespersonName}
            onClose={() => setShowForm(false)}
          />
        )}

        {showForm && touchNumber === 3 && (
          <Touch3Form
            dealId={dealId}
            companyName={companyName}
            industry={industry}
            onClose={() => setShowForm(false)}
          />
        )}

        {showForm && touchNumber === 4 && (
          <Touch4Form
            dealId={dealId}
            companyName={companyName}
            industry={industry}
            onClose={() => setShowForm(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}
