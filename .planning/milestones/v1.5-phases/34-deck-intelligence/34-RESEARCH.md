# Phase 34: Deck Intelligence - Research

**Researched:** 2026-03-07
**Domain:** AI-powered deck structure inference, settings UI, chat refinement with streaming
**Confidence:** HIGH

## Summary

Phase 34 adds a Settings page with nested sub-navigation, AI-inferred deck structure views per touch type, confidence scoring, and a chat refinement interface with streaming responses. The implementation spans three layers: a new Next.js route group with vertical tab layout, new Prisma models for deck structures and chat history, and new agent endpoints for LLM inference and streaming chat.

The project already has all required UI primitives (Accordion, Tabs, Progress, Card, Badge), an established LLM structured output pattern via Google GenAI, server actions for web-to-agent communication, and a background timer pattern for periodic jobs. The primary new technical challenge is streaming responses from the agent to the web client -- there is no existing streaming infrastructure, and the Vercel AI SDK / useChat is explicitly out of scope. Streaming must be built from primitives using fetch + ReadableStream on the web side and a streaming response from the Hono-based Mastra agent.

**Primary recommendation:** Build deck structure inference as a Mastra-registered API route using Google GenAI structured output (established pattern), store results in new `DeckStructure` and `DeckChatMessage` Prisma models, and implement streaming chat via fetch-based ReadableStream on the web side consuming chunked JSON/text from a Hono streaming response on the agent side.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Settings link added at bottom of sidebar nav list (above collapse button), using a Cog/Settings icon
- Two sub-sections: Deck Structures and Integrations
- Left vertical tabs for sub-navigation (narrow left column with tab links, content fills right side)
- Integrations section shows connection status cards for Google Workspace and AtlusAI
- Collapsible accordion sections, one per touch type (Touch 1-4, Pre-Call), all visible on one scrollable page
- Vertical flow list for section visualization: numbered sections with connecting lines, name, purpose, variation count, mapped reference slide thumbnails
- Confidence score as percentage + example count with progress bar, color-coded green/yellow/red with tooltip
- Fixed bottom bar pinned to Deck Structures content area for chat (Copilot/assistant panel style)
- Chat history persisted per touch type with smart context optimization (summarize/compress resolved topics)
- Streaming responses: AI streams token-by-token, structure updates once full response received
- Inline diff highlights on structure update: green pulse for added, yellow for modified
- Auto-inference with periodic cron job (structure auto-generates when data changes)
- Maximum data utilization: slide descriptions, element maps, classification metadata, position, sequence reasoning
- Examples are primary (drive section flow), templates secondary (expand variation pool)
- Chat history used as system context during re-inference (summarized refinements become constraints)
- Structure should be a self-reinforcing feedback loop

### Claude's Discretion
- Exact LLM prompt engineering for deck structure inference
- Structured output schema design for deck structure data
- Chat context summarization/compression strategy
- Cron job frequency and change detection logic
- Streaming implementation details (SSE vs fetch streaming)
- Empty state treatment for touch types without examples
- Integrations page data fetching and display details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DKI-01 | User can access a Settings page from the main sidebar navigation | Sidebar navItems array modification, new `/settings` route under `(authenticated)` |
| DKI-02 | Settings page has nested side navigation for sub-sections | Vertical tabs layout using existing `@radix-ui/react-tabs` with custom orientation styling |
| DKI-03 | User can view AI-inferred deck structure breakdown for each touch type | New `DeckStructure` Prisma model, Google GenAI structured output for inference, Accordion display |
| DKI-04 | Deck structures show section flow, variations, and reference slides mapped to each section | Structured output schema with sections array containing variation slides, thumbnailUrl from SlideEmbedding |
| DKI-05 | Deck structures show confidence score per touch based on available examples | Count-based confidence calculation from classified example templates, Progress component display |
| DKI-06 | User can refine AI analysis via chat bar (flag issues, add context) | New `DeckChatMessage` model, fixed bottom chat bar component, streaming fetch from agent |
| DKI-07 | AI updates deck structure based on user chat feedback | Agent chat endpoint that re-runs inference with chat context, diff detection for UI highlights |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.x | Settings page routing and server components | Already in use |
| @radix-ui/react-tabs | 1.1.13 | Vertical tabs for settings sub-navigation | Already installed, supports `orientation="vertical"` |
| @radix-ui/react-accordion | 1.2.12 | Touch type collapsible sections | Already installed |
| @radix-ui/react-progress | 1.1.8 | Confidence score progress bars | Already installed |
| @google/genai | 1.43.x | LLM structured output for deck inference | Established pattern in classify-metadata.ts |
| Prisma | 6.3.x (stay on 6.19.x) | New models for deck structures and chat | Established pattern, forward-only migrations |
| lucide-react | 0.576.x | Settings icon (Settings/Cog) | Already in use for all icons |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Card | installed | Integrations status cards, structure section cards | Display containers |
| shadcn/ui Badge | installed | Touch type labels, status indicators | Inline metadata |
| shadcn/ui Skeleton | installed | Loading states for async structure data | Initial load |
| sonner | 2.0.x | Toast notifications for chat/update feedback | User feedback |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fetch streaming | Vercel AI SDK useChat | Explicitly OUT OF SCOPE per REQUIREMENTS.md |
| SSE (EventSource) | Fetch + ReadableStream | Fetch streaming is simpler (no separate protocol), works with Hono, no CORS SSE issues |

