---
phase: 13-implement-ui-for-visualizing-and-deletin
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/agent/src/mastra/index.ts
  - apps/web/src/lib/api-client.ts
  - apps/web/src/lib/actions/deck-structure-actions.ts
  - apps/web/src/components/settings/touch-type-detail-view.tsx
  - apps/web/src/components/settings/chat-bar.tsx
  - apps/web/src/app/api/deck-structures/memories/route.ts
  - apps/web/src/app/api/deck-structures/messages/route.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "User can see the accumulated chatContext summary for a deck structure"
    - "User can see chat message history with per-message delete buttons"
    - "User can delete a single chat message and see it removed from the list"
    - "User can clear all memories (chatContext + all messages) and see the panel reset"
  artifacts:
    - path: "apps/agent/src/mastra/index.ts"
      provides: "DELETE /deck-structures/:touchType/memories and DELETE /deck-structures/:touchType/messages/:messageId endpoints"
      contains: "DELETE"
    - path: "apps/web/src/components/settings/touch-type-detail-view.tsx"
      provides: "Memory panel UI with chatContext display and clear all button"
      contains: "chatContext"
    - path: "apps/web/src/components/settings/chat-bar.tsx"
      provides: "Per-message delete buttons on chat messages"
      contains: "deleteDeckMessage"
  key_links:
    - from: "apps/web/src/components/settings/touch-type-detail-view.tsx"
      to: "apps/web/src/lib/actions/deck-structure-actions.ts"
      via: "deleteDeckMemoriesAction call"
      pattern: "deleteDeckMemoriesAction"
    - from: "apps/web/src/components/settings/chat-bar.tsx"
      to: "apps/web/src/lib/actions/deck-structure-actions.ts"
      via: "deleteDeckMessageAction call"
      pattern: "deleteDeckMessageAction"
    - from: "apps/web/src/app/api/deck-structures/memories/route.ts"
      to: "agent /deck-structures/:touchType/memories"
      via: "fetch proxy"
      pattern: "fetch.*deck-structures.*memories"
---

<objective>
Add backend endpoints and frontend UI for visualizing and managing deck structure memories (chatContextJson summaries and DeckChatMessage history). Users can view accumulated AI context, delete individual messages, and clear all memories to reset the conversation state.

Purpose: Give users visibility and control over the persistent memory that influences deck structure inference, enabling them to reset when the AI has accumulated incorrect or outdated constraints.

Output: Two new agent DELETE endpoints, Next.js proxy routes, updated API client + server actions, memory panel in TouchTypeDetailView, and per-message delete buttons in ChatBar.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/agent/src/mastra/index.ts (lines 2534-2844 — deck structure routes, registerApiRoute pattern, deckStructureArtifactQuerySchema)
@apps/agent/prisma/schema.prisma (lines 331-361 — DeckStructure + DeckChatMessage models)
@apps/web/src/lib/api-client.ts (lines 925-993 — DeckStructureDetail, DeckChatMessageData interfaces, fetchJSON helper)
@apps/web/src/lib/actions/deck-structure-actions.ts (full file — server action pattern)
@apps/web/src/components/settings/touch-type-detail-view.tsx (full file — current layout with sections + chat bar)
@apps/web/src/components/settings/chat-bar.tsx (full file — message rendering + streaming)
@apps/web/src/app/api/deck-structures/chat/route.ts (full file — Next.js proxy pattern to agent)

<interfaces>
<!-- Key types the executor needs -->

From apps/web/src/lib/api-client.ts:
```typescript
export interface DeckStructureDetail {
  touchType: string;
  artifactType?: ArtifactType | null;
  structure: { sections: DeckSectionData[]; sequenceRationale: string };
  exampleCount: number;
  confidence: number;
  confidenceColor: "green" | "yellow" | "red";
  confidenceLabel: string;
  chatMessages: DeckChatMessageData[];
  slideIdToThumbnail: Record<string, string>;
  inferredAt: string | null;
  lastChatAt: string | null;
}

export interface DeckChatMessageData {
  id: string;
  deckStructureId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

// fetchJSON helper signature:
export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T>
```

