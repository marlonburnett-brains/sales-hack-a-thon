---
phase: quick-16
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/components/atlusdeck-logo.tsx
  - apps/web/src/app/layout.tsx
  - apps/web/src/app/login/page.tsx
  - apps/web/src/components/sidebar.tsx
  - apps/web/src/app/icon.svg
autonomous: true
requirements: [QUICK-16]
must_haves:
  truths:
    - "All visible UI text reads 'AtlusDeck' instead of 'Lumenalta Sales'"
    - "Purple asterisk logo SVG appears in sidebar, login page, and browser favicon"
    - "No Briefcase icon remains in branding areas"
  artifacts:
    - path: "apps/web/src/components/atlusdeck-logo.tsx"
      provides: "Shared AtlusDeck purple asterisk logo component"
    - path: "apps/web/src/app/icon.svg"
      provides: "SVG favicon for browser tab"
  key_links:
    - from: "apps/web/src/app/login/page.tsx"
      to: "apps/web/src/components/atlusdeck-logo.tsx"
      via: "import AtlusDeckLogo"
      pattern: "import.*AtlusDeckLogo"
    - from: "apps/web/src/components/sidebar.tsx"
      to: "apps/web/src/components/atlusdeck-logo.tsx"
      via: "import AtlusDeckLogo"
      pattern: "import.*AtlusDeckLogo"
---

<objective>
Rename all "Lumenalta Sales" branding to "AtlusDeck" and replace the Briefcase icon with a custom purple asterisk/star logo SVG. Add the logo as the browser favicon.

Purpose: Rebrand the application from internal project name to product name with custom identity.
Output: Updated branding across login, sidebar, metadata, and favicon.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/web/src/app/layout.tsx
@apps/web/src/app/login/page.tsx
@apps/web/src/components/sidebar.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create AtlusDeck logo component and favicon SVG</name>
  <files>apps/web/src/components/atlusdeck-logo.tsx, apps/web/src/app/icon.svg</files>
  <action>
Create a shared React component `AtlusDeckLogo` in `apps/web/src/components/atlusdeck-logo.tsx` that renders an inline SVG of a 6-armed asterisk/star shape in purple (#7C6BF4). The component should accept optional `className` prop for sizing (default to `h-8 w-8`). The SVG should have a 24x24 viewBox with 6 rounded arms radiating from center, each arm a rounded-end stroke or filled capsule shape, creating a starburst/asterisk effect. Use `currentColor` with the component applying `text-[#7C6BF4]` by default so consumers can override color via className. Export as named export.

Also create `apps/web/src/app/icon.svg` with the same asterisk shape in purple (#7C6BF4) for the Next.js app router favicon convention. This file placed in the app directory will automatically be served as the favicon. Use a 32x32 viewBox for the favicon version. Include a purple circular background (#7C6BF4) with the asterisk shape in white for better favicon visibility at small sizes.
  </action>
  <verify>
    <automated>cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20</automated>
  </verify>
  <done>AtlusDeckLogo component exists and type-checks. icon.svg exists in app directory.</done>
</task>

<task type="auto">
  <name>Task 2: Replace all Lumenalta Sales branding with AtlusDeck</name>
  <files>apps/web/src/app/layout.tsx, apps/web/src/app/login/page.tsx, apps/web/src/components/sidebar.tsx</files>
  <action>
**layout.tsx:**
- Change metadata title from "Lumenalta Sales Orchestration" to "AtlusDeck"
- Change metadata description from "Agentic sales orchestration platform" to "Agentic sales orchestration platform" (keep as-is, it is generic enough)

**login/page.tsx:**
- Remove `Briefcase` from lucide-react import (keep other imports intact)
- Import `{ AtlusDeckLogo }` from `@/components/atlusdeck-logo`
- In LoginContent branding section: replace `<Briefcase className="h-8 w-8 text-blue-600" />` with `<AtlusDeckLogo className="h-8 w-8" />`
- Change text "Lumenalta Sales" to "AtlusDeck" in both occurrences (main content + Suspense fallback)
- In Suspense fallback: same replacement -- AtlusDeckLogo instead of Briefcase, "AtlusDeck" instead of "Lumenalta Sales"

**sidebar.tsx:**
- Remove `Briefcase` from the lucide-react import on line 9 (keep it in navItems -- Deals icon still uses Briefcase)
- Actually, Briefcase IS used in navItems for Deals icon on line 28, so keep it in the import
- Import `{ AtlusDeckLogo }` from `@/components/atlusdeck-logo`
- In logo area (line 71): replace `<Briefcase className="h-5 w-5 shrink-0 text-blue-600" />` with `<AtlusDeckLogo className="h-5 w-5 shrink-0" />`
- Change text "Lumenalta Sales" to "AtlusDeck"
  </action>
  <verify>
    <automated>cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20 && grep -r "Lumenalta Sales" src/ && echo "FAIL: old branding found" || echo "PASS: no old branding"</automated>
  </verify>
  <done>All three files updated. No "Lumenalta Sales" text anywhere in src/. Briefcase icon only appears for Deals nav item, not branding. AtlusDeckLogo used in sidebar and login. Favicon served from app/icon.svg.</done>
</task>

</tasks>

<verification>
1. `grep -r "Lumenalta Sales" apps/web/src/` returns no results
2. `grep -r "AtlusDeck" apps/web/src/` shows hits in layout.tsx, login/page.tsx, sidebar.tsx
3. TypeScript compiles without errors: `cd apps/web && npx tsc --noEmit`
4. `apps/web/src/app/icon.svg` exists
5. `apps/web/src/components/atlusdeck-logo.tsx` exists and exports AtlusDeckLogo
</verification>

<success_criteria>
- Zero occurrences of "Lumenalta Sales" in the web app source
- AtlusDeck logo component renders purple asterisk SVG
- Browser favicon shows purple asterisk (via Next.js app router icon.svg convention)
- Sidebar and login page show purple asterisk logo instead of blue Briefcase
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/16-rename-system-to-atlusdeck-and-update-lo/16-SUMMARY.md`
</output>
