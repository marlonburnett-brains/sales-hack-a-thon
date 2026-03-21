# Phase 74: Feedback System - Research

**Researched:** 2026-03-20
**Domain:** React client components, Next.js server actions, Hono API routes, shadcn/ui Tabs + Textarea
**Confidence:** HIGH

## Summary

Phase 74 implements a `FeedbackWidget` React client component that renders a segmented control (shadcn/ui `Tabs`) and a free-text `Textarea`. The widget posts to a new agent API endpoint via a Next.js server action, persisting rows in the already-existing `AppFeedback` Prisma model. All dependencies (shadcn/ui components, Sonner toast, `agentFetch` pattern) are already installed and in active use in the codebase — zero new npm packages are required.

The codebase already has strong precedent for every pattern required: `tutorial-actions.ts` defines the `agentFetch` helper (auth, base URL, error throwing); `stage-approval-bar.tsx` demonstrates the async-button-with-Loader2-spinner pattern; Sonner is imported directly from `"sonner"` across multiple client components; `tutorial-video-player.tsx` shows the full client component structure including `useState`/`useRef`.

The only genuinely new infrastructure is a single `POST /feedback` route in `apps/agent/src/mastra/index.ts`, registered via `registerApiRoute`. All other pieces are composition of existing patterns.

**Primary recommendation:** Implement in two tasks — (1) agent POST route + server action, (2) FeedbackWidget component + slug page integration.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Widget placement: below the prev/next navigation buttons, separated by a horizontal divider and a "Leave feedback" section heading
- Segmented control: shadcn/ui `Tabs`/`TabsList`/`TabsTrigger` — no new component
- Post-submission UX: toast.success("Thanks for your feedback!") + form resets; toast.error("Failed to submit feedback. Please try again.") + form stays populated
- Submit button: Loader2 spinner + "Submitting..." label, disables during async call (StageApprovalBar pattern)
- Validation: comment required (1+ char); 500 char soft limit with live counter; submit disables if limit exceeded
- Default tab: "Tutorial feedback"
- Tab resets to "Tutorial feedback" after form reset
- Component path: `apps/web/src/components/feedback/FeedbackWidget.tsx`
- Server action path: `apps/web/src/lib/actions/feedback-actions.ts`, function name `submitFeedbackAction`
- Documentation: JSDoc comments on the props interface (sourceType, sourceId, default feedbackType)

### Claude's Discretion
- Exact textarea height (rows)
- Exact toast duration
- Whether the character counter appears only when text is entered or always
- Exact styling of the divider and section heading

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FEED-01 | Reusable FeedbackWidget component with segmented control (Tutorial feedback / Feature feedback) and free-text textarea | shadcn/ui Tabs + Textarea components confirmed present; client component pattern confirmed; JSDoc documentation pattern established |
| FEED-02 | FeedbackWidget attached to tutorial player page, keyed per tutorial | slug page (`/tutorials/[slug]/page.tsx`) confirmed; `key={tutorialId}` pattern documented; tutorial.id available from `listTutorialsAction()` response |
| FEED-04 | Feedback system documented for future extension to other pages | JSDoc on props interface (`sourceType`, `sourceId`, feedbackType) is the locked documentation approach; component placed in dedicated `feedback/` folder |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui Tabs | installed | Segmented control (Tutorial feedback / Feature feedback) | Already in `apps/web/src/components/ui/tabs.tsx` |
| shadcn/ui Textarea | installed | Free-text comment input | Already in `apps/web/src/components/ui/textarea.tsx` |
| shadcn/ui Button | installed | Submit button with disabled state | Already in `apps/web/src/components/ui/button.tsx` |
| Lucide `Loader2` | installed | Spinner icon during async call | Used in `stage-approval-bar.tsx` |
| Sonner | installed | `toast.success()` / `toast.error()` | `Toaster` mounted in `apps/web/src/app/layout.tsx`; imported as `import { toast } from "sonner"` |
| Prisma `AppFeedback` model | created (Phase 71) | Target table for feedback inserts | `id`, `sourceType`, `sourceId`, `feedbackType`, `comment`, `userId`, `createdAt` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | installed | Body validation in agent POST route | Mirror the `z.object({...}).parse(body)` pattern from Phase 73 routes |
| `getVerifiedUserId` | internal | Auth check in agent route | Same auth helper used in all existing tutorial routes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn/ui Tabs | shadcn/ui ToggleGroup | Tabs is already confirmed locked decision; ToggleGroup was mentioned in State.md as a Phase 72 consideration but never installed |