From apps/agent/src/mastra/index.ts:
```typescript
// Route registration pattern:
registerApiRoute("/deck-structures/:touchType", { method: "GET", handler: async (c) => { ... } })

// Query param parsing:
const query = deckStructureArtifactQuerySchema.parse(c.req.query());
// deckStructureArtifactQuerySchema = z.object({ artifactType: z.string().optional() })

// Key resolution:
const key = resolveDeckStructureKey(touchType, query.artifactType ?? null);
// Returns { touchType: string, artifactType: string | null }
```

From apps/web/src/app/api/deck-structures/chat/route.ts:
```typescript
// Next.js proxy pattern to agent:
const agentUrl = `${env.AGENT_SERVICE_URL}/deck-structures/${encodeURIComponent(...)}/chat${suffix}`;
const agentRes = await fetch(agentUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.AGENT_API_KEY}` },
  body: JSON.stringify({ ... }),
});
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add agent DELETE endpoints and expose chatContext in GET response</name>
  <files>apps/agent/src/mastra/index.ts</files>
  <action>
  Make three changes to apps/agent/src/mastra/index.ts:

  **1. Add `chatContext` to the GET /deck-structures/:touchType response (around line 2687-2699):**
  In the existing GET detail handler, after parsing `structure` from `structureJson`, also parse `chatContextJson`:
  ```typescript
  let chatContext: unknown = null;
  if (record.chatContextJson) {
    try { chatContext = JSON.parse(record.chatContextJson); } catch { chatContext = null; }
  }
  ```
  Add `chatContext` to the response object alongside the existing fields. Also add it to the empty/no-record response branches (as `chatContext: null`).

  **2. Add DELETE /deck-structures/:touchType/memories endpoint:**
  Register a new route BEFORE the closing `],` of the server routes array (before line 2844). Follow the exact same pattern as the other deck structure routes:
  - Method: DELETE
  - Parse touchType param and artifactType query using `deckStructureArtifactQuerySchema` and `resolveDeckStructureKey`
  - Find the DeckStructure record by touchType + artifactType
  - If not found, return 404 `{ error: "Deck structure not found" }`
  - Use a Prisma transaction to: (a) delete all DeckChatMessage records where `deckStructureId` matches, (b) update the DeckStructure setting `chatContextJson: null` and `lastChatAt: null`
  - Return the updated structure detail (re-fetch with chatMessages included, same shape as GET response)

  **3. Add DELETE /deck-structures/:touchType/messages/:messageId endpoint:**
  Register another route after the memories route:
  - Method: DELETE
  - Parse touchType param (for consistency/auth context) and messageId from path
  - Delete the DeckChatMessage by id using `prisma.deckChatMessage.delete({ where: { id: messageId } })`
  - Wrap in try/catch — if Prisma throws P2025 (record not found), return 404
  - Return `{ success: true }`
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit --project apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>GET /deck-structures/:touchType returns chatContext field. DELETE /deck-structures/:touchType/memories clears chatContextJson and all messages. DELETE /deck-structures/:touchType/messages/:messageId deletes a single message. All three compile without errors.</done>
</task>