**No new installations needed.** All required libraries are already in the project.

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/app/(authenticated)/settings/
├── layout.tsx              # Settings layout with vertical tabs
├── page.tsx                # Redirects to /settings/deck-structures
├── deck-structures/
│   └── page.tsx            # Deck structures server component
└── integrations/
    └── page.tsx            # Integrations status cards

apps/web/src/components/settings/
├── deck-structure-view.tsx      # Main deck structures client component
├── touch-type-accordion.tsx     # Per-touch-type accordion item
├── section-flow.tsx             # Vertical flow list visualization
├── confidence-badge.tsx         # Color-coded confidence display
├── chat-bar.tsx                 # Fixed bottom chat input + messages
└── integrations-status.tsx      # Connection status cards

apps/web/src/lib/actions/
└── deck-structure-actions.ts    # Server actions for deck structure CRUD + chat

apps/agent/src/deck-intelligence/
├── infer-deck-structure.ts      # LLM inference logic
├── deck-structure-schema.ts     # Structured output schema definition
└── chat-refinement.ts           # Chat processing + re-inference

apps/agent/src/mastra/index.ts   # New registerApiRoute entries
```

### Pattern 1: Settings Layout with Vertical Tabs
**What:** Use Next.js nested layouts with a shared settings layout containing vertical tab navigation. Each sub-section is a separate route segment.
**When to use:** Settings pages with multiple sub-sections.
**Example:**
```typescript
// apps/web/src/app/(authenticated)/settings/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Plug } from "lucide-react";

const settingsTabs = [
  { href: "/settings/deck-structures", label: "Deck Structures", icon: Layers },
  { href: "/settings/integrations", label: "Integrations", icon: Plug },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-6">
      <nav className="w-48 shrink-0 space-y-1 border-r border-slate-200 pr-4">
        {settingsTabs.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
              pathname.startsWith(href)
                ? "bg-slate-100 font-medium text-slate-900"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
```

### Pattern 2: Streaming Chat from Agent (Fetch + ReadableStream)
**What:** The agent returns a streaming response (text chunks) via Hono's `c.stream()` or `c.streamText()`. The web client consumes it with `fetch` + `ReadableStream` reader, appending tokens as they arrive.
**When to use:** Chat refinement endpoint where token-by-token display is needed.
**Example:**
```typescript
// Web client side - consuming stream
async function streamChat(
  touchType: string,
  message: string,
  onToken: (token: string) => void,
  onDone: (fullResponse: string) => void,
) {
  const res = await fetch("/api/deck-structures/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ touchType, message }),
  });

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    onToken(chunk);
  }

  onDone(fullText);
}
```

```typescript
// Agent side - Hono streaming response
import { stream } from "hono/streaming";

registerApiRoute("/deck-structures/chat", {
  POST: async (c) => {
    const { touchType, message, chatHistory } = await c.req.json();
    // ... process with LLM ...
    return stream(c, async (s) => {
      for await (const chunk of llmStream) {
        await s.write(chunk.text);
      }
    });
  },
});
```

### Pattern 3: Deck Structure Data Model
**What:** Store AI-inferred deck structures as JSON in a Prisma model with per-touch-type records.
**When to use:** Persisting inference results for display and chat refinement.
**Example:**
```typescript
// Prisma schema addition
model DeckStructure {
  id              String   @id @default(cuid())
  touchType       String   @unique // "touch_1" | "touch_2" | "touch_3" | "touch_4" | "pre_call"
  structureJson   String   // JSON: { sections: [...], metadata: {...} }
  exampleCount    Int      @default(0) // Number of examples used for inference
  confidence      Float    @default(0) // 0-100 confidence score
  chatContextJson String?  // Summarized chat constraints for re-inference
  inferredAt      DateTime @default(now())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  chatMessages    DeckChatMessage[]

  @@index([touchType])
}