**Installation:**
```bash
# No new packages needed — all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/
├── agent/src/mastra/index.ts          # Add POST /feedback route (registerApiRoute)
└── web/src/
    ├── components/feedback/
    │   └── FeedbackWidget.tsx          # New reusable client component
    ├── lib/actions/
    │   └── feedback-actions.ts         # New server action (submitFeedbackAction)
    └── app/(authenticated)/tutorials/
        └── [slug]/page.tsx             # Add <FeedbackWidget key={tutorialId} .../>
```

### Pattern 1: agentFetch Server Action
**What:** Next.js server action that calls the agent via the `agentFetch` helper, handling auth tokens and error propagation.
**When to use:** All mutations that write to the DB via the agent API.
**Example:**
```typescript
// Source: apps/web/src/lib/actions/tutorial-actions.ts (verified, line 11-30)
"use server";

async function agentFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) throw new Error("Not authenticated");

  const response = await fetch(`${env.AGENT_SERVICE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Agent API error (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function submitFeedbackAction(payload: {
  sourceType: string;
  sourceId: string;
  feedbackType: string;
  comment: string;
}): Promise<void> {
  await agentFetch("/feedback", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
```

### Pattern 2: registerApiRoute POST Route
**What:** Hono-based API route registered in `apps/agent/src/mastra/index.ts` using `registerApiRoute`.
**When to use:** Every agent API endpoint. All tutorial progress routes follow this pattern exactly.
**Example:**
```typescript
// Source: apps/agent/src/mastra/index.ts (verified, lines 4274-4315)
registerApiRoute("/feedback", {
  method: "POST",
  handler: async (c) => {
    const userId = await getVerifiedUserId(c, env.SUPABASE_URL);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const parsed = z.object({
      sourceType: z.string(),
      sourceId: z.string(),
      feedbackType: z.enum(["tutorial_feedback", "feature_feedback"]),
      comment: z.string().min(1).max(500),
    }).parse(body);

    await prisma.appFeedback.create({
      data: { ...parsed, userId },
    });

    return c.json({ ok: true });
  },
}),
```

### Pattern 3: Async Button with Loader2 Spinner
**What:** `useState` for `isSubmitting`, disable the button during async operation, show spinner icon + label change.
**When to use:** Any user-triggered async operation.
**Example:**
```typescript
// Source: apps/web/src/components/touch/stage-approval-bar.tsx (verified, lines 120-131)
<Button
  disabled={isSubmitting}
  className="cursor-pointer gap-2"
  onClick={handleSubmit}
>
  {isSubmitting ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" />
      Submitting...
    </>
  ) : (
    "Submit feedback"
  )}
</Button>
```

### Pattern 4: FeedbackWidget Client Component Shape
**What:** Client component with `sourceType`/`sourceId` props, `useState` for tab, comment, character count, and submitting state.
**When to use:** The canonical shape the planner should produce.
**Example:**
```typescript
// Design based on locked decisions from CONTEXT.md
"use client";

/**
 * FeedbackWidget — reusable feedback form component.
 *
 * @param sourceType - The entity type this feedback is attached to (e.g. "tutorial").
 *   Extend by passing a new string value; the AppFeedback table stores it verbatim.
 * @param sourceId - The database ID of the entity (not a slug). For tutorials, use tutorial.id.
 * @param defaultFeedbackType - Optional. Defaults to "tutorial_feedback".
 *   Pass "feature_feedback" to pre-select the feature tab on pages where that is more relevant.
 */
export interface FeedbackWidgetProps {
  sourceType: string;
  sourceId: string;
  defaultFeedbackType?: "tutorial_feedback" | "feature_feedback";
}
```

### Pattern 5: key={tutorialId} State Reset
**What:** React's `key` prop causes the component to fully unmount and remount when the key value changes, resetting all internal state automatically.
**When to use:** When a stateful component must reset on navigation between different entity pages (tutorial A → tutorial B).
**Example:**
```tsx
// Source: CONTEXT.md specifics section (design decision)
// In apps/web/src/app/(authenticated)/tutorials/[slug]/page.tsx:
<FeedbackWidget
  key={tutorial.id}
  sourceType="tutorial"
  sourceId={tutorial.id}
/>
```

### Anti-Patterns to Avoid
- **Using `prisma db push`:** CLAUDE.md prohibits it. The AppFeedback table was created in Phase 71 via forward-only migration — no schema change is needed for this phase.
- **`revalidatePath` after feedback submit:** CONTEXT.md explicitly notes this is not needed (feedback submission doesn't affect any server-rendered list).
- **Calling the agent with `GOOGLE_SERVICE_ACCOUNT_KEY`:** All agent calls use Supabase access token via `agentFetch`. No GCS interaction in this phase.
- **Building a custom toast system:** Sonner is already wired; import `toast` from `"sonner"` directly.
- **Storing feedbackType as anything other than the two enum values:** The Prisma model stores strings; Zod validation in the route should enforce `z.enum(["tutorial_feedback", "feature_feedback"])`.
- **Using tutorial slug as sourceId:** The CONTEXT.md is explicit: `sourceId` = tutorial's DB id, not slug.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast state + DOM manipulation | `toast` from `"sonner"` | Already configured globally via `Toaster` in layout.tsx |
| Segmented control / radio tabs | Custom tab toggle with CSS | shadcn/ui `Tabs`/`TabsList`/`TabsTrigger` | Already installed; consistent with app patterns |
| Auth token injection | Manual header construction | `agentFetch` helper (copy from tutorial-actions.ts) | Handles Supabase token retrieval, base URL, error extraction |
| Character counting state | DOM measurement | Simple `comment.length` against `MAX_CHARS = 500` constant | Pure derived value, no library needed |

**Key insight:** The entire widget is composition of already-installed primitives. The only novel code is the agent POST route and the component wiring logic.

## Common Pitfalls

### Pitfall 1: sourceId as Slug Instead of DB ID
**What goes wrong:** Widget submits `tutorial.slug` as `sourceId`, making future lookups by ID impossible.
**Why it happens:** Slug is visible in the URL and easy to grab; ID requires checking the tutorial data object.
**How to avoid:** Always pass `tutorial.id` (the cuid string from Prisma) to `sourceId`.
**Warning signs:** `sourceId` values look like `"getting-started-welcome"` instead of `"clxyz123..."`.

### Pitfall 2: Forgetting `key={tutorialId}` on the Widget
**What goes wrong:** Navigating from tutorial A to tutorial B leaves the form in whatever state it was in (partially typed comment, wrong tab selected).
**Why it happens:** React re-renders the same component instance on slug-to-slug navigation; state persists.
**How to avoid:** Apply `key={tutorial.id}` on the `<FeedbackWidget>` in the slug page server component.
**Warning signs:** Form textarea retains previous text when the URL changes to a new tutorial.

### Pitfall 3: Allowing Empty or Over-Limit Submission
**What goes wrong:** Empty comment or 500+ char comment reaches the server and either fails Zod validation (returning a 400) or writes a bad record.
**Why it happens:** Frontend disabled state is bypassed by prop mutation or server action called directly.
**How to avoid:** Enforce in both places — disable the submit button when `comment.trim().length === 0 || comment.length > 500`, AND validate in the Zod schema in the agent route.
**Warning signs:** Agent logs show 400 errors from the feedback endpoint.

### Pitfall 4: Not Keeping Form Populated on Error
**What goes wrong:** On server action failure, the form resets, and the user loses their comment.
**Why it happens:** Catch block calls `setComment("")` in addition to showing the error toast.
**How to avoid:** On error, only call `setIsSubmitting(false)` and `toast.error(...)`. Never clear the textarea on failure.
**Warning signs:** User complains they have to retype their feedback after a network error.

### Pitfall 5: Placing the POST Route Outside the `routes` Array
**What goes wrong:** The new `registerApiRoute("/feedback", ...)` call is placed after `]);` of the Mastra config, causing a runtime error or route not being registered.
**Why it happens:** `apps/agent/src/mastra/index.ts` is a large file (4300+ lines); the tutorial routes are at lines 4271-4315 just before the closing `],` of the routes array.
**How to avoid:** Insert the new route adjacent to the existing tutorial routes (after the `/tutorials/:id/watched` route, before `],`).
**Warning signs:** `POST /feedback` returns 404.

## Code Examples

Verified patterns from official sources:

### AppFeedback Prisma Model (already created)
```typescript
// Source: apps/agent/prisma/schema.prisma (verified, lines 570-581)
model AppFeedback {
  id           String   @id @default(cuid())
  sourceType   String   // "tutorial" or future extensible values
  sourceId     String   // Tutorial ID or other entity ID
  feedbackType String   // "tutorial_feedback" | "feature_feedback"
  comment      String
  userId       String?  // Nullable for anonymous
  createdAt    DateTime @default(now())

  @@index([sourceType, sourceId])
  @@index([userId])
}
```

### Sonner Toast Import Pattern
```typescript
// Source: apps/web/src/app/(authenticated)/settings/drive/page.tsx (verified, line 4)
import { toast } from "sonner";