<task type="auto">
  <name>Task 2: Add API client functions, server actions, Next.js proxy routes, and update DeckStructureDetail interface</name>
  <files>
    apps/web/src/lib/api-client.ts
    apps/web/src/lib/actions/deck-structure-actions.ts
    apps/web/src/app/api/deck-structures/memories/route.ts
    apps/web/src/app/api/deck-structures/messages/route.ts
  </files>
  <action>
  **1. Update DeckStructureDetail interface in api-client.ts:**
  Add `chatContext: unknown;` field to the `DeckStructureDetail` interface (after `chatMessages`).

  **2. Add two new API client functions in api-client.ts (after the existing `triggerDeckInference` function):**

  ```typescript
  export async function deleteDeckMemories(
    touchType: string,
    artifactType?: ArtifactType | null,
  ): Promise<DeckStructureDetail> {
    const query = new URLSearchParams();
    if (artifactType) query.set("artifactType", artifactType);
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return fetchJSON<DeckStructureDetail>(
      `/deck-structures/${encodeURIComponent(touchType)}/memories${suffix}`,
      { method: "DELETE" },
    );
  }

  export async function deleteDeckMessage(
    touchType: string,
    messageId: string,
    artifactType?: ArtifactType | null,
  ): Promise<{ success: boolean }> {
    const query = new URLSearchParams();
    if (artifactType) query.set("artifactType", artifactType);
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return fetchJSON<{ success: boolean }>(
      `/deck-structures/${encodeURIComponent(touchType)}/messages/${encodeURIComponent(messageId)}${suffix}`,
      { method: "DELETE" },
    );
  }
  ```

  **3. Add two new server actions in deck-structure-actions.ts:**
  Import `deleteDeckMemories` and `deleteDeckMessage` from api-client. Add:
  - `deleteDeckMemoriesAction(touchType, artifactType?)` — calls `deleteDeckMemories`, returns `DeckStructureDetail`
  - `deleteDeckMessageAction(touchType, messageId, artifactType?)` — calls `deleteDeckMessage`, returns `{ success: boolean }`

  **4. Create Next.js proxy route: apps/web/src/app/api/deck-structures/memories/route.ts:**
  Follow the exact pattern from the chat proxy route. Create a DELETE handler that:
  - Parses `touchType` and optional `artifactType` from request JSON body
  - Validates touchType is non-empty
  - Builds agent URL: `${env.AGENT_SERVICE_URL}/deck-structures/${encodeURIComponent(touchType)}/memories${suffix}`
  - Proxies the DELETE request with Authorization header
  - Returns the JSON response

  **5. Create Next.js proxy route: apps/web/src/app/api/deck-structures/messages/route.ts:**
  Same pattern. DELETE handler that:
  - Parses `touchType`, `messageId`, and optional `artifactType` from request JSON body
  - Validates both are non-empty
  - Builds agent URL: `${env.AGENT_SERVICE_URL}/deck-structures/${encodeURIComponent(touchType)}/messages/${encodeURIComponent(messageId)}${suffix}`
  - Proxies the DELETE request with Authorization header
  - Returns the JSON response

  IMPORTANT: The api-client `fetchJSON` helper already handles the proxy routing through Next.js API routes. Check if `fetchJSON` for DELETE methods goes through a proxy or directly to the agent. Looking at the chat route, the frontend ChatBar calls `/api/deck-structures/chat` (Next.js route) which proxies to the agent. However, `fetchJSON` in api-client.ts likely calls the agent directly via `AGENT_SERVICE_URL`. Check how `fetchJSON` is configured — if it calls the agent directly with the API key, then the Next.js proxy routes are NOT needed and should be skipped. The server actions calling `deleteDeckMemories`/`deleteDeckMessage` via `fetchJSON` will handle it server-side.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>DeckStructureDetail has chatContext field. deleteDeckMemories and deleteDeckMessage functions exist in api-client. Server actions wrap them. Proxy routes exist if needed (or skipped if fetchJSON handles agent calls directly). All compile without errors.</done>
</task>