model DeckChatMessage {
  id              String        @id @default(cuid())
  deckStructureId String
  deckStructure   DeckStructure @relation(fields: [deckStructureId], references: [id], onDelete: Cascade)
  role            String        // "user" | "assistant"
  content         String        // Message text
  structureDiff   String?       // JSON diff of structure changes (if assistant message caused updates)
  createdAt       DateTime      @default(now())

  @@index([deckStructureId])
}
```

### Pattern 4: Structured Output Schema for Deck Inference
**What:** Use Google GenAI `responseSchema` to get structured deck structure from the LLM.
**When to use:** Deck structure inference endpoint.
**Example:**
```typescript
const DECK_STRUCTURE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    sections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          order: { type: Type.NUMBER, description: "Position in deck flow (1-based)" },
          name: { type: Type.STRING, description: "Section name (e.g., 'Company Overview')" },
          purpose: { type: Type.STRING, description: "Why this section exists in the deck" },
          isOptional: { type: Type.BOOLEAN, description: "Whether this section is always present" },
          variationCount: { type: Type.NUMBER, description: "Number of slide variations available" },
          slideIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "SlideEmbedding IDs that map to this section",
          },
        },
        required: ["order", "name", "purpose", "isOptional"],
      },
    },
    sequenceRationale: {
      type: Type.STRING,
      description: "Explanation of why sections are in this order",
    },
  },
  required: ["sections", "sequenceRationale"],
};
```

### Anti-Patterns to Avoid
- **Sending full chat history to LLM every time:** Implement summarization. After N messages or when topics are resolved, compress old context into a summary constraint string stored in `chatContextJson`.
- **Blocking UI on inference:** Inference can take 10-30 seconds with many examples. Show loading state, never block the whole page.
- **Storing structure as separate DB rows per section:** Use JSON column. The structure is always read/written as a unit, and the LLM returns it as a single object.
- **Running inference on every single data change:** Use change detection (hash of example IDs + classification data) to skip no-op re-inferences.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vertical tab navigation | Custom tab state management | Next.js nested routes + pathname matching | URL-driven tabs get browser back/forward for free |
| JSON streaming from Hono | Custom chunked encoding | `hono/streaming` module with `stream()` or `streamText()` | Handles backpressure, connection cleanup, error propagation |
| Accordion with animation | Custom collapsible with height transitions | `@radix-ui/react-accordion` (already installed) | Handles a11y, keyboard nav, animation timing |
| Progress bar with color | Custom div with width percentage | `@radix-ui/react-progress` + Tailwind color classes | Handles a11y attributes, smooth transitions |
| Structured LLM output parsing | Manual JSON extraction from text | Google GenAI `responseSchema` | Guarantees valid JSON matching schema (established pattern) |

**Key insight:** Every UI primitive needed is already installed. The only new code is the domain-specific deck structure logic and the streaming chat bridge.

## Common Pitfalls

### Pitfall 1: Streaming Response CORS/Proxy Issues
**What goes wrong:** The web app calls the agent directly for streaming, but the agent runs on a different port/host, causing CORS issues or Next.js middleware interfering.
**Why it happens:** Server actions can't stream. Direct browser-to-agent fetch bypasses Next.js auth.
**How to avoid:** Create a Next.js API route (`/api/deck-structures/chat/route.ts`) that proxies the stream from the agent. The route handler fetches from the agent and pipes the ReadableStream back to the client. This keeps auth in Next.js land.
**Warning signs:** CORS errors in browser console, or streaming works in dev but fails in production.

### Pitfall 2: Chat Context Window Explosion
**What goes wrong:** After many refinement messages, the full chat history exceeds the LLM context window or makes responses slow/expensive.
**Why it happens:** Naive approach appends all messages as system context.
**How to avoid:** Implement a rolling summarization strategy. After every 5-10 messages, summarize resolved topics into a "constraints" string. Only send the constraints string + last 3-5 messages to the LLM. Store the summary in `chatContextJson` on the DeckStructure model.
**Warning signs:** Increasing response times, token limit errors from Google GenAI.

### Pitfall 3: Race Condition Between Cron Re-inference and User Chat
**What goes wrong:** Cron job triggers re-inference while user is actively chatting, overwriting structure that user just refined.
**Why it happens:** No locking or coordination between background inference and interactive refinement.
**How to avoid:** Use `chatContextJson` as constraints during cron re-inference (already a locked decision). Additionally, skip cron re-inference for a touch type if there are chat messages within the last 30 minutes (active session protection). Or use a simple `lastChatAt` timestamp on `DeckStructure`.
**Warning signs:** User reports their refinements being lost after a few minutes.

### Pitfall 4: Empty State Confusion
**What goes wrong:** Touch types with zero classified examples show empty/broken deck structure UI.
**Why it happens:** No examples means no inference data to display.
**How to avoid:** Show a clear empty state per accordion: "No examples classified for Touch 2 yet. Classify presentations as examples and assign touch types on the Templates page to enable AI inference." with a link to Templates. Disable chat bar for empty touch types.
**Warning signs:** Users confused about why some touch types have no data.

### Pitfall 5: Prisma Migration vs Existing Data
**What goes wrong:** Migration fails or data is lost due to drift between migration history and actual DB.
**Why it happens:** Project has a known pattern of migration history drift (see STATE.md decision about forward-only migrations).
**How to avoid:** Per CLAUDE.md: use `prisma migrate dev --name add-deck-structure-models`, never `db push`, never `migrate reset`. Use `--create-only` to inspect SQL first. If drift occurs, create a baseline migration and mark as applied.
**Warning signs:** Migration errors referencing tables that already exist.

## Code Examples

### Sidebar Settings Link Addition
```typescript
// Add to navItems array in sidebar.tsx, before the bottom section
// Position: after "Action Required" item but visually at bottom above collapse
import { Settings } from "lucide-react";

