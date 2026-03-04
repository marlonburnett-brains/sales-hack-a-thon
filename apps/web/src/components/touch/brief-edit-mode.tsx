"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus, Loader2, Save } from "lucide-react";
import { SOLUTION_PILLARS } from "@lumenalta/schemas";
import type { SalesBrief, ROIFraming } from "@lumenalta/schemas";

interface BriefEditModeProps {
  briefData: SalesBrief;
  roiFramingData: ROIFraming;
  onSave: (editedBrief: SalesBrief) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

interface UseCaseForm {
  name: string;
  description: string;
  roiOutcome: string;
  valueHypothesis: string;
}

export function BriefEditMode({
  briefData,
  onSave,
  onCancel,
  isSaving,
}: BriefEditModeProps) {
  // Local form state initialized from briefData
  const [primaryPillar, setPrimaryPillar] = useState(briefData.primaryPillar);
  const [secondaryPillars, setSecondaryPillars] = useState<string[]>([
    ...briefData.secondaryPillars,
  ]);
  const [evidence, setEvidence] = useState(briefData.evidence);
  const [customerContext, setCustomerContext] = useState(
    briefData.customerContext
  );
  const [businessOutcomes, setBusinessOutcomes] = useState(
    briefData.businessOutcomes
  );
  const [constraints, setConstraints] = useState(briefData.constraints);
  const [stakeholders, setStakeholders] = useState(briefData.stakeholders);
  const [timeline, setTimeline] = useState(briefData.timeline);
  const [budget, setBudget] = useState(briefData.budget);
  const [useCases, setUseCases] = useState<UseCaseForm[]>(
    briefData.useCases.map((uc) => ({
      name: uc.name,
      description: uc.description,
      roiOutcome: uc.roiOutcome,
      valueHypothesis: uc.valueHypothesis,
    }))
  );

  const availablePillarsForSecondary = SOLUTION_PILLARS.filter(
    (p) => p !== primaryPillar && !secondaryPillars.includes(p)
  );

  const handleRemoveSecondaryPillar = (pillar: string) => {
    setSecondaryPillars((prev) => prev.filter((p) => p !== pillar));
  };

  const handleAddSecondaryPillar = (pillar: string) => {
    setSecondaryPillars((prev) => [...prev, pillar]);
  };

  const handleUseCaseChange = (
    index: number,
    field: keyof UseCaseForm,
    value: string
  ) => {
    setUseCases((prev) =>
      prev.map((uc, i) => (i === index ? { ...uc, [field]: value } : uc))
    );
  };

  const handleRemoveUseCase = (index: number) => {
    setUseCases((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddUseCase = () => {
    setUseCases((prev) => [
      ...prev,
      { name: "", description: "", roiOutcome: "", valueHypothesis: "" },
    ]);
  };

  const handleSave = async () => {
    const editedBrief: SalesBrief = {
      companyName: briefData.companyName,
      industry: briefData.industry,
      subsector: briefData.subsector,
      primaryPillar,
      secondaryPillars,
      evidence,
      customerContext,
      businessOutcomes,
      constraints,
      stakeholders,
      timeline,
      budget,
      useCases,
    };
    await onSave(editedBrief);
  };

  return (
    <div className="space-y-4">
      {/* Primary Pillar */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader className="pb-2">
          <span className="text-xs font-medium uppercase tracking-wider text-blue-600">
            Primary Pillar
          </span>
        </CardHeader>
        <CardContent>
          <Select value={primaryPillar} onValueChange={setPrimaryPillar}>
            <SelectTrigger>
              <SelectValue placeholder="Select primary pillar" />
            </SelectTrigger>
            <SelectContent>
              {SOLUTION_PILLARS.map((pillar) => (
                <SelectItem key={pillar} value={pillar}>
                  {pillar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-3 space-y-1">
            <Label htmlFor="evidence">Evidence</Label>
            <Textarea
              id="evidence"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Secondary Pillars */}
      <div className="space-y-2">
        <Label>Secondary Pillars</Label>
        <div className="flex flex-wrap items-center gap-2">
          {secondaryPillars.map((pillar) => (
            <Badge
              key={pillar}
              variant="secondary"
              className="gap-1 bg-slate-100 text-slate-700"
            >
              {pillar}
              <button
                type="button"
                onClick={() => handleRemoveSecondaryPillar(pillar)}
                className="ml-1 cursor-pointer rounded-full hover:bg-slate-300"
                aria-label={`Remove ${pillar}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {availablePillarsForSecondary.length > 0 && (
            <Select onValueChange={handleAddSecondaryPillar}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Add pillar..." />
              </SelectTrigger>
              <SelectContent>
                {availablePillarsForSecondary.map((pillar) => (
                  <SelectItem key={pillar} value={pillar}>
                    {pillar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Context Fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="edit-customerContext">Customer Context</Label>
          <Textarea
            id="edit-customerContext"
            value={customerContext}
            onChange={(e) => setCustomerContext(e.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-businessOutcomes">Business Outcomes</Label>
          <Textarea
            id="edit-businessOutcomes"
            value={businessOutcomes}
            onChange={(e) => setBusinessOutcomes(e.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-constraints">Constraints</Label>
          <Textarea
            id="edit-constraints"
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-stakeholders">Stakeholders</Label>
          <Textarea
            id="edit-stakeholders"
            value={stakeholders}
            onChange={(e) => setStakeholders(e.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-timeline">Timeline</Label>
          <Textarea
            id="edit-timeline"
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-budget">Budget</Label>
          <Textarea
            id="edit-budget"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      {/* Use Cases */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-800">Use Cases</h4>
        {useCases.map((uc, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-sm">
                  Use Case {index + 1}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveUseCase(index)}
                  className="cursor-pointer text-red-500 hover:text-red-700"
                  aria-label={`Remove use case ${index + 1}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={uc.name}
                  onChange={(e) =>
                    handleUseCaseChange(index, "name", e.target.value)
                  }
                  placeholder="Use case name"
                />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea
                  value={uc.description}
                  onChange={(e) =>
                    handleUseCaseChange(index, "description", e.target.value)
                  }
                  rows={2}
                  placeholder="What does this use case entail?"
                />
              </div>
              <div className="space-y-1">
                <Label>ROI Outcome</Label>
                <Input
                  value={uc.roiOutcome}
                  onChange={(e) =>
                    handleUseCaseChange(index, "roiOutcome", e.target.value)
                  }
                  placeholder="Expected ROI outcome"
                />
              </div>
              <div className="space-y-1">
                <Label>Value Hypothesis</Label>
                <Textarea
                  value={uc.valueHypothesis}
                  onChange={(e) =>
                    handleUseCaseChange(
                      index,
                      "valueHypothesis",
                      e.target.value
                    )
                  }
                  rows={2}
                  placeholder="How Lumenalta delivers value"
                />
              </div>
            </CardContent>
          </Card>
        ))}
        <Button
          variant="outline"
          onClick={handleAddUseCase}
          className="w-full cursor-pointer gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Use Case
        </Button>
      </div>

      {/* Save/Cancel buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="min-h-[44px] cursor-pointer gap-2"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
          className="min-h-[44px] cursor-pointer"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