<task type="auto">
  <name>Task 3: Add memory panel UI to TouchTypeDetailView and per-message delete buttons to ChatBar</name>
  <files>
    apps/web/src/components/settings/touch-type-detail-view.tsx
    apps/web/src/components/settings/chat-bar.tsx
  </files>
  <action>
  **1. Update TouchTypeDetailView (touch-type-detail-view.tsx):**

  Add imports: `Brain, Trash2, ChevronDown, ChevronRight` from lucide-react, `deleteDeckMemoriesAction` from actions, and `useState` (already imported).

  Add state: `const [memoriesOpen, setMemoriesOpen] = useState(false);` and `const [clearingMemories, setClearingMemories] = useState(false);`

  Add a `handleClearMemories` callback that:
  - Sets `setClearingMemories(true)`
  - Calls `deleteDeckMemoriesAction(touchType, artifactType)`
  - On success, calls `loadData()` to refresh all data
  - Finally sets `setClearingMemories(false)`

  Add a "Memories" collapsible section between the sequence rationale and the chat bar (in the `hasData` return block, around line 202-205). The section should be:

  ```tsx
  {/* Memory panel */}
  <div className="mt-6 rounded-lg border border-slate-200">
    <button
      onClick={() => setMemoriesOpen(!memoriesOpen)}
      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      <Brain className="h-4 w-4 text-purple-500" />
      <span>Conversation Memory</span>
      {structure.chatContext && (
        <span className="ml-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-600">Active</span>
      )}
      <span className="ml-auto">
        {memoriesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </span>
    </button>

    {memoriesOpen && (
      <div className="border-t border-slate-200 px-4 py-3 space-y-4">
        {/* Chat context summary */}
        {structure.chatContext ? (
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">Accumulated Context</h4>
            <div className="rounded-md bg-purple-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
              {typeof structure.chatContext === 'string'
                ? structure.chatContext
                : JSON.stringify(structure.chatContext, null, 2)}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">No accumulated context yet. Chat with the AI to build up memory.</p>
        )}

        {/* Message count + clear all */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {structure.chatMessages.length} message{structure.chatMessages.length !== 1 ? 's' : ''} stored
          </span>
          {(structure.chatContext || structure.chatMessages.length > 0) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleClearMemories()}
              disabled={clearingMemories}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {clearingMemories ? 'Clearing...' : 'Clear All Memories'}
            </Button>
          )}
        </div>
      </div>
    )}
  </div>
  ```

  Also add the same memory panel in the `!hasData` return block (before the disabled chat), but simplified — only show it if there's chatContext or messages (which would be unusual but possible if data was cleared partially).

  **2. Update ChatBar (chat-bar.tsx):**

  Add props to ChatBarProps interface:
  ```typescript
  onDeleteMessage?: (messageId: string) => Promise<void>;
  messageIds?: Record<number, string>; // map from message index to database ID
  ```

  Wait -- the ChatBar already receives `initialMessages` which are `DeckChatMessageData[]` with `id` fields. Instead of a separate messageIds prop, update the `LocalMessage` interface to include an optional `id` field:
  ```typescript
  interface LocalMessage {
    id?: string; // database ID, present for persisted messages
    role: "user" | "assistant";
    content: string;
    createdAt: string;
  }
  ```

  Update the `useEffect` that loads `initialMessages` to preserve the `id`:
  ```typescript
  setMessages(initialMessages.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })));
  ```

  Add a new prop: `onDeleteMessage?: (messageId: string) => Promise<void>;`

  In the message rendering (around line 204-216), add a delete button for each message that has an `id`:
  ```tsx
  {messages.map((msg, idx) => (
    <div key={msg.id ?? idx} className={cn("group relative rounded-lg p-3 text-sm", ...)}>
      {msg.content}
      {msg.id && onDeleteMessage && (
        <button
          onClick={() => void onDeleteMessage(msg.id!)}
          className="absolute -right-1 -top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200 group-hover:flex"
          aria-label="Delete message"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  ))}
  ```

  Import `X` from lucide-react.

  **3. Wire up delete in TouchTypeDetailView:**

  Add a `handleDeleteMessage` callback:
  ```typescript
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    await deleteDeckMessageAction(touchType, messageId, artifactType);
    await loadData(); // refresh to get updated message list
  }, [touchType, artifactType, loadData]);
  ```

  Import `deleteDeckMessageAction` from actions.

  Pass `onDeleteMessage={handleDeleteMessage}` to both ChatBar instances in the component.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>Memory panel appears in TouchTypeDetailView with collapsible section showing chatContext and message count. Per-message delete buttons appear on hover in ChatBar. "Clear All Memories" button calls the delete endpoint and refreshes. All TypeScript compiles cleanly.</done>
</task>

</tasks>

<verification>
1. TypeScript compilation passes for both apps/agent and apps/web
2. Start the agent dev server and verify:
   - GET /deck-structures/:touchType returns `chatContext` field
   - DELETE /deck-structures/:touchType/memories returns 200 and clears data
   - DELETE /deck-structures/:touchType/messages/:id returns 200
3. Load a deck structure detail page in the browser:
   - Memory panel section visible with Brain icon
   - Expanding shows chatContext (if any) and message count
   - Hovering a chat message shows delete button
   - Clicking delete removes the message
   - "Clear All Memories" resets both context and messages
</verification>

<success_criteria>
- chatContext is visible in the UI when accumulated context exists
- Individual messages can be deleted with immediate UI feedback
- "Clear All Memories" clears both chatContextJson and all DeckChatMessage records
- Page refreshes data after any delete operation
- No TypeScript compilation errors
</success_criteria>

<output>
After completion, create `.planning/quick/13-implement-ui-for-visualizing-and-deletin/13-SUMMARY.md`
</output>