// Usage:
toast.success("Thanks for your feedback!");
toast.error("Failed to submit feedback. Please try again.");
```

### Tabs Component Import Pattern
```typescript
// Source: apps/web/src/components/ui/tabs.tsx (confirmed present)
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
```

### Tutorial ID Available on Slug Page
```typescript
// Source: apps/web/src/app/(authenticated)/tutorials/[slug]/page.tsx (verified, line 48)
const tutorial = allTutorials[currentIndex];
// tutorial.id is the cuid — use as sourceId
// tutorial.slug is the URL segment — do NOT use as sourceId
```

### registerApiRoute Signature (Phase 73 pattern)
```typescript
// Source: apps/agent/src/mastra/index.ts (verified, lines 4295-4315)
registerApiRoute("/tutorials/:id/watched", {
  method: "PATCH",
  handler: async (c) => {
    const userId = await getVerifiedUserId(c, env.SUPABASE_URL);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    const body = await c.req.json();
    const parsed = z.object({ lastPosition: z.number() }).parse(body);
    // ... prisma upsert ...
    return c.json({ ok: true });
  },
}),
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom toast state + modal | Sonner toast library | Phase 72+ | No setup needed; just import `toast` |
| Separate watched/progress fetch | Single viewsMap in GET /tutorials | Phase 73-01 | No change needed for feedback |