// In the nav section, add Settings as a separate bottom-pinned link
// (not in the main navItems array, but rendered separately above the collapse button)
```

### Confidence Score Calculation
```typescript
// Confidence based on example count per touch type
function calculateConfidence(exampleCount: number): {
  score: number;
  color: "green" | "yellow" | "red";
  label: string;
} {
  // Thresholds: <3 examples = low, 3-5 = medium, 6+ = high
  if (exampleCount >= 6) {
    return { score: Math.min(95, 50 + exampleCount * 7), color: "green", label: "High confidence" };
  }
  if (exampleCount >= 3) {
    return { score: 50 + exampleCount * 5, color: "yellow", label: "Medium confidence" };
  }
  if (exampleCount >= 1) {
    return { score: 20 + exampleCount * 10, color: "red", label: "Low confidence" };
  }
  return { score: 0, color: "red", label: "No examples" };
}
```

### Next.js API Route for Streaming Proxy
```typescript
// apps/web/src/app/(authenticated)/api/deck-structures/chat/route.ts
import { env } from "@/env";

export async function POST(request: Request) {
  const body = await request.json();

  const agentRes = await fetch(
    `${env.AGENT_SERVICE_URL}/api/deck-structures/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.AGENT_API_KEY}`,
      },
      body: JSON.stringify(body),
    }
  );

  // Pipe the streaming response through
  return new Response(agentRes.body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
```

### Google GenAI Streaming for Chat
```typescript
// Agent side - streaming LLM response
import { GoogleGenAI } from "@google/genai";

async function* streamChatResponse(
  prompt: string,
  ai: GoogleGenAI,
): AsyncGenerator<string> {
  const response = await ai.models.generateContentStream({
    model: "gemini-2.0-flash",
    contents: prompt,
  });

  for await (const chunk of response) {
    const text = chunk.text;
    if (text) yield text;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| useChat (Vercel AI SDK) | Fetch + ReadableStream primitives | Project decision | Must build chat streaming from scratch; more control, more code |
| SSE (EventSource) | Fetch streaming | Modern browsers | Simpler, no separate protocol, works natively with Hono |
| Store structure in relational tables | JSON column in Prisma | Project pattern | Matches existing classificationJson pattern on SlideEmbedding |

**Deprecated/outdated:**
- Vercel AI SDK / useChat: Explicitly out of scope per REQUIREMENTS.md (incompatible with Mastra Hono architecture)

## Open Questions

1. **Google GenAI streaming API availability**
   - What we know: `generateContentStream` exists in the `@google/genai` package and returns an async iterable
   - What's unclear: Whether it works seamlessly with Vertex AI mode (project uses `vertexai: true`)
   - Recommendation: Test early in implementation. If streaming doesn't work with Vertex AI, fall back to non-streaming response and simulate streaming on the client with progressive text reveal.

2. **Hono streaming in Mastra context**
   - What we know: Hono supports `stream()` and `streamText()` helpers. Mastra uses Hono under the hood.
   - What's unclear: Whether `registerApiRoute` handlers have access to Hono's streaming context (`c.stream()`)
   - Recommendation: If `registerApiRoute` doesn't expose streaming, register a raw Hono route on the Mastra server instance instead. Test this in Wave 0.

3. **Optimal chat summarization trigger**
   - What we know: Need to summarize/compress resolved topics
   - What's unclear: Best heuristic for when to trigger summarization (message count? token estimate? topic resolution detection?)
   - Recommendation: Start simple -- summarize after every 6 messages. Each summarization call compresses the full history into a constraints string. More sophisticated triggers can be added later.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.x |
| Config file | `apps/web/vitest.config.ts` (web), `apps/agent/vitest.config.ts` (agent) |
| Quick run command | `cd apps/web && npx vitest run --reporter=verbose` |
| Full suite command | `cd apps/web && npx vitest run && cd ../agent && npx vitest run` |

### Phase Requirements - Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DKI-01 | Settings link in sidebar | unit | `cd apps/web && npx vitest run src/components/__tests__/sidebar-settings.test.tsx -x` | No - Wave 0 |
| DKI-02 | Settings sub-navigation | unit | `cd apps/web && npx vitest run src/app/(authenticated)/settings/__tests__/settings-layout.test.tsx -x` | No - Wave 0 |
| DKI-03 | Deck structure display per touch type | unit | `cd apps/web && npx vitest run src/components/settings/__tests__/deck-structure-view.test.tsx -x` | No - Wave 0 |
| DKI-04 | Section flow with variations and reference slides | unit | `cd apps/web && npx vitest run src/components/settings/__tests__/section-flow.test.tsx -x` | No - Wave 0 |
| DKI-05 | Confidence score display | unit | `cd apps/web && npx vitest run src/components/settings/__tests__/confidence-badge.test.tsx -x` | No - Wave 0 |
| DKI-06 | Chat bar input and message display | unit | `cd apps/web && npx vitest run src/components/settings/__tests__/chat-bar.test.tsx -x` | No - Wave 0 |
| DKI-07 | Structure updates from chat feedback | integration | `cd apps/agent && npx vitest run src/deck-intelligence/__tests__/chat-refinement.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/web && npx vitest run --reporter=verbose`
- **Per wave merge:** Full suite across both apps
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/src/components/settings/__tests__/` -- test directory for all settings components
- [ ] `apps/agent/src/deck-intelligence/__tests__/` -- test directory for inference and chat logic
- [ ] No new framework installs needed (Vitest already configured in both apps)

## Sources

### Primary (HIGH confidence)
- Project codebase: `apps/agent/src/ingestion/classify-metadata.ts` -- established Google GenAI structured output pattern
- Project codebase: `apps/agent/src/ingestion/auto-classify-templates.ts` -- established cron/timer pattern
- Project codebase: `apps/web/src/components/sidebar.tsx` -- current sidebar structure
- Project codebase: `apps/agent/prisma/schema.prisma` -- current data model
- Project codebase: `apps/web/src/lib/api-client.ts` -- web-to-agent fetch pattern
- Project codebase: `apps/web/src/lib/actions/template-actions.ts` -- server actions pattern
- REQUIREMENTS.md: Vercel AI SDK explicitly out of scope
- CONTEXT.md: All locked decisions

### Secondary (MEDIUM confidence)
- Hono streaming docs: `stream()` and `streamText()` helpers exist in `hono/streaming`
- Google GenAI: `generateContentStream` available for streaming responses

### Tertiary (LOW confidence)
- Vertex AI streaming compatibility with `@google/genai` in streaming mode -- needs validation in implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and patterns established in codebase
- Architecture: HIGH -- follows existing project patterns (server actions, registerApiRoute, Prisma models)
- Pitfalls: HIGH -- derived from analyzing actual codebase patterns and known project constraints
- Streaming: MEDIUM -- Hono streaming and Google GenAI streaming are well-documented but untested in this specific Mastra context

**Research date:** 2026-03-07
**Valid until:** 2026-03-21 (14 days -- stable stack, primary risk is streaming integration details)
