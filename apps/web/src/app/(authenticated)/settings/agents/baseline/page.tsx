import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAgentConfigAction } from "@/lib/actions/agent-config-actions";
import { BaselineEditor } from "@/components/settings/baseline-editor";

export default async function BaselinePage() {
  // Fetch any agent config to get the current baseline prompt
  const config = await getAgentConfigAction("company-researcher");
  const baseline = config.publishedVersion?.baselinePrompt ?? "";

  return (
    <div className="space-y-6">
      <Link
        href="/settings/agents"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors duration-150"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Agents
      </Link>
      <h2 className="text-xl font-semibold text-slate-900">
        Edit Shared Baseline
      </h2>
      <BaselineEditor baselinePrompt={baseline} />
    </div>
  );
}
