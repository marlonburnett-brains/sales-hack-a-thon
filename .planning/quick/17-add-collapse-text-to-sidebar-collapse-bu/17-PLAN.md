---
phase: quick-17
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/components/sidebar.tsx
  - apps/web/src/components/user-nav.tsx
  - apps/web/src/components/__tests__/sidebar.test.tsx
autonomous: true
requirements: [QUICK-17]

must_haves:
  truths:
    - "Collapse button shows 'Collapse' text label next to icon when sidebar is expanded"
    - "Collapse button shows icon-only when sidebar is collapsed"
    - "User name and email display inline next to avatar when sidebar is expanded"
    - "User name and email are hidden when sidebar is collapsed"
    - "Dropdown menu still opens on avatar click with Connect Google and Sign out options"
  artifacts:
    - path: "apps/web/src/components/sidebar.tsx"
      provides: "Collapse button with text label, passes collapsed prop to UserNav"
    - path: "apps/web/src/components/user-nav.tsx"
      provides: "Inline name/email display when expanded, avatar-only when collapsed"
  key_links:
    - from: "apps/web/src/components/sidebar.tsx"
      to: "apps/web/src/components/user-nav.tsx"
      via: "collapsed prop"
      pattern: "collapsed.*UserNav"
---

<objective>
Add "Collapse" text label to the sidebar collapse button and show the user's name and email inline next to the avatar when the sidebar is expanded. This fills the awkward gap in the bottom section and makes it consistent with how other items (Settings, nav links) show text labels.

Purpose: Improve sidebar bottom section UX by eliminating dead space and surfacing user identity without requiring a click.
Output: Updated sidebar.tsx and user-nav.tsx with inline text when expanded.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/web/src/components/sidebar.tsx
@apps/web/src/components/user-nav.tsx
@apps/web/src/components/__tests__/sidebar.test.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Collapse text to toggle button and pass collapsed prop to UserNav</name>
  <files>apps/web/src/components/sidebar.tsx</files>
  <action>
In sidebar.tsx, modify the collapse/expand button (lines 132-142):

1. Change the button from icon-only to icon+text when expanded, matching the Settings link pattern:
   - Add `items-center gap-3` to match nav item styling
   - When NOT collapsed: show PanelLeftClose icon + "Collapse" text span
   - When collapsed: show PanelLeft icon only (no text), add title="Expand" tooltip
   - Style the button to match Settings link: `flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900`
   - Keep `md:flex` hidden on mobile, keep cursor-pointer and focus-visible styles

2. Pass `collapsed` prop to UserNav:
   - Change `<UserNav user={user} />` to `<UserNav user={user} collapsed={collapsed} />`

3. Remove the `mb-3` margin from the collapse button since the text label makes spacing more natural. Use `mb-2` to match the Settings link spacing above it.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx vitest run apps/web/src/components/__tests__/sidebar.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>Collapse button shows "Collapse" text when expanded, icon-only when collapsed. UserNav receives collapsed prop.</done>
</task>

<task type="auto">
  <name>Task 2: Show user name and email inline next to avatar when expanded</name>
  <files>apps/web/src/components/user-nav.tsx</files>
  <action>
In user-nav.tsx:

1. Update UserNavProps interface to accept optional `collapsed` boolean:
   ```
   interface UserNavProps {
     user: { name: string; email: string; avatarUrl: string };
     collapsed?: boolean;
   }
   ```

2. Destructure collapsed from props: `export function UserNav({ user, collapsed }: UserNavProps)`

3. Restructure the DropdownMenuTrigger button layout:
   - Wrap the trigger content in a flex container: `flex items-center gap-3`
   - Avatar stays as-is (h-8 w-8 with GoogleTokenBadge)
   - When NOT collapsed, add a div next to avatar containing:
     - User name: `<p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>`
     - User email: `<p className="text-xs text-slate-500 truncate">{user.email}</p>`
   - The outer button needs updated styling: remove fixed `h-8 w-8` sizing, add `w-full text-left` when expanded
   - Keep the rounded-full focus ring on the button

4. The trigger button styling when expanded:
   ```
   className={`flex items-center gap-3 rounded-md px-1 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${collapsed ? "" : "w-full hover:bg-slate-50"}`}
   ```

5. Since name/email now show inline, remove the DropdownMenuLabel block (lines 43-50 containing name/email) and its following DropdownMenuSeparator from the dropdown content. The dropdown should only contain: Connect Google item, separator, Sign out item.

6. Ensure max-width on the name/email container so text truncates properly in the 240px sidebar: `<div className="min-w-0 flex-1">` (min-w-0 enables truncation in flex).
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx vitest run apps/web/src/components/__tests__/sidebar.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>User name and email display inline next to avatar when sidebar expanded. Hidden when collapsed. Dropdown still works for Connect Google and Sign out.</done>
</task>

<task type="auto">
  <name>Task 3: Update sidebar tests for new behavior</name>
  <files>apps/web/src/components/__tests__/sidebar.test.tsx</files>
  <action>
Update the UserNav mock in sidebar.test.tsx to accept the collapsed prop and render name/email conditionally:

1. Update the UserNav mock (line 21-23):
   ```
   UserNav: ({ user, collapsed }: { user: { name: string; email: string }; collapsed?: boolean }) => (
     <div data-testid="user-nav">
       {user.name}
       {!collapsed && <span data-testid="user-info">{user.name} {user.email}</span>}
     </div>
   ),
   ```

2. Add test in NAV-02 describe block: "shows Collapse text label when sidebar is expanded"
   - Render sidebar (default expanded)
   - Find desktop sidebar, query for text "Collapse" within the collapse button area
   - Assert text is present

3. Add test: "hides Collapse text when sidebar is collapsed"
   - Set localStorage collapsed=true
   - Render sidebar
   - Assert "Collapse" text is NOT visible in desktop sidebar (button has title="Expand" instead)

4. Add test: "shows user info inline when sidebar is expanded"
   - Render sidebar (default expanded)
   - Assert user-info test id is present in desktop sidebar

5. Add test: "hides user info when sidebar is collapsed"
   - Set localStorage collapsed=true
   - Render sidebar
   - Assert user-info test id is NOT present in desktop sidebar
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx vitest run apps/web/src/components/__tests__/sidebar.test.tsx --reporter=verbose 2>&1 | tail -40</automated>
  </verify>
  <done>All existing sidebar tests pass. New tests verify collapse text label and inline user info behavior in both expanded and collapsed states.</done>
</task>

</tasks>

<verification>
- All sidebar tests pass: `npx vitest run apps/web/src/components/__tests__/sidebar.test.tsx`
- Dev server renders correctly: `npm run dev` in apps/web, check sidebar at localhost:3000
- Expanded state: Settings (icon+text), Collapse (icon+text), Avatar + Name + Email at bottom
- Collapsed state: Settings (icon only), Collapse (icon only), Avatar only
- Dropdown menu still works: click avatar, see Connect Google and Sign out
</verification>

<success_criteria>
- Collapse button displays "Collapse" text next to icon when expanded, icon-only when collapsed
- User name and email appear inline next to avatar when sidebar is expanded
- User name and email hidden when sidebar is collapsed
- Dropdown menu retains Connect Google and Sign out functionality
- All existing and new sidebar tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/17-add-collapse-text-to-sidebar-collapse-bu/17-SUMMARY.md`
</output>
