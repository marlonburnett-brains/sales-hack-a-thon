import { listTutorialsAction } from "@/lib/actions/tutorial-actions";
import type { TutorialBrowseResponse } from "@/lib/actions/tutorial-actions";
import { TutorialsBrowseView } from "@/components/tutorials/tutorials-browse-view";

export const dynamic = "force-dynamic";

const EMPTY_DATA: TutorialBrowseResponse = {
  overall: { completedCount: 0, totalCount: 0, completionPercent: 0 },
  categories: [],
};

export default async function TutorialsPage() {
  let data: TutorialBrowseResponse = EMPTY_DATA;

  try {
    data = await listTutorialsAction();
  } catch (err) {
    console.error("[tutorials-page] Failed to fetch tutorials:", err);
  }

  return <TutorialsBrowseView data={data} />;
}