**Deprecated/outdated:**
- `prisma db push`: Prohibited by CLAUDE.md. All schema changes via `prisma migrate dev`. AppFeedback was created in Phase 71 — no migration work needed in Phase 74.

## Open Questions

1. **Does `prisma.appFeedback` (camelCase) work or should it be `prisma.AppFeedback`?**
   - What we know: Prisma generates the client accessor in camelCase by default (`prisma.appFeedback`)
   - What's unclear: Whether there's a `@@map` directive on the model — the schema shows none
   - Recommendation: Use `prisma.appFeedback.create(...)` — standard Prisma camelCase convention

2. **Should the character counter always show or only when text is entered?**
   - What we know: CONTEXT.md marks this as Claude's Discretion
   - What's unclear: Nothing blocking — either choice is valid
   - Recommendation: Show counter only when `comment.length > 0` to reduce visual noise when the form is empty

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `cd apps/web && npx vitest run src/components/feedback` |
| Full suite command | `cd apps/web && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FEED-01 | FeedbackWidget renders segmented control with two tabs | unit | `cd apps/web && npx vitest run src/components/feedback/FeedbackWidget.test.tsx` | Wave 0 |
| FEED-01 | Submit button disabled when comment is empty | unit | `cd apps/web && npx vitest run src/components/feedback/FeedbackWidget.test.tsx` | Wave 0 |
| FEED-01 | Submit button disabled when comment exceeds 500 chars | unit | `cd apps/web && npx vitest run src/components/feedback/FeedbackWidget.test.tsx` | Wave 0 |
| FEED-01 | Character counter reflects current comment length | unit | `cd apps/web && npx vitest run src/components/feedback/FeedbackWidget.test.tsx` | Wave 0 |
| FEED-01 | Submit calls submitFeedbackAction with correct args | unit | `cd apps/web && npx vitest run src/components/feedback/FeedbackWidget.test.tsx` | Wave 0 |
| FEED-01 | On success: toast.success called + form resets | unit | `cd apps/web && npx vitest run src/components/feedback/FeedbackWidget.test.tsx` | Wave 0 |
| FEED-01 | On failure: toast.error called + form stays populated | unit | `cd apps/web && npx vitest run src/components/feedback/FeedbackWidget.test.tsx` | Wave 0 |
| FEED-02 | FeedbackWidget rendered on slug page (smoke) | manual-only | N/A — server component integration; verify in browser | N/A |
| FEED-04 | JSDoc on FeedbackWidgetProps interface | manual-only | Code review — verify JSDoc present on sourceType, sourceId props | N/A |

### Sampling Rate
- **Per task commit:** `cd apps/web && npx vitest run src/components/feedback`
- **Per wave merge:** `cd apps/web && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/src/components/feedback/FeedbackWidget.test.tsx` — covers FEED-01 (all 7 unit cases above)
- [ ] `apps/web/src/lib/actions/__tests__/feedback-actions.test.ts` — optional but recommended for action smoke test

*(All existing test infrastructure is in place; only the new test file for FeedbackWidget is missing.)*

## Sources

### Primary (HIGH confidence)
- `apps/web/src/lib/actions/tutorial-actions.ts` — `agentFetch` helper implementation (lines 11-30)
- `apps/web/src/components/touch/stage-approval-bar.tsx` — Loader2 spinner + async button pattern
- `apps/agent/src/mastra/index.ts` — `registerApiRoute` usage, Phase 73 tutorial routes (lines 4271-4315)
- `apps/agent/prisma/schema.prisma` — AppFeedback model (lines 570-581)
- `apps/web/src/app/(authenticated)/tutorials/[slug]/page.tsx` — slug page structure, `tutorial.id` availability
- `apps/web/src/components/tutorials/tutorial-video-player.tsx` — client component pattern, prev/next nav placement
- `apps/web/src/app/layout.tsx` — Toaster confirmed mounted (line 3)
- `.planning/phases/74-feedback-system/74-CONTEXT.md` — locked design decisions

### Secondary (MEDIUM confidence)
- Multiple `apps/web/src/app/**/*.tsx` files confirming `import { toast } from "sonner"` pattern
- `apps/web/vitest.config.ts` — test framework configuration

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components verified present in codebase
- Architecture: HIGH — `registerApiRoute`, `agentFetch`, and `key={id}` patterns all verified from existing production code
- Pitfalls: HIGH — sourceId/slug confusion and missing `key` prop are confirmed by CONTEXT.md specifics; route placement confirmed by reading index.ts structure

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable dependencies)
