---
phase: quick-14
plan: 01
subsystem: agent
tags: [tavily, web-search, deal-chat, intent-detection]

requires:
  - phase: 45
    provides: deal chat assistant with intent routing and DealChatMeta response structure
provides:
  - Tavily web search integration for deal chat assistant
  - Web research intent detection in deal chat turn routing
  - "Research this client" suggestion chip when TAVILY_API_KEY configured
affects: [deal-chat, agent-config]

tech-stack:
  added: ["@tavily/core"]
  patterns: [optional-feature-flag-via-env, graceful-degradation-on-missing-api-key]

key-files:
  created:
    - apps/agent/src/deal-chat/web-research.ts
  modified:
    - apps/agent/src/env.ts
    - apps/agent/src/deal-chat/assistant.ts
    - apps/agent/package.json

key-decisions:
  - "TAVILY_API_KEY is optional so the server never crashes if unset -- web research simply becomes unavailable"
  - "Web research results reuse the existing knowledgeMatches response structure so the UI renders them without changes"

patterns-established:
  - "Optional feature gate: isWebResearchAvailable() checks env at runtime, branch skipped when false"

requirements-completed: [QUICK-14]

duration: 3min
completed: 2026-03-09
---

# Quick Task 14: Add Web Research Tool to Deal Chat Assistant Summary

**Tavily web search integration in deal chat with intent detection, graceful degradation, and existing knowledgeMatches response reuse**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T02:10:16Z
- **Completed:** 2026-03-09T02:13:02Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Tavily SDK installed and web-research.ts module created with searchWeb and isWebResearchAvailable exports
- Deal chat assistant now detects web research intent and routes through Tavily, returning results in the existing knowledgeMatches format
- "Research this client" suggestion chip appears only when TAVILY_API_KEY is configured
- Graceful degradation: missing API key skips the branch, failed searches return empty results

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Tavily SDK and create web research module** - `ff1dabc` (feat)
2. **Task 2: Add web research intent path to deal chat assistant** - `b3729b9` (feat)

## Files Created/Modified
- `apps/agent/src/deal-chat/web-research.ts` - Tavily web search wrapper with company-focused query builder
- `apps/agent/src/env.ts` - Added TAVILY_API_KEY as optional env var
- `apps/agent/src/deal-chat/assistant.ts` - Added web research intent detection, routing, and suggestion chip
- `apps/agent/package.json` - Added @tavily/core dependency

## Decisions Made
- TAVILY_API_KEY is optional so the server never crashes if unset -- web research simply becomes unavailable
- Web research results reuse the existing knowledgeMatches response structure so the UI renders them without any frontend changes
- Web research intent checked after knowledge query but before save intent to maintain existing priority order

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

To enable web research, add `TAVILY_API_KEY` to `apps/agent/.env`:
```
TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
Get a key at https://tavily.com. Without it, the feature is silently disabled.

## Next Phase Readiness
- Web research is fully functional when TAVILY_API_KEY is set
- No frontend changes needed -- results render through existing knowledgeMatches UI

---
*Quick Task: 14-add-web-research-tool-to-deal-chat-assis*
*Completed: 2026-03-09*
