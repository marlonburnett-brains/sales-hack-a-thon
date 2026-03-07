import { IntegrationsStatus } from "@/components/settings/integrations-status";

export default function IntegrationsPage() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Integrations
      </h2>
      <p className="mb-6 text-sm text-slate-500">
        Manage external service connections.
      </p>
      <IntegrationsStatus />
    </div>
  );
}
