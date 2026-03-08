"use client";

import Link from "next/link";
import { Settings2 } from "lucide-react";
import type { AgentConfigListItem } from "@/lib/actions/agent-config-actions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const FAMILY_DISPLAY_NAMES: Record<string, string> = {
  "pre-call": "Pre-Call",
  "touch-1": "Touch 1",
  "touch-4": "Touch 4",
  "deck-selection": "Deck Selection",
  "deck-intelligence": "Deck Intelligence",
  ingestion: "Ingestion",
  "knowledge-extraction": "Knowledge Extraction",
  validation: "Validation",
};

const FAMILY_ORDER = [
  "pre-call",
  "touch-1",
  "deck-selection",
  "touch-4",
  "deck-intelligence",
  "ingestion",
  "knowledge-extraction",
  "validation",
];

interface AgentListProps {
  agents: AgentConfigListItem[];
}

export function AgentList({ agents }: AgentListProps) {
  // Group agents by family
  const grouped = new Map<string, AgentConfigListItem[]>();
  for (const agent of agents) {
    const family = agent.family;
    if (!grouped.has(family)) {
      grouped.set(family, []);
    }
    grouped.get(family)!.push(agent);
  }

  // Order families
  const orderedFamilies = FAMILY_ORDER.filter((f) => grouped.has(f));
  // Add any families not in the predefined order
  for (const key of grouped.keys()) {
    if (!orderedFamilies.includes(key)) {
      orderedFamilies.push(key);
    }
  }

  return (
    <div className="space-y-6">
      {/* Shared Baseline Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Shared Baseline Prompt</CardTitle>
            <CardDescription className="mt-1">
              The baseline prompt is prepended to every agent&apos;s role prompt.
              Changes affect all 19 agents.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/agents/baseline">
              <Settings2 className="mr-1.5 h-3.5 w-3.5" />
              Edit Baseline
            </Link>
          </Button>
        </CardHeader>
      </Card>

      {/* Agent List grouped by family */}
      <Accordion
        type="multiple"
        defaultValue={orderedFamilies}
        className="space-y-0"
      >
        {orderedFamilies.map((family) => {
          const familyAgents = grouped.get(family) ?? [];
          const displayName =
            FAMILY_DISPLAY_NAMES[family] ?? family;

          return (
            <AccordionItem key={family} value={family}>
              <AccordionTrigger className="hover:no-underline">
                <span className="text-sm font-medium text-slate-700">
                  {displayName}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    ({familyAgents.length})
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="space-y-0.5">
                  {familyAgents.map((agent) => (
                    <Link
                      key={agent.agentId}
                      href={`/settings/agents/${agent.agentId}`}
                      className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-150 hover:bg-slate-50 cursor-pointer group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 group-hover:text-slate-700">
                            {agent.name}
                          </span>
                          {agent.publishedVersion !== null && (
                            <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                              v{agent.publishedVersion}
                            </span>
                          )}
                          {agent.hasDraft && (
                            <Badge className="border-transparent bg-amber-100 text-amber-800 hover:bg-amber-100 shadow-none text-[10px] px-1.5 py-0">
                              Draft
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                          {agent.responsibility}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
