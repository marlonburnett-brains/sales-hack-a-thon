import { getAgentConfigsAction } from "@/lib/actions/agent-config-actions";
import { AgentList } from "@/components/settings/agent-list";

export default async function AgentsPage() {
  const agents = await getAgentConfigsAction();

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Agents</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage agent system prompts, versions, and publishing.
        </p>
      </div>

      <AgentList agents={agents} />
    </div>
  );
}
