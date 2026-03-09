---
phase: quick-14
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/agent/package.json
  - apps/agent/src/env.ts
  - apps/agent/src/deal-chat/web-research.ts
  - apps/agent/src/deal-chat/assistant.ts
autonomous: true
requirements: [QUICK-14]
must_haves:
  truths:
    - "Seller can ask 'research this client' or 'what does [company] do' and get web-sourced results"
    - "Web research results appear as structured knowledge matches in the existing DealChatMeta response"
    - "Non-research messages continue to work exactly as before (knowledge query, save intent, general context)"
  artifacts:
    - path: "apps/agent/src/deal-chat/web-research.ts"
      provides: "Tavily web search wrapper with company-focused query builder"
      exports: ["searchWeb"]
    - path: "apps/agent/src/deal-chat/assistant.ts"
      provides: "Updated assistant with web research intent detection and routing"
  key_links:
    - from: "apps/agent/src/deal-chat/assistant.ts"
      to: "apps/agent/src/deal-chat/web-research.ts"
      via: "import searchWeb, called when looksLikeWebResearchQuery matches"
      pattern: "searchWeb"
---

<objective>
Add a web research capability to the deal chat assistant so sellers can ask about clients, prospects, or companies and get live web search results inline in the chat.

Purpose: Sellers need to research clients before meetings. Currently the assistant only searches internal knowledge (slides). Adding Tavily web search lets the assistant pull public info about companies, people, industries on demand.

Output: A new `web-research.ts` module and updated intent detection in `assistant.ts` that routes "research this company" queries through Tavily and returns results in the existing DealChatMeta response structure.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/agent/src/deal-chat/assistant.ts
@apps/agent/src/deal-chat/context.ts
@apps/agent/src/env.ts
@apps/agent/package.json

<interfaces>
<!-- Key types the executor needs from the existing codebase -->

From apps/agent/src/deal-chat/assistant.ts:
```typescript
type RunDealChatTurnParams = {
  dealId: string;
  message: string;
  routeContext: DealChatRouteContext;
  transcriptUpload?: DealChatTranscriptUpload | null;
};

type RunDealChatTurnResult = {
  text: string;
  meta: DealChatMeta;
};

// Intent detection pattern — three existing matchers:
function looksLikeKnowledgeQuery(message: string): boolean;
function looksLikeSaveIntent(message: string): boolean;
// General context fallback (else branch)
```

From @lumenalta/schemas (DealChatMeta response shape):
```typescript
// knowledgeMatches array is already used for slide search results.
// Web research results should use the SAME knowledgeMatches structure
// so the UI renders them identically.
type KnowledgeMatch = {
  id: string;
  title: string;
  whyFit: string;
  summary: string;
  sourceLabel: string;
  touchType: string | null;
};
```

