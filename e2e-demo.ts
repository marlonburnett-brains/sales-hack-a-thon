/**
 * E2E Demo Script — Simplified, state-machine approach
 * For each touch: navigate, detect state, take action, repeat until done.
 */
import { chromium, type Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE_URL = "http://localhost:3000";
const USER_DATA_DIR = path.join(__dirname, ".playwright-profile");
const DEAL_ID = process.env.DEAL_ID || "";

// Realistic discovery call transcript for Meridian Healthcare Group.
// Covers EMR unification, readmission analytics, budget, timeline, stakeholders, constraints —
// all the fields the Touch 4 workflow needs to extract.
const MEETING_TRANSCRIPT = `Sarah Chen (Lumenalta): Thank you for taking the time today, Dr. Patel. I appreciate you walking me through what Meridian Healthcare is dealing with on the data side.

Dr. Raj Patel (Meridian Healthcare Group): Of course. We've been struggling with this for a while now. Our patient data is scattered across 14 different EMR systems from acquisitions over the last 5 years. Each hospital in our network runs a different system, and getting a unified view of patient outcomes is nearly impossible.

Sarah: That's a common challenge we see in healthcare systems that have grown through M&A. Can you tell me more about the specific business outcomes you're hoping to achieve?

Dr. Patel: Absolutely. First and foremost, we need to reduce our readmission rates. Right now we're at 18%, which is well above the national average of 14%. CMS is threatening penalties, and we estimate we're losing $12M annually in avoidable readmissions. Second, we want to implement predictive analytics for population health management. Our payer contracts are moving to value-based care, and we need the data infrastructure to support risk stratification.

Sarah: Those are significant numbers. What about the timeline? Is there urgency here?

Dr. Patel: Very much so. Our CMS audit is scheduled for Q4 2026, so we need demonstrable progress by September. The board has approved a $3.5M budget for this initiative, with the first $1.8M available immediately for Phase 1. We'd like to see a pilot running in 2 hospitals within 6 months.

Sarah: Who else is involved in the decision-making process?

Dr. Patel: My CTO, James Rodriguez, oversees the technical architecture. Our CMIO Dr. Lisa Wang is the clinical champion. And our CFO Margaret Thompson will sign off on anything above $2M. We also have a compliance officer, David Park, who needs to ensure HIPAA compliance throughout.

Sarah: What constraints should we be aware of?

Dr. Patel: HIPAA is obviously critical — we need end-to-end encryption and audit trails. We also can't have any downtime during the migration; our hospitals operate 24/7. And we have a strict requirement that all data stays within US borders. Our IT team is small, only 12 people, so we'll need your team to handle most of the heavy lifting.

Sarah: This is very helpful context. Let me ask about the technical landscape — what does your current data infrastructure look like?

Dr. Patel: We're running a mix of on-premise servers and some Azure cloud. The biggest EMR is Epic at our flagship hospital, but the others run Cerner, Allscripts, and a couple of legacy systems. We tried a data warehouse project two years ago with another vendor but it stalled because of data quality issues — duplicate patient records, inconsistent coding, that sort of thing.

Sarah: What happened with the previous vendor engagement?

Dr. Patel: They underestimated the complexity of our data landscape. Their approach was too waterfall-oriented — they spent 6 months on a requirements document and by the time they started building, half the requirements had changed. We need a partner that can move faster with an iterative approach. Also, their team was entirely offshore with a 12-hour time zone gap, which made collaboration painful.

Sarah: That's really valuable feedback. At Lumenalta, we work with distributed teams but always ensure overlap hours and dedicated project leads. How do you envision the ideal engagement?

Dr. Patel: Ideally, we'd start with a 3-month proof of concept at 2 of our hospitals — let's say St. Mary's and Regional General — to unify their EMR data into a single patient view. If that works, we'd roll out to the remaining 12 hospitals over the following 9 months. We also want a real-time clinical decision support system that can flag high-risk patients for our care coordinators.

Sarah: You need a unified data platform that brings together 14 EMR systems, enables predictive analytics for population health, and reduces readmission rates — all while maintaining HIPAA compliance and zero downtime.

Dr. Patel: That's exactly right. We're particularly interested in AI/ML capabilities for early warning systems to predict which patients are at high risk of readmission within 48 hours of discharge. We've seen some promising research using LACE scores combined with social determinants of health data, but we don't have the infrastructure to operationalize it.

Sarah: What about interoperability standards? Are you looking at HL7 FHIR?

Dr. Patel: Yes, absolutely. FHIR R4 is our target. We need to support both real-time event-driven data exchange and batch reconciliation. Our payer partners — BlueCross and Aetna — are already moving to FHIR-based data exchange for quality reporting, so that's a hard requirement.

Sarah: This gives me a clear picture. Let me summarize the key deliverables as I understand them: unified patient data platform across 14 EMR systems, predictive readmission risk model, real-time clinical decision support, FHIR R4 interoperability layer, and population health analytics dashboard — all HIPAA compliant with zero-downtime migration.

Dr. Patel: Perfect summary. One more thing — we'd love to see a demo or prototype early in the engagement. Our board meets monthly and they'll want to see tangible progress. Visual dashboards showing readmission trends and risk scores would go a long way in maintaining executive sponsorship.`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Get visible text content of the page */
async function pageText(page: Page): Promise<string> {
  return page.locator('body').innerText().catch(() => '');
}

/** Check if text is visible on page */
async function hasText(page: Page, text: string): Promise<boolean> {
  return page.locator(`text=${text}`).first().isVisible().catch(() => false);
}

/** Click a button by text, with force fallback */
async function clickButton(page: Page, text: string): Promise<boolean> {
  const btn = page.locator(`button:has-text("${text}")`).first();
  if (!(await btn.isVisible().catch(() => false))) return false;
  if (await btn.isDisabled().catch(() => true)) return false;
  try {
    await btn.click({ timeout: 5000 });
    return true;
  } catch {
    try {
      await btn.click({ force: true, timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}

/** Click a link by text */
async function clickLink(page: Page, text: string): Promise<boolean> {
  const link = page.locator(`a:has-text("${text}")`).first();
  if (!(await link.isVisible().catch(() => false))) return false;
  try {
    await link.click({ timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/** Dismiss any open dialogs */
async function dismissDialogs(page: Page): Promise<boolean> {
  const cancel = page.locator('[role="alertdialog"] button:has-text("Cancel")');
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click().catch(() => {});
    await sleep(500);
    return true;
  }
  const overlay = page.locator('[data-state="open"][aria-hidden="true"]');
  if (await overlay.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await sleep(500);
    return true;
  }
  return false;
}

/** Run a touch (1-3) to completion using the standard HITL flow */
async function runTouch(page: Page, dealId: string, touchNum: number, touchName: string): Promise<string | null> {
  const touchUrl = `${BASE_URL}/deals/${dealId}/touch/${touchNum}`;
  console.log(`\n🎯 Touch ${touchNum}: ${touchName}`);

  for (let cycle = 0; cycle < 300; cycle++) {
    if (!page.url().includes(`/touch/${touchNum}`)) {
      await page.goto(touchUrl);
      await page.waitForLoadState("networkidle");
      await sleep(3000);
    }

    // DONE: "Saved to Drive"
    if (await hasText(page, 'Saved to Drive')) {
      const link = page.locator('a:has-text("Open")').first();
      const url = await link.getAttribute("href").catch(() => null);
      console.log(`   ✅ Complete! URL: ${url}`);
      return url;
    }

    // DONE: "Generate Another"
    if (await hasText(page, 'Generate Another')) {
      await page.reload();
      await sleep(3000);
      continue;
    }

    if (await dismissDialogs(page)) continue;

    // APPROVE stages (check before retry)
    if (await clickButton(page, 'Approve & Continue')) {
      console.log(`   ✅ Approved stage`);
      await sleep(8000);
      continue;
    }
    if (await clickButton(page, 'Mark as Ready')) {
      console.log(`   ✅ Marked as ready`);
      await sleep(8000);
      continue;
    }

    // RETRY (only after approval checks)
    if (await clickButton(page, 'Retry Deck Generation')) {
      console.log(`   🔄 Retrying deck generation...`);
      await sleep(10000);
      continue;
    }

    // GENERATE (fresh start — only click once)
    const genBtn = page.locator('button:has-text("Generate")').first();
    const genVisible = await genBtn.isVisible().catch(() => false);
    const genEnabled = genVisible && !(await genBtn.isDisabled().catch(() => true));
    if (genEnabled) {
      const btnText = (await genBtn.textContent().catch(() => '')) || '';
      if (btnText.trim() === 'Generate') {
        console.log(`   ⏳ Starting generation...`);
        await genBtn.click({ timeout: 5000 });
        await sleep(20000);
        continue;
      }
    }

    // Status
    if (cycle % 10 === 0) {
      const text = await pageText(page);
      if (text.includes('Generating') || text.includes('Processing')) {
        console.log(`   ⏳ Generating... (${cycle * 2}s)`);
      } else if (text.includes('did not complete') || text.includes('failed')) {
        console.log(`   ⚠️ Failed state detected, refreshing...`);
        await page.reload();
        await sleep(3000);
      } else {
        console.log(`   ⏳ Waiting... (${cycle * 2}s)`);
      }
    }

    await sleep(2000);
  }

  console.log(`   ❌ Timed out`);
  await page.screenshot({ path: `e2e-debug-touch${touchNum}.png`, fullPage: true });
  return null;
}

/** Run Touch 4 (Sales Proposal) — uses Touch4Form with transcript processing */
async function runTouch4(page: Page, dealId: string): Promise<{
  deckUrl: string | null; talkTrackUrl: string | null; faqUrl: string | null;
}> {
  const touchUrl = `${BASE_URL}/deals/${dealId}/touch/4`;
  console.log(`\n🎯 Touch 4: Sales Proposal`);
  await page.goto(touchUrl);
  await page.waitForLoadState("networkidle");
  await sleep(3000);

  let formSubmitted = false;

  for (let cycle = 0; cycle < 500; cycle++) {
    const url = page.url();
    if (!url.includes('/touch/4') && !url.includes('/asset-review/') && !url.includes('/review/')) {
      await page.goto(touchUrl);
      await page.waitForLoadState("networkidle");
      await sleep(3000);
    }

    // 1. DONE: artifact links
    if (url.includes('/touch/4')) {
      const proposalLink = page.locator('a:has-text("Proposal Deck")');
      if (await proposalLink.isVisible().catch(() => false)) {
        const deckUrl = await proposalLink.getAttribute("href");
        const talkTrackUrl = await page.locator('a:has-text("Talk Track")').getAttribute("href").catch(() => null);
        const faqUrl = await page.locator('a:has-text("Buyer FAQ")').getAttribute("href").catch(() => null);
        console.log(`   ✅ Complete!`);
        return { deckUrl, talkTrackUrl, faqUrl };
      }
      if (await hasText(page, 'Saved to Drive')) {
        const driveLink = page.locator('a:has-text("Open")').first();
        const deckUrl = await driveLink.getAttribute("href").catch(() => null);
        console.log(`   ✅ Complete (single URL)!`);
        return { deckUrl, talkTrackUrl: null, faqUrl: null };
      }
    }

    if (await dismissDialogs(page)) continue;

    // 2. FILL FORM: transcript form visible (only fill once)
    if (!formSubmitted) {
      const transcriptField = page.locator('textarea#transcript');
      if (await transcriptField.isVisible().catch(() => false)) {
        const val = await transcriptField.inputValue();
        if (!val.trim()) {
          console.log(`   📝 Filling transcript form...`);
          // Select subsector if available
          const comboboxes = page.locator('[role="combobox"]');
          const count = await comboboxes.count();
          if (count > 0) {
            await comboboxes.nth(count - 1).click();
            await sleep(500);
            const option = page.locator('[role="option"]:has-text("Health Information Systems")');
            if (await option.isVisible().catch(() => false)) {
              await option.click();
              await sleep(500);
            } else {
              // Pick first available option
              const firstOption = page.locator('[role="option"]').first();
              if (await firstOption.isVisible().catch(() => false)) {
                await firstOption.click();
                await sleep(500);
              }
            }
          }
          await transcriptField.fill(MEETING_TRANSCRIPT);
          await sleep(300);
          const notesField = page.locator('textarea#additional-notes');
          if (await notesField.isVisible().catch(() => false)) {
            await notesField.fill('Budget: $3.5M. CMS audit Q4 2026. Phase 1: $1.8M for 2-hospital EMR unification pilot. Focus on readmission prediction, FHIR R4, population health dashboards.');
          }
          await sleep(300);
        }
        if (await clickButton(page, 'Process Transcript')) {
          console.log(`   ⏳ Processing transcript...`);
          formSubmitted = true;
          await sleep(15000);
          continue;
        }
      }
    }

    // 3. FIELD REVIEW: fill empty fields and continue
    if (await hasText(page, 'Review Extracted Fields')) {
      console.log(`   📋 Field review stage...`);
      for (const { id, fallback } of [
        { id: 'field-customerContext', fallback: 'Meridian Healthcare Group operates 14 hospitals across 3 states with 14 disparate EMR systems (Epic, Cerner, Allscripts, legacy). 18% readmission rate vs 14% national average, costing $12M/year. Previous data warehouse project failed due to waterfall approach and offshore-only team.' },
        { id: 'field-businessOutcomes', fallback: 'Reduce readmissions from 18% to <14%. Implement predictive analytics for population health. Support value-based care transition with FHIR R4 interoperability. Real-time clinical decision support for care coordinators.' },
        { id: 'field-constraints', fallback: 'HIPAA compliance with end-to-end encryption and audit trails. Zero downtime during migration (24/7 hospital operations). All data must remain within US borders. Small IT team (12 people) — vendor must handle heavy lifting.' },
        { id: 'field-stakeholders', fallback: 'Dr. Raj Patel (CEO, champion). James Rodriguez (CTO, technical architecture). Dr. Lisa Wang (CMIO, clinical champion). Margaret Thompson (CFO, $2M+ sign-off). David Park (Compliance Officer, HIPAA).' },
        { id: 'field-timeline', fallback: '3-month POC at 2 hospitals (St. Mary\'s + Regional General). 9-month rollout to remaining 12 hospitals. CMS audit deadline Q4 2026 — demonstrable progress by September.' },
        { id: 'field-budget', fallback: '$3.5M total approved. $1.8M available immediately for Phase 1. Board monthly reviews require visible progress and dashboards.' },
      ]) {
        const f = page.locator(`textarea#${id}`);
        if (await f.isVisible().catch(() => false)) {
          const v = await f.inputValue();
          if (!v.trim()) await f.fill(fallback);
        }
      }
      await sleep(500);
      if (await clickButton(page, 'Continue to Brief Generation') || await clickButton(page, 'Continue to Brief') || await clickButton(page, 'Submit')) {
        console.log(`   ✅ Submitted field review`);
        await sleep(15000);
        continue;
      }
    }

    // 4. BRIEF APPROVAL
    if (await hasText(page, 'Awaiting Approval') || await hasText(page, 'Brief Approval') || await hasText(page, 'Review Sales Brief')) {
      // Fill reviewer name if present
      const reviewerInput = page.locator('input#reviewer-name');
      if (await reviewerInput.isVisible().catch(() => false)) {
        const val = await reviewerInput.inputValue();
        if (!val.trim()) await reviewerInput.fill('Sarah Chen');
      }
      if (await clickButton(page, 'Approve') || await clickButton(page, 'Approve Brief')) {
        console.log(`   ✅ Brief approved!`);
        await sleep(15000);
        continue;
      }
    }

    // 5. HITL stages (Approve & Continue / Mark as Ready) — Touch 4 may use standard HITL
    if (await clickButton(page, 'Approve & Continue')) {
      console.log(`   ✅ Approved stage`);
      await sleep(8000);
      continue;
    }
    if (await clickButton(page, 'Mark as Ready')) {
      console.log(`   ✅ Marked as ready`);
      await sleep(8000);
      continue;
    }

    // 6. APPROVE ASSETS
    if (await clickButton(page, 'Approve Assets') || await clickButton(page, 'Approve All')) {
      console.log(`   ✅ Assets approved!`);
      await sleep(5000);
      continue;
    }

    // 7. REVIEW ASSETS link/button
    if (await clickLink(page, 'Review Assets') || await clickButton(page, 'Review Assets') || await clickButton(page, 'Review & Approve')) {
      console.log(`   📋 Navigating to asset review...`);
      await page.waitForLoadState("networkidle");
      await sleep(3000);
      continue;
    }

    // 8. Assets delivered — go back to touch 4
    if (await hasText(page, 'Assets Approved') || await hasText(page, 'Assets Delivered') || await hasText(page, 'Delivered')) {
      console.log(`   ✅ Assets delivered! Checking URLs...`);
      await page.goto(touchUrl);
      await page.waitForLoadState("networkidle");
      await sleep(5000);
      continue;
    }

    // 9. Status updates
    if (cycle % 10 === 0 && cycle > 0) {
      const text = await pageText(page);
      if (text.includes('Extracting')) console.log(`   ⏳ Extracting fields... (${cycle * 2}s)`);
      else if (text.includes('Generating')) console.log(`   ⏳ Generating... (${cycle * 2}s)`);
      else if (text.includes('Processing')) console.log(`   ⏳ Processing... (${cycle * 2}s)`);
      else if (text.includes('Mapping')) console.log(`   ⏳ Mapping solution... (${cycle * 2}s)`);
      else console.log(`   ⏳ Waiting... (${cycle * 2}s)`);
    }

    await sleep(2000);
  }

  console.log(`   ❌ Touch 4 timed out`);
  await page.screenshot({ path: 'e2e-debug-touch4.png', fullPage: true });
  return { deckUrl: null, talkTrackUrl: null, faqUrl: null };
}

async function main() {
  if (!DEAL_ID) {
    console.error("Usage: DEAL_ID=<id> npx tsx e2e-demo.ts");
    process.exit(1);
  }

  console.log("🚀 AtlusDeck E2E Demo\n" + "=".repeat(50));
  console.log(`📋 Deal: ${DEAL_ID}\n`);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());

  try {
    // Auth check
    await page.goto(`${BASE_URL}/deals`);
    await page.waitForLoadState("networkidle");
    await sleep(2000);
    if (page.url().includes('/login')) {
      console.log("🔑 Please sign in...");
      const btn = page.locator('button:has-text("Sign in with Google")');
      if (await btn.isVisible().catch(() => false)) await btn.click();
      await page.waitForURL('**/deals**', { timeout: 300_000 });
      console.log("✅ Authenticated!\n");
      await sleep(2000);
    }

    // Touches 1-3 already complete — skip to Touch 4
    const touch1Url = "https://docs.google.com/presentation/d/1nT2j5IdUZYzzFmRnL5Kyqnd2oj6qF59yM46fqVMVCts/edit";
    const touch2Url = "https://docs.google.com/presentation/d/1sar7PYvmKJx89xdC8hH3yAFaCFBRzYQs3Uix_zY3zz8/edit";
    const touch3Url = "https://docs.google.com/presentation/d/1aSm0hilvM-6Y3a0MqH9VYZ12iHWSK5Reugj3-Xdvpk8/edit";
    console.log(`Touch 1-3 already complete (skipping)\n`);
    const touch4 = await runTouch4(page, DEAL_ID);

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("🎉 RESULTS\n");
    console.log(`Touch 1: ${touch1Url}`);
    console.log(`Touch 2: ${touch2Url}`);
    console.log(`Touch 3: ${touch3Url}`);
    console.log(`Touch 4 Deck: ${touch4.deckUrl}`);
    console.log(`Touch 4 Talk Track: ${touch4.talkTrackUrl}`);
    console.log(`Touch 4 FAQ: ${touch4.faqUrl}`);
    console.log(`\nDeal: ${BASE_URL}/deals/${DEAL_ID}/overview`);

    fs.writeFileSync('e2e-demo-results.json', JSON.stringify({
      dealId: DEAL_ID,
      touch1: touch1Url,
      touch2: touch2Url,
      touch3: touch3Url,
      touch4_deck: touch4.deckUrl,
      touch4_talk_track: touch4.talkTrackUrl,
      touch4_faq: touch4.faqUrl,
    }, null, 2));
  } catch (err) {
    console.error("\n❌", err);
    await page.screenshot({ path: 'e2e-demo-error.png', fullPage: true });
  } finally {
    await context.close();
  }
}

main().catch(console.error);
