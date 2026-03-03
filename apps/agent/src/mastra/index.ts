import { Mastra } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { env } from '../env'

/**
 * Two-database architecture for apps/agent:
 *
 * prisma/mastra.db — Mastra's INTERNAL database
 *   Stores: workflow execution snapshots, suspend/resume state,
 *           message history, traces, and step outputs.
 *   Managed: entirely by Mastra; do NOT add Prisma models here.
 *
 * prisma/dev.db   — APPLICATION-level database
 *   Stores: WorkflowJob records, briefing state, approval state.
 *   Managed: by Prisma migrations (schema.prisma + prisma migrate).
 *
 * Both SQLite files coexist in apps/agent/prisma/ without conflict.
 */
export const mastra = new Mastra({
  storage: new LibSQLStore({
    // LibSQL local file mode — file: prefix is required
    url: 'file:./prisma/mastra.db',
  }),
  server: {
    port: parseInt(env.MASTRA_PORT, 10),
  },
})