From apps/agent/src/env.ts:
```typescript
// Uses @t3-oss/env-core createEnv with z.string() validators
// Optional env vars use .optional() or .default('')
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install Tavily SDK and create web research module</name>
  <files>apps/agent/package.json, apps/agent/src/env.ts, apps/agent/src/deal-chat/web-research.ts</files>
  <action>
1. Install `@tavily/core` in apps/agent: `cd apps/agent && pnpm add @tavily/core`

2. Add `TAVILY_API_KEY` to `apps/agent/src/env.ts` as an optional env var:
   ```
   TAVILY_API_KEY: z.string().min(1).optional(),
   ```
   Optional so the server does not crash if the key is not set — web research just becomes unavailable.

3. Create `apps/agent/src/deal-chat/web-research.ts`:

   - Import `tavily` from `@tavily/core` and `env` from `../env`.
   - Export an `isWebResearchAvailable()` function that returns `Boolean(env.TAVILY_API_KEY)`.
   - Export a `searchWeb(params: { query: string; companyName: string; industry: string; maxResults?: number })` function that:
     a. If `!env.TAVILY_API_KEY`, throws an Error("Web research is not configured — set TAVILY_API_KEY").
     b. Creates a `tavily` client with the API key.
     c. Builds a search query string: `"${params.companyName} ${params.query}"` — prepends company name for context. If the query already contains the company name (case-insensitive), use the query as-is.
     d. Calls `client.search({ query, maxResults: params.maxResults ?? 5, searchDepth: "basic", includeAnswer: true })`.
     e. Returns a typed result: `{ answer: string | null; results: Array<{ title: string; url: string; content: string; score: number }> }`.
     f. Wrap the Tavily call in try/catch — on error, log and return `{ answer: null, results: [] }` so the assistant degrades gracefully.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>web-research.ts exists with searchWeb and isWebResearchAvailable exports, TAVILY_API_KEY is in env.ts as optional, @tavily/core is in package.json dependencies, TypeScript compiles cleanly.</done>
</task>

<task type="auto">
  <name>Task 2: Add web research intent path to deal chat assistant</name>
  <files>apps/agent/src/deal-chat/assistant.ts</files>
  <action>
1. Import `searchWeb` and `isWebResearchAvailable` from `./web-research` at the top of assistant.ts.

2. Add a new intent detector function above `runDealChatTurn`:
   ```typescript
   function looksLikeWebResearchQuery(message: string): boolean {
     return /(research|look up|lookup|find out about|tell me about|what does .+ do|who is|company info|client info|background on|web search|search the web|google)/i.test(message);
   }
   ```
   This should NOT match when looksLikeKnowledgeQuery matches first (knowledge query stays higher priority since it searches internal slides).

3. In `runDealChatTurn`, insert a NEW branch in the if/else chain AFTER `knowledgeQuery` but BEFORE `saveIntent`:
   ```
   if (knowledgeQuery) { ... existing ... }
   else if (isWebResearchAvailable() && looksLikeWebResearchQuery(params.message)) { ... new ... }
   else if (saveIntent) { ... existing ... }
   else { ... existing ... }
   ```

4. The new web research branch should:
   a. Call `searchWeb({ query: params.message, companyName: context.deal.company.name, industry: context.deal.company.industry, maxResults: 5 })`.
   b. Map Tavily results into the existing `knowledgeMatches` array format:
      ```typescript
      knowledgeMatches = webResults.results.slice(0, 3).map((result, index) => ({
        id: `web-${index}`,
        title: result.title,
        whyFit: truncate(result.content, 120),
        summary: truncate(result.content, 160),
        sourceLabel: "Web research",
        touchType: null,
      }));
      ```
   c. Set `directAnswer` to the Tavily `answer` if present, otherwise a summary like `"I found ${knowledgeMatches.length} web results about ${context.deal.company.name}."`.
   d. Set `supportingBullets` from the top results' titles/content.
   e. Set `nextSteps` to helpful follow-ups like "Ask me to save any of these findings as deal notes." and "Refine the search with a more specific question about the client.".

5. Also add a new suggestion to `buildDealChatSuggestions` — add a "Research this client" suggestion:
   ```typescript
   // Only add if web research is available
   if (isWebResearchAvailable()) {
     suggestions.push({
       id: `${routeContext.section}-web-research`,
       label: "Research this client",
       prompt: "Research this client on the web",
       kind: "question",
     });
   }
   ```
   Import `isWebResearchAvailable` is already done in step 1.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>Deal chat assistant detects web research intent, calls Tavily, returns results in the existing DealChatMeta knowledgeMatches format. Non-research messages (knowledge, save, general) are unaffected. A "Research this client" suggestion chip appears when TAVILY_API_KEY is configured.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors: `cd apps/agent && npx tsc --noEmit`
2. Existing intent paths unaffected — `looksLikeKnowledgeQuery` still matches "similar cases" and "examples", `looksLikeSaveIntent` still matches save/note/transcript patterns
3. Web research is gracefully unavailable when TAVILY_API_KEY is not set — `isWebResearchAvailable()` returns false, the branch is skipped, no crashes
4. When TAVILY_API_KEY is set, messages like "research this client" or "what does Acme Corp do" route through the web research path
</verification>

<success_criteria>
- `apps/agent/src/deal-chat/web-research.ts` exists with Tavily integration
- `TAVILY_API_KEY` is an optional env var in `env.ts`
- Deal chat assistant routes web research queries through Tavily and returns results in the existing `knowledgeMatches` response structure
- Non-research chat messages work exactly as before
- The "Research this client" suggestion appears only when Tavily is configured
</success_criteria>

<output>
After completion, create `.planning/quick/14-add-web-research-tool-to-deal-chat-assis/14-SUMMARY.md`
</output>
