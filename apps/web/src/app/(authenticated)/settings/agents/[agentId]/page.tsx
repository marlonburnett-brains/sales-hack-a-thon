import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAgentConfigAction, getAgentConfigVersionsAction } from "@/lib/actions/agent-config-actions";
import { AgentDetail } from "@/components/settings/agent-detail";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const [config, versions] = await Promise.all([
    getAgentConfigAction(agentId),
    getAgentConfigVersionsAction(agentId),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/settings/agents"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors duration-150"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Agents
      </Link>
      <AgentDetail config={config} versions={versions} />
    </div>
  );
}
