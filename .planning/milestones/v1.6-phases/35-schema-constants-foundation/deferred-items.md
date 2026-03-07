# Deferred Items

- `apps/agent/src/mastra/index.ts` has pre-existing TypeScript errors in workflow resume and Zod error handling paths (`881`, `895`, `979`, `1163`, `1430`, `1802`).
- `apps/agent/src/lib/mcp-client.ts` and related tests have pre-existing TypeScript failures unrelated to Phase 35 runtime compatibility.
- `packages/schemas/index.ts` and `packages/schemas/llm/slide-metadata.ts` currently fail `tsc` because of `.ts` extension imports outside this plan's scope.
