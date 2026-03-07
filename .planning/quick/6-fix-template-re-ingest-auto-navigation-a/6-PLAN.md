---
phase: quick-6
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/components/template-card.tsx
  - apps/web/src/app/(authenticated)/templates/[id]/slides/page.tsx
  - apps/web/src/app/(authenticated)/templates/[id]/slides/slide-viewer-client.tsx
autonomous: true
requirements: [FIX-NAV, ADD-BREADCRUMBS]
must_haves:
  truths:
    - "Clicking Re-ingest/Ingest/Retry Access/Delete in template card dropdown does NOT navigate to slides page"
    - "Template slides page shows breadcrumbs: Templates > {Template Name}"
    - "Clicking 'Templates' breadcrumb navigates back to /templates"
  artifacts:
    - path: "apps/web/src/components/template-card.tsx"
      provides: "Fixed click propagation on dropdown menu items"
    - path: "apps/web/src/app/(authenticated)/templates/[id]/slides/slide-viewer-client.tsx"
      provides: "Breadcrumb navigation replacing back arrow"
    - path: "apps/web/src/app/(authenticated)/templates/[id]/slides/page.tsx"
      provides: "Empty-state page with breadcrumb navigation"
  key_links:
    - from: "slide-viewer-client.tsx"
      to: "/templates"
      via: "breadcrumb link"
      pattern: "href.*templates"
---

<objective>
Fix two UX issues on the templates feature:

1. **Stop auto-navigation on re-ingest:** When clicking dropdown menu items (Re-ingest, Ingest, Retry Access, Delete) on a template card, the click event propagates to the Card's onClick handler, navigating the user to the slides page. The DropdownMenuTrigger button has `e.stopPropagation()` but the DropdownMenuItem click handlers do not -- the radix dropdown menu renders items in a portal, but the click still bubbles to the card in some cases. The fix: wrap each DropdownMenuItem onClick in a handler that calls `e.stopPropagation()`.

2. **Add breadcrumbs to slides page:** Replace the back-arrow button with a breadcrumb trail "Templates > {Template Name}" so users can navigate back to the templates list.

Purpose: Prevent confusing auto-navigation and improve wayfinding.
Output: Fixed template-card.tsx and updated slides page with breadcrumbs.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/web/src/components/template-card.tsx
@apps/web/src/app/(authenticated)/templates/[id]/slides/slide-viewer-client.tsx
@apps/web/src/app/(authenticated)/templates/[id]/slides/page.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix click propagation on template card dropdown actions</name>
  <files>apps/web/src/components/template-card.tsx</files>
  <action>
In template-card.tsx, the Card component (line 178) has `onClick={() => router.push(...)}` for navigation. The DropdownMenuTrigger has `e.stopPropagation()` but the individual DropdownMenuItem handlers do not prevent propagation.

Fix: Wrap each DropdownMenuItem's onClick to stop propagation. For all four menu items (View Slides, Retry Access, Ingest/Re-ingest, Delete), update their onClick handlers to accept the event and call `e.stopPropagation()` before executing the action:

```tsx
<DropdownMenuItem
  onClick={(e) => {
    e.stopPropagation();
    router.push(`/templates/${template.id}/slides`);
  }}
```

Apply this pattern to ALL DropdownMenuItem components:
1. "View Slides" item (line 198-204)
2. "Retry Access" item (line 206-212)
3. "Ingest/Re-ingest" item (line 214-221)
4. "Delete" item (line 222-229)

Also add stopPropagation to the handleRetryAccess and handleTriggerIngestion calls within the onClick to prevent navigation.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>Clicking any dropdown menu item on a template card does not trigger card-level navigation to the slides page.</done>
</task>

<task type="auto">
  <name>Task 2: Add breadcrumbs to template slides page</name>
  <files>apps/web/src/app/(authenticated)/templates/[id]/slides/slide-viewer-client.tsx, apps/web/src/app/(authenticated)/templates/[id]/slides/page.tsx</files>
  <action>
Replace the back-arrow button in slide-viewer-client.tsx with a breadcrumb trail.

In slide-viewer-client.tsx:
1. Import `ChevronRight` from lucide-react (already imported), and `Link` from `next/link`.
2. Replace the header section (lines 154-170) that contains the ArrowLeft button and template name. Replace with a breadcrumb:

```tsx
<div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
  <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
    <Link
      href="/templates"
      className="text-slate-500 hover:text-slate-900 transition-colors"
    >
      Templates
    </Link>
    <ChevronRight className="h-4 w-4 text-slate-400" />
    <span className="font-semibold text-slate-900 truncate max-w-[300px]">
      {templateName}
    </span>
  </nav>
  <span className="text-xs text-slate-500">
    {currentIndex + 1} of {totalSlides}
  </span>
</div>
```

3. Remove `ArrowLeft` from the lucide-react import if no longer used. Keep `ChevronRight` (already used for next-slide button -- note: the next slide button uses `ChevronRight` so it stays).
4. Remove `Button` import if no longer needed elsewhere -- but Button IS still used for prev/next slide navigation, so keep it.

In page.tsx (empty state):
1. Import `Link` from `next/link` and `ChevronRight` from `lucide-react`.
2. In the empty-state return block (lines 40-47), add a breadcrumb above the empty state message:

```tsx
<div className="space-y-6">
  <nav className="flex items-center gap-1 text-sm px-4 pt-3" aria-label="Breadcrumb">
    <Link
      href="/templates"
      className="text-slate-500 hover:text-slate-900 transition-colors"
    >
      Templates
    </Link>
    <ChevronRight className="h-4 w-4 text-slate-400" />
    <span className="font-semibold text-slate-900">{templateName}</span>
  </nav>
  {/* existing empty state div */}
</div>
```
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>Template slides page shows "Templates > {name}" breadcrumb. Clicking "Templates" navigates to /templates. Works in both populated and empty-state views.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors
2. Navigate to templates list, click Re-ingest on a template card -- should NOT navigate away
3. Click into a template's slides -- breadcrumbs "Templates > {name}" visible at top
4. Click "Templates" in breadcrumb -- navigates back to templates list
</verification>

<success_criteria>
- Dropdown actions (Re-ingest, Ingest, Retry Access, Delete) do not cause navigation to slides page
- Breadcrumb trail "Templates > {Template Name}" appears on slides page
- Breadcrumb "Templates" link navigates to /templates
- Both populated and empty-state slides pages show breadcrumbs
</success_criteria>

<output>
After completion, create `.planning/quick/6-fix-template-re-ingest-auto-navigation-a/6-SUMMARY.md`
</output>
