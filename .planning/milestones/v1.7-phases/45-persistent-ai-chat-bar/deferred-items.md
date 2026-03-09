# Deferred Items

## 2026-03-08

- `pnpm --filter web exec tsc --noEmit` still fails on pre-existing, out-of-scope type errors in `apps/web/src/app/(authenticated)/actions/__tests__/actions-client.test.tsx`, `apps/web/src/components/__tests__/template-table.test.tsx`, `apps/web/src/components/settings/__tests__/touch-4-artifact-tabs.test.tsx`, `apps/web/src/components/slide-viewer/__tests__/classification-panel.test.tsx`, `apps/web/src/components/slide-viewer/__tests__/slide-viewer-navigation.test.tsx`, `apps/web/src/lib/__tests__/api-client-google-auth.test.ts`, `apps/web/src/lib/__tests__/api-client.deck-structures.test.ts`, and `apps/web/src/lib/__tests__/template-actions.test.ts`.
