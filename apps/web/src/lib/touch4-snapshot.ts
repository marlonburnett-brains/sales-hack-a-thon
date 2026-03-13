import "server-only";

import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

/**
 * Clean a step result to match Mastra's API response format.
 * Removes __state and metadata.nestedRunId fields.
 */
function cleanStepResult(stepResult: Record<string, unknown>) {
  if (!stepResult || typeof stepResult !== "object") return stepResult;
  const { __state: _state, metadata, ...rest } = stepResult;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const { nestedRunId: _nestedRunId, ...userMetadata } =
      metadata as Record<string, unknown>;
    if (Object.keys(userMetadata).length > 0) {
      return { ...rest, metadata: userMetadata };
    }
  }
  return rest;
}

/**
 * Query the mastra_workflow_snapshot table directly for Touch 4 workflow status.
 * Transforms the raw snapshot into the same format as Mastra's GET /workflows/:id/runs/:runId.
 */
export async function getTouch4Snapshot(runId: string) {
  const db = getPool();
  const result = await db.query(
    `SELECT run_id, "resourceId", snapshot, "createdAt", "updatedAt"
     FROM mastra.mastra_workflow_snapshot
     WHERE workflow_name = 'touch-4-workflow' AND run_id = $1
     LIMIT 1`,
    [runId]
  );

  if (result.rows.length === 0) {
    console.error(`[touch4-snapshot] No snapshot found for runId=${runId}`);
    throw new Error("Agent API error (404): Workflow run not found");
  }

  const row = result.rows[0];
  const snapshot = row.snapshot;

  // Transform context into steps (same logic as Mastra's getWorkflowRunById)
  const { input: _input, __state: _topState, ...stepsOnly } =
    (snapshot.context as Record<string, unknown>) || {};
  const steps: Record<string, unknown> = {};
  for (const [stepId, stepResult] of Object.entries(stepsOnly)) {
    steps[stepId] = cleanStepResult(
      stepResult as Record<string, unknown>
    );
  }

  return {
    runId: row.run_id,
    workflowName: "touch-4-workflow",
    resourceId: row.resourceId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    status: snapshot.status,
    result: snapshot.result,
    steps,
  };
}
