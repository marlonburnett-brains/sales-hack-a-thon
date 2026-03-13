/**
 * E2E Demo Script — Full deal lifecycle with rich context
 * Creates all 6 artifacts for NexaGen Financial Systems
 */
import { chromium, type Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE_URL = "http://localhost:3000";
const USER_DATA_DIR = path.join(__dirname, ".playwright-profile");
const DEAL_ID = process.env.DEAL_ID || "demo_nexagen_deal";

// ─── Rich context for each touch ───────────────────────────

const TOUCH_1_CONTEXT = `NexaGen Financial Systems is a mid-market fintech company with 2,200 employees serving 340+ community banks and credit unions across North America. They provide core banking software, payment processing, and lending platforms. Their legacy COBOL-based core banking system processes $47B in daily transactions but is 25 years old and increasingly difficult to maintain.

Key pain points:
- Legacy core banking platform averaging 14 hours of unplanned downtime per quarter, costing $2.3M annually
- Unable to support real-time payments (FedNow, RTP) on current architecture
- Regulatory compliance costs growing 30% YoY due to manual processes
- Customer onboarding takes 5-7 business days vs industry best of same-day
- Their engineering team of 180 spends 65% of time on maintenance vs innovation
- Lost 3 major bank contracts ($18M ARR) to cloud-native competitors in the last 12 months

They need a technology partner to help modernize their core banking platform to a cloud-native, API-first architecture while maintaining zero-downtime during migration. Budget is $8.5M over 18 months. CEO Amanda Torres and CTO David Kim are the executive sponsors. Their VP of Engineering, Rachel Nguyen, will be the day-to-day technical lead.

Lumenalta's strengths for this engagement: deep financial services expertise, proven cloud migration methodology, experience with COBOL-to-cloud modernization, and strong track record with regulated industries.`;

const TOUCH_4_TRANSCRIPT = `Marcus Chen (Lumenalta): Amanda, David, thank you both for making time. I know your schedules are packed with the FedNow readiness deadline looming. Let's dive right in.

Amanda Torres (NexaGen CEO): Absolutely, Marcus. We've been evaluating partners for three months now and Lumenalta keeps coming up in conversations with our board. Let me be direct — we're at an inflection point. Our core banking platform is literally held together with duct tape.

David Kim (NexaGen CTO): That's not an exaggeration. We're running a 25-year-old COBOL monolith that processes $47 billion in daily transactions. Last quarter we had 14 hours of unplanned downtime. Each hour costs us roughly $165K in direct losses, plus the reputational damage with our bank clients.

Marcus: $2.3M annually in downtime costs alone. That's significant. What's driving the urgency beyond the operational pain?

Amanda: Three things. First, FedNow. We promised our bank clients real-time payment support by Q1 2027, but our current architecture physically cannot handle the throughput requirements. Second, we lost three major contracts worth $18 million in ARR last year to cloud-native competitors — Thought Machine, Mambu, Temenos. Our banks are telling us: modernize or we leave. Third, and this is what keeps me up at night — regulatory pressure. OCC and FDIC are increasing scrutiny on core banking providers. Our compliance costs are growing 30% year over year because everything is manual.

David: To put numbers on the technical debt: our engineering team of 180 people spends 65% of their time on maintenance. That's essentially 117 engineers just keeping the lights on. We ship maybe 2 major features per quarter. Our competitors ship weekly.

Marcus: What does the ideal end state look like for you?

David: API-first, cloud-native, event-driven architecture. We want to decompose the monolith into domain-driven microservices — accounts, payments, lending, compliance, customer onboarding. Each service independently deployable, independently scalable. We need sub-100ms latency for payment processing and 99.999% uptime.

Amanda: From a business perspective, I need three things: real-time payment support for FedNow and RTP by Q1 2027, customer onboarding reduced from 5 days to same-day, and our compliance reporting fully automated. If we nail those three, we stop the bleeding on contract losses and position ourselves for growth.

Marcus: What's the budget picture?

Amanda: The board approved $8.5 million over 18 months. We have $4.2M available for the first 9 months, with the remainder contingent on Phase 1 success metrics. I should mention — our CFO, James Park, wants to see ROI projections before releasing Phase 2 funds. He's very metrics-driven.

Marcus: Who else is involved in the decision-making?

Amanda: David and I are the executive sponsors. Rachel Nguyen, our VP of Engineering, will be the day-to-day technical lead. She has deep COBOL knowledge and has been architecting the target state for the past year. We also have a dedicated compliance officer, Sarah Williams, who needs to sign off on anything touching our regulated data. And our VP of Product, Mike Chen, will prioritize which capabilities get migrated first based on customer demand.

David: Rachel has actually already built a proof of concept for the accounts microservice using Go and PostgreSQL. She proved the concept works but needs a full engineering team to scale it. Her POC reduced account lookup latency from 800ms to 12ms.

Marcus: That's impressive. What about the migration strategy? Have you thought about the strangler fig pattern?

David: Exactly what Rachel proposed. We can't do a big-bang migration — $47 billion in daily transactions means zero tolerance for downtime. We need to run the old and new systems in parallel, with an anti-corruption layer routing traffic between them. As each microservice proves stable, we gradually shift traffic until the monolith is fully decomposed.

Amanda: The board's biggest fear is a migration failure that causes a multi-day outage. Our banks serve millions of consumers. A core banking outage cascades into ATM failures, failed direct deposits, frozen accounts. It would make national news.

Marcus: Understood. What about your infrastructure? Are you on-prem today?

David: Primarily on-prem in two data centers — Denver and Charlotte. We've started moving some non-critical workloads to AWS, but the core banking system is entirely on-prem. We're open to multi-cloud but AWS is our primary target. We need to maintain data residency in the US and have strict requirements around encryption at rest and in transit — AES-256 minimum.

Marcus: What happened with previous modernization attempts?

Amanda: We tried twice. First time, three years ago, we hired an offshore team to rewrite the lending module. They spent 8 months and delivered something that couldn't handle our transaction volumes. Complete write-off — $1.2M lost. Second time, last year, we tried to do it internally. Rachel's team made good progress on the accounts POC but we couldn't staff it properly without pulling people off maintenance, and the production incidents kept pulling them back.

David: The lesson we learned is that we need a partner who understands both the legacy COBOL world and modern cloud architecture. It's a rare combination. Most cloud shops have never seen a line of COBOL. And the COBOL consultants don't understand event-driven architecture or Kubernetes.

Marcus: That's exactly where Lumenalta excels. We've done five COBOL-to-cloud migrations in financial services in the last three years. Our approach uses automated COBOL analysis tools to map dependencies before we write a single line of new code.

Amanda: That's encouraging. One more constraint — our bank clients have SLA requirements. We guarantee 99.99% uptime and sub-2-second transaction processing. During migration, those SLAs can't slip.

David: Also, we need to maintain PCI DSS Level 1 compliance and SOC 2 Type II certification throughout the migration. Any gap in compliance certification would trigger audit findings for our bank clients.

Marcus: What does success look like at the 6-month mark?

Amanda: Three things: first, the accounts microservice is live in production handling real traffic alongside the COBOL system. Second, we've completed the architecture design for payments and lending services. Third, we have a clear, validated migration runbook that the board can review. If we hit those three milestones, I'm confident the board releases Phase 2 funding.

David: I'd add a fourth: Rachel's team is trained and confident in the new architecture. Knowledge transfer is critical. We can't be dependent on Lumenalta forever — we need to own this platform long-term.

Amanda: Absolutely. We're looking for a partner, not a dependency. Ideally your team is embedded with ours from day one, pair programming, doing architecture reviews together. Not a throw-it-over-the-wall engagement.

Marcus: That embedded model is exactly how we work. Let me summarize what I'm hearing: $8.5M over 18 months to modernize a $47B/day core banking platform from COBOL monolith to cloud-native microservices, with FedNow readiness by Q1 2027, zero-downtime migration using strangler fig pattern, and a strong focus on knowledge transfer to your 180-person engineering team. The first 9 months focus on accounts service, architecture for payments and lending, and proving the migration approach.

Amanda: Perfect summary. When can we see a proposal?`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pageText(page: Page): Promise<string> {
  return page.locator('body').innerText().catch(() => '');
}

async function hasText(page: Page, text: string): Promise<boolean> {
  return page.locator(`text=${text}`).first().isVisible().catch(() => false);
}

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

/** Run a standard HITL touch (1-3) to completion */
async function runTouch(page: Page, dealId: string, touchNum: number, touchName: string): Promise<string | null> {
  const touchUrl = `${BASE_URL}/deals/${dealId}/touch/${touchNum}`;
  console.log(`\n🎯 Touch ${touchNum}: ${touchName}`);

  let generateClicked = false;
  let retryCount = 0;
  const MAX_RETRIES = 3;

  // Navigate to the touch page
  await page.goto(touchUrl);
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(3000);

  for (let cycle = 0; cycle < 300; cycle++) {
    // Re-navigate only if we somehow left the touch page
    if (!page.url().includes(`/touch/${touchNum}`)) {
      await page.goto(touchUrl);
      await page.waitForLoadState("networkidle").catch(() => {});
      await sleep(3000);
    }

    // DONE: check for saved to Drive
    if (await hasText(page, 'Saved to Drive')) {
      const link = page.locator('a:has-text("Open")').first();
      const url = await link.getAttribute("href").catch(() => null);
      console.log(`   ✅ Complete! URL: ${url}`);
      return url;
    }

    // DONE: "Generate Another" means ready state without driveFileId yet — wait
    if (await hasText(page, 'Generate Another')) {
      // Check if there's an Open link too (drive saved)
      const openLink = page.locator('a:has-text("Open")').first();
      if (await openLink.isVisible().catch(() => false)) {
        const url = await openLink.getAttribute("href").catch(() => null);
        console.log(`   ✅ Complete! URL: ${url}`);
        return url;
      }
      // Otherwise wait for Drive save to complete
      if (cycle % 10 === 0) console.log(`   ⏳ Waiting for Drive save... (${cycle * 2}s)`);
      await sleep(2000);
      continue;
    }

    if (await dismissDialogs(page)) continue;

    // APPROVE stages
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

    // RETRY failed generation
    if (await clickButton(page, 'Retry Deck Generation')) {
      console.log(`   🔄 Retrying deck generation...`);
      generateClicked = true; // treat as a new generation attempt
      await sleep(15000);
      continue;
    }

    // GENERATE button — click only if never clicked before
    if (!generateClicked) {
      const genBtn = page.locator('button:has-text("Generate")').first();
      const genVisible = await genBtn.isVisible().catch(() => false);
      const genEnabled = genVisible && !(await genBtn.isDisabled().catch(() => true));
      if (genEnabled) {
        const btnText = (await genBtn.textContent().catch(() => '')) || '';
        if (btnText.trim() === 'Generate') {
          console.log(`   ⏳ Starting generation...`);
          generateClicked = true;
          await genBtn.click({ timeout: 5000 });
          // Wait longer for workflow to reach first HITL suspension
          await sleep(45000);
          // Refresh page to get latest interaction state
          await page.goto(touchUrl);
          await page.waitForLoadState("networkidle").catch(() => {});
          await sleep(5000);
          continue;
        }
      }
    }

    // FAILED: detect error states
    const text = await pageText(page);
    if (text.includes('did not complete') || text.includes('previous generation did not complete')) {
      console.log(`   ⚠️ Failed state detected`);
      // Look for Start Over button or the Generate button in the failed state
      if (await clickButton(page, 'Start Over')) {
        console.log(`   🔄 Starting over...`);
        generateClicked = false;
        retryCount = 0;
        await sleep(5000);
        continue;
      }
      // Reset to allow clicking Generate again
      generateClicked = false;
      await sleep(2000);
      continue;
    }

    // STATUS
    if (cycle % 10 === 0) {
      if (text.includes('Generating') || text.includes('Processing') || text.includes('Generation in progress')) {
        console.log(`   ⏳ Generating... (${cycle * 2}s)`);
      } else if (text.includes('Checking generation status')) {
        console.log(`   ⏳ Checking status... (${cycle * 2}s)`);
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

/** Run Touch 4 — transcript form + HITL approval stages */
async function runTouch4(page: Page, dealId: string): Promise<{
  deckUrl: string | null; talkTrackUrl: string | null; faqUrl: string | null;
}> {
  const touchUrl = `${BASE_URL}/deals/${dealId}/touch/4`;
  console.log(`\n🎯 Touch 4: Sales Proposal`);
  await page.goto(touchUrl);
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(3000);

  let formSubmitted = false;
  let formFillAttempts = 0;

  for (let cycle = 0; cycle < 500; cycle++) {
    const url = page.url();
    if (!url.includes('/touch/4') && !url.includes('/asset-review/') && !url.includes('/review/')) {
      await page.goto(touchUrl);
      await page.waitForLoadState("networkidle").catch(() => {});
      await sleep(3000);
    }

    // DONE: check for artifact links
    if (url.includes('/touch/4')) {
      // Check for structured outputRefs with all 3 URLs
      const proposalLink = page.locator('a:has-text("Proposal")');
      if (await proposalLink.isVisible().catch(() => false)) {
        const deckUrl = await proposalLink.getAttribute("href");
        const talkTrackUrl = await page.locator('a:has-text("Talk Track")').getAttribute("href").catch(() => null);
        const faqUrl = await page.locator('a:has-text("FAQ")').getAttribute("href").catch(() => null);
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

    // FILL FORM (only once, max 3 attempts)
    if (!formSubmitted && formFillAttempts < 3) {
      const transcriptField = page.locator('textarea#transcript');
      if (await transcriptField.isVisible().catch(() => false)) {
        formFillAttempts++;
        const val = await transcriptField.inputValue();
        if (!val.trim()) {
          console.log(`   📝 Filling transcript form...`);
          // Select subsector — click all Select triggers to ensure they have values
          try {
            await page.keyboard.press('Escape').catch(() => {});
            await sleep(300);

            // Click ALL select trigger buttons to open dropdowns and select first option
            const triggers = page.locator('button[role="combobox"]');
            const triggerCount = await triggers.count();
            for (let t = 0; t < triggerCount; t++) {
              const trigger = triggers.nth(t);
              const currentValue = await trigger.textContent().catch(() => '');
              // Skip if already has a real value (not a placeholder)
              if (currentValue && !currentValue.includes('Select')) continue;

              await trigger.click({ timeout: 3000 }).catch(() => {});
              await sleep(800);
              // Click the first option in the dropdown portal
              const option = page.locator('[role="option"]').first();
              if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                const optText = await option.textContent().catch(() => 'unknown');
                await option.click({ timeout: 3000 }).catch(() => {});
                console.log(`   📝 Selected dropdown ${t + 1}: ${optText}`);
                await sleep(500);
              } else {
                await page.keyboard.press('Escape').catch(() => {});
                await sleep(300);
              }
            }
          } catch (e) {
            console.log(`   ⚠️ Dropdown selection failed: ${(e as Error).message?.slice(0, 80)}`);
            await page.keyboard.press('Escape').catch(() => {});
            await sleep(300);
          }
          await transcriptField.fill(TOUCH_4_TRANSCRIPT);
          await sleep(300);
          const notesField = page.locator('textarea#additional-notes');
          if (await notesField.isVisible().catch(() => false)) {
            await notesField.fill('Budget: $8.5M over 18 months ($4.2M Phase 1). FedNow deadline Q1 2027. Core banking COBOL-to-cloud modernization. Strangler fig migration pattern. Zero downtime required. 180 engineers, 65% on maintenance. Lost $18M ARR to competitors. Key stakeholders: CEO Amanda Torres, CTO David Kim, VP Eng Rachel Nguyen, CFO James Park, Compliance Sarah Williams.');
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

    // FIELD REVIEW
    if (await hasText(page, 'Review Extracted Fields')) {
      console.log(`   📋 Field review stage...`);
      for (const { id, fallback } of [
        { id: 'field-customerContext', fallback: 'NexaGen Financial Systems is a mid-market fintech serving 340+ community banks and credit unions. Their 25-year-old COBOL core banking platform processes $47B daily but suffers 14 hours of unplanned downtime per quarter ($2.3M annual cost). Lost $18M ARR to cloud-native competitors (Thought Machine, Mambu). 180-person engineering team spends 65% on maintenance. Previous modernization attempts failed: offshore rewrite ($1.2M write-off) and understaffed internal effort.' },
        { id: 'field-businessOutcomes', fallback: 'Enable FedNow/RTP real-time payments by Q1 2027. Reduce customer onboarding from 5 days to same-day. Automate compliance reporting (currently growing 30% YoY). Decompose COBOL monolith into cloud-native microservices (accounts, payments, lending, compliance). Achieve 99.999% uptime and sub-100ms payment latency. Stop contract losses to cloud-native competitors.' },
        { id: 'field-constraints', fallback: 'Zero downtime during migration ($47B daily transactions). PCI DSS Level 1 and SOC 2 Type II compliance must be maintained throughout. US data residency required. AES-256 encryption at rest and in transit. Bank client SLAs: 99.99% uptime, sub-2-second transactions. Strangler fig migration pattern required — no big-bang cutover. Knowledge transfer to internal team is critical.' },
        { id: 'field-stakeholders', fallback: 'Amanda Torres (CEO, executive sponsor, board liaison). David Kim (CTO, executive sponsor, technical strategy). Rachel Nguyen (VP Engineering, day-to-day lead, built accounts POC). James Park (CFO, Phase 2 funding gatekeeper, metrics-driven). Sarah Williams (Compliance Officer, regulatory sign-off). Mike Chen (VP Product, capability prioritization).' },
        { id: 'field-timeline', fallback: '18-month program. Phase 1 (months 1-9): accounts microservice live in production, architecture designs for payments and lending, validated migration runbook. Phase 2 (months 10-18): payments and lending migration, FedNow integration. Hard deadline: FedNow readiness Q1 2027. 6-month board review checkpoint for Phase 2 funding release.' },
        { id: 'field-budget', fallback: '$8.5M total over 18 months. $4.2M available for Phase 1 (first 9 months). Phase 2 funding ($4.3M) contingent on Phase 1 success metrics. CFO requires ROI projections before Phase 2 release. Previous failed attempt cost $1.2M (offshore rewrite).' },
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

    // BRIEF APPROVAL
    if (await hasText(page, 'Awaiting Approval') || await hasText(page, 'Brief Approval') || await hasText(page, 'Review Sales Brief')) {
      const reviewerInput = page.locator('input#reviewer-name');
      if (await reviewerInput.isVisible().catch(() => false)) {
        const val = await reviewerInput.inputValue();
        if (!val.trim()) await reviewerInput.fill('Marcus Chen');
      }
      if (await clickButton(page, 'Approve') || await clickButton(page, 'Approve Brief')) {
        console.log(`   ✅ Brief approved!`);
        await sleep(15000);
        continue;
      }
    }

    // HITL APPROVE stages
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

    // APPROVE ASSETS
    if (await clickButton(page, 'Approve Assets') || await clickButton(page, 'Approve All')) {
      console.log(`   ✅ Assets approved!`);
      await sleep(5000);
      continue;
    }

    // REVIEW ASSETS
    if (await clickLink(page, 'Review Assets') || await clickButton(page, 'Review Assets') || await clickButton(page, 'Review & Approve')) {
      console.log(`   📋 Navigating to asset review...`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await sleep(3000);
      continue;
    }

    // DELIVERED — be specific to avoid false matches
    if (await hasText(page, 'Assets Approved')) {
      console.log(`   ✅ Assets approved/delivered! Checking URLs...`);
      await page.goto(touchUrl);
      await page.waitForLoadState("networkidle").catch(() => {});
      await sleep(5000);
      continue;
    }

    // STATUS
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

  console.log("🚀 AtlusDeck E2E Demo — NexaGen Financial Systems\n" + "=".repeat(55));
  console.log(`📋 Deal: ${DEAL_ID}\n`);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());

  try {
    // Auth check
    await page.goto(`${BASE_URL}/deals`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await sleep(2000);
    if (page.url().includes('/login')) {
      console.log("🔑 Please sign in...");
      const btn = page.locator('button:has-text("Sign in with Google")');
      if (await btn.isVisible().catch(() => false)) await btn.click();
      await page.waitForURL('**/deals**', { timeout: 300_000 });
      console.log("✅ Authenticated!\n");
      await sleep(2000);
    }

    // Run all touches
    const touch1Url = await runTouch(page, DEAL_ID, 1, "First Contact Pager");
    const touch2Url = await runTouch(page, DEAL_ID, 2, "Meet Lumenalta");
    const touch3Url = await runTouch(page, DEAL_ID, 3, "Capability Alignment");
    const touch4 = await runTouch4(page, DEAL_ID);

    // Summary
    console.log("\n" + "=".repeat(55));
    console.log("🎉 RESULTS\n");
    console.log(`Touch 1 (Pager):             ${touch1Url}`);
    console.log(`Touch 2 (Meet Lumenalta):    ${touch2Url}`);
    console.log(`Touch 3 (Capability):        ${touch3Url}`);
    console.log(`Touch 4 (Proposal Deck):     ${touch4.deckUrl}`);
    console.log(`Touch 4 (Talk Track):        ${touch4.talkTrackUrl}`);
    console.log(`Touch 4 (Buyer FAQ):         ${touch4.faqUrl}`);
    console.log(`\nDeal: ${BASE_URL}/deals/${DEAL_ID}/overview`);

    fs.writeFileSync('e2e-demo-results.json', JSON.stringify({
      dealId: DEAL_ID,
      company: 'NexaGen Financial Systems',
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
