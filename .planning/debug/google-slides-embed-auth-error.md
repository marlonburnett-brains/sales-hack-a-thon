---
status: awaiting_human_verify
trigger: "Google Slides iframe embed shows auth error instead of rendering presentation"
created: 2026-03-11T00:00:00Z
updated: 2026-03-11T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - shareWithOrg() only grants domain-scoped access (type: "domain", domain: "lumenalta.com"), but iframe embeds need "anyone with the link" (type: "anyone") since the browser has no Google auth context
test: Read drive-folders.ts shareWithOrg function
expecting: Missing type: "anyone" permission
next_action: Add "anyone with the link" reader permission to shareWithOrg and shareNewFile

## Symptoms

expected: Google Slides presentation renders in embedded iframe/preview on the deal touch page
actual: Shows Google auth error page in Portuguese - "Cannot access your Google Account"
errors: No API errors - presentation created and saved to Drive successfully. Embed iframe fails to load.
reproduction: Generate a presentation for a deal touch, view the result page with embedded slides preview
started: Unclear - may have always been this way with embeds

## Eliminated

## Evidence

- timestamp: 2026-03-11T00:01:00Z
  checked: apps/web/src/components/touch/deck-preview.tsx and asset-review-panel.tsx
  found: Frontend uses /embed and /preview Google URLs in iframes - these require the file to be publicly accessible
  implication: The file must have "anyone with the link" sharing for anonymous iframe access

- timestamp: 2026-03-11T00:02:00Z
  checked: apps/agent/src/lib/drive-folders.ts - shareWithOrg() function
  found: Only creates permission with type:"domain", domain:"lumenalta.com", role:"reader". No "anyone" permission.
  implication: ROOT CAUSE - iframe in browser has no Google auth context, so domain-restricted sharing blocks access

- timestamp: 2026-03-11T00:02:30Z
  checked: shareNewFile() in same file
  found: Same issue - only domain + SA user permissions, no "anyone" link sharing
  implication: Both sharing functions need the "anyone" permission added

## Resolution

root_cause: shareWithOrg() and shareNewFile() in drive-folders.ts only grant domain-scoped reader access (type:"domain", domain:"lumenalta.com"). The frontend iframe embeds (DeckPreview and AssetReviewPanel) use /embed and /preview URLs that require the file to be accessible without Google authentication. Since the browser iframe has no Google auth context, the domain-restricted permission causes an auth error page to display.
fix: Add "anyone with the link" reader permission (type:"anyone", role:"reader") to both shareWithOrg() and shareNewFile() functions.
verification: TypeScript compiles without new errors. Tests mock shareWithOrg/shareNewFile so no test changes needed. Awaiting human verification that iframe embeds now load.
files_changed: [apps/agent/src/lib/drive-folders.ts]
