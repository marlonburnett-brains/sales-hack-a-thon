import { DeckStructureView } from "@/components/settings/deck-structure-view";

export default function DeckStructuresPage() {
  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">
        Deck Structures
      </h2>
      <p className="mb-6 text-sm text-slate-500">
        AI-inferred section patterns for each touch type, based on classified
        examples.
      </p>
      <DeckStructureView />
    </div>
  );
}
