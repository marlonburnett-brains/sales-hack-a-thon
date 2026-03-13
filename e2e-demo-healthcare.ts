/**
 * E2E Demo Script — Full deal lifecycle for Meridian Health Partners
 *
 * Healthcare client needing patient data interoperability platform.
 * Ingests rich context before each touch via the deal chat bindings API,
 * validating that accumulated knowledge flows into deck generation.
 */
import { chromium, type Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE_URL = "http://localhost:3000";
const USER_DATA_DIR = path.join(__dirname, ".playwright-profile");

// ─── Rich context for each touch ───────────────────────────

const COMPANY_NAME = "Meridian Health Partners";
const INDUSTRY = "Health Care";
const SUBSECTOR = "Health Information Systems";
const DEAL_NAME = "Q1 2026 Interoperability Platform";
const SALESPERSON_NAME = "Elena Vasquez";

const TOUCH_1_CONTEXT = `Meridian Health Partners is a regional health system operating 53 hospitals and 280+ outpatient clinics across the Southeastern US, serving 4.2 million patients annually. They employ 38,000 healthcare workers and generate $9.8B in annual revenue.

Key pain points:
- 53 hospitals running 8 different EHR vendors (Epic, Cerner, MEDITECH, Allscripts, athenahealth, NextGen, eClinicalWorks, Greenway). No unified patient record across facilities.
- Patient matching accuracy only 78% across systems — 22% of cross-facility encounters create duplicate records, leading to medication errors, redundant tests, and missed allergies.
- Average data transfer latency between facilities is 4.3 hours. Emergency departments cannot access patient histories from sister hospitals in real time.
- $12.4M annual cost for manual data reconciliation — 85 FTEs dedicated to chart reconciliation and data cleanup.
- Failed CMS Interoperability and Patient Access final rule compliance audit in 2025. Facing potential $2.1M penalty per facility.
- HIPAA audit findings increased 40% YoY — 23 findings in last audit, primarily around data access logging and PHI transmission security.
- Population health analytics team (12 data scientists) can only analyze data from 18 of 53 hospitals due to integration gaps. Missing 66% of their patient population in predictive models.

They need a technology partner to build a unified patient data interoperability platform that connects all 53 hospitals into a FHIR R4-compliant data fabric, enabling real-time clinical data exchange, population health analytics, and regulatory compliance.

Budget: $6.2M over 14 months. CEO Dr. Robert Okafor and CMIO Dr. Sarah Blackwell are executive sponsors. VP of Health IT, Jamal Washington, is the day-to-day technical lead.

Lumenalta's strengths: deep healthcare data engineering expertise, FHIR/HL7 integration experience, HIPAA-compliant cloud architecture, and proven track record with large health systems.`;

const TOUCH_2_CONTEXT = `Following our initial outreach to Meridian Health Partners, we've learned more about their technology landscape and organizational dynamics:

Current Architecture:
- Primary data center in Atlanta (on-prem), DR site in Nashville. Moving to Azure due to existing Microsoft EA.
- Epic (22 hospitals) and Cerner (15 hospitals) are the two largest EHR deployments. Remaining 16 hospitals use 6 different smaller vendors.
- Existing Rhapsody integration engine handles point-to-point HL7v2 interfaces but cannot scale — currently managing 340 interfaces with 47 known failure points.
- Attempted a HIE (Health Information Exchange) implementation with InterSystems HealthShare 2 years ago — project stalled at $3.1M spend when they couldn't handle the variety of data formats across their smaller hospital EHRs.

Organizational Context:
- Recently hired a new CMIO (Dr. Blackwell) from Cleveland Clinic specifically to drive interoperability. She has strong opinions about FHIR-first architecture.
- IT team of 210, but only 15 have experience with modern APIs or cloud. Heavy Citrix/on-prem mindset.
- Board meeting in April 2026 — Dr. Okafor needs to demonstrate interoperability progress or risk losing the CMIO budget allocation.
- Competing initiative: Epic's Care Everywhere being pushed by the Epic hospital administrators. Need to show value beyond what Care Everywhere offers (which only connects Epic-to-Epic).

Lumenalta should emphasize: vendor-agnostic FHIR platform (not just Epic-to-Epic), real-time vs batch processing, population health analytics layer, and change management/training for IT team.`;

const TOUCH_3_CONTEXT = `Meridian Health Partners has confirmed strong interest in two primary capability areas after our intro conversation:

1. Data Engineering — Their core need is building the FHIR data fabric. They need:
   - FHIR R4 resource mapping from 8 different EHR source systems
   - Master Patient Index (MPI) with probabilistic matching improving from 78% to 99%+ accuracy
   - Real-time streaming pipeline (sub-second clinical data exchange) replacing 4.3-hour batch transfers
   - Data quality framework with automated reconciliation replacing 85 manual FTEs
   - Azure-native architecture aligned with their Microsoft Enterprise Agreement

2. AI/ML — Their population health team is excited about:
   - Clinical NLP for unstructured notes (40% of patient data is in free-text clinical notes)
   - Predictive readmission risk models covering all 53 hospitals (currently only 18)
   - Social determinants of health (SDOH) data integration from community partners
   - Sepsis early warning system — their current rule-based system misses 35% of cases

Key technical constraints we've learned:
- Must maintain HIPAA BAA coverage throughout. PHI cannot leave US soil.
- Azure preferred (existing EA), but open to multi-cloud if needed for specific FHIR services.
- Epic hospitals use Epic FHIR APIs (R4), Cerner uses Millennium FHIR API, smaller vendors need custom adapters.
- HL7v2 ADT feeds must continue flowing during migration — no disruption to current clinical workflows.`;

const TOUCH_4_TRANSCRIPT = `Elena Vasquez (Lumenalta): Dr. Okafor, Dr. Blackwell, Jamal — thank you all for making time today. I know your schedules are intense with the CMS compliance deadline approaching. I'd like to dive into the details of what a partnership could look like.

Dr. Robert Okafor (Meridian CEO): Thank you, Elena. I'll be direct — this interoperability challenge is the single biggest strategic risk facing Meridian right now. We're a $9.8 billion health system that can't tell you if a patient was seen at two of our own hospitals last week. That's unacceptable.

Dr. Sarah Blackwell (Meridian CMIO): And it's not just operational. Last month, we had a patient transfer from our Savannah facility to Atlanta. The receiving ED had no access to the patient's medication list from Savannah because they're on Cerner and Atlanta is on Epic. The patient was given a contraindicated medication. Fortunately we caught it, but this is exactly the scenario that keeps me up at night.

Jamal Washington (VP Health IT): To quantify the problem — we have 53 hospitals running 8 different EHR vendors. Our Rhapsody integration engine manages 340 point-to-point interfaces, but we have 47 known failure points where interfaces drop messages. Our patient matching accuracy across systems is 78%. That means 22% of cross-facility encounters either create duplicate records or can't find the existing patient.

Elena: That 22% error rate on patient matching — what's the downstream impact?

Jamal: Massive. We estimate $12.4 million annually in manual data reconciliation. We have 85 full-time employees whose sole job is chart reconciliation. Beyond the cost, the clinical impact is significant — redundant diagnostic tests cost us another $8 million per year because physicians can't see tests already done at sister facilities.

Dr. Blackwell: And it's blocking our population health strategy. My analytics team of 12 data scientists can only analyze data from 18 of our 53 hospitals. We're making population health decisions based on 34% of our actual patient population. Our predictive readmission model is running on incomplete data, which means we're missing high-risk patients.

Elena: What does the ideal end state look like for Meridian?

Dr. Blackwell: A FHIR R4-compliant data fabric that connects all 53 hospitals in real time. When a patient arrives at any Meridian facility, the clinician has a complete, unified view of that patient's history across our entire system. Sub-second latency for clinical data exchange. 99%+ patient matching accuracy.

Dr. Okafor: From a business perspective, three things. First, CMS compliance — we failed the Interoperability and Patient Access final rule audit last year. We're facing potential penalties of $2.1 million per facility. That's $111 million in aggregate exposure. Second, eliminate the $12.4 million annual reconciliation cost and redeploy those 85 FTEs to higher-value work. Third, enable our population health analytics across all 53 hospitals so we can participate in value-based care contracts. We estimate $45 million in annual revenue from at-risk contracts that we can't pursue today because we don't have the data infrastructure.

Elena: Walk me through the regulatory timeline.

Jamal: CMS gave us a corrective action plan deadline of September 2026. We need to demonstrate FHIR-based patient access APIs for all facilities by then. The ONC Cures Act also requires us to eliminate information blocking. And our HIPAA audit findings increased 40% year over year — 23 findings in the last audit, primarily around data access logging and PHI transmission security between facilities.

Dr. Okafor: And internally, I have a board meeting in April 2026. I need to show material progress on interoperability or I risk losing the budget allocation Dr. Blackwell's team depends on.

Elena: Tell me about the InterSystems HealthShare implementation that stalled.

Jamal: Two years ago we invested $3.1 million in HealthShare as our HIE platform. It works well for our Epic-to-Epic connections, but we couldn't get it to handle the variety of data formats from our smaller hospitals — eClinicalWorks, Greenway, NextGen. Their FHIR support was limited, and we spent 18 months trying to build custom adapters. Eventually the project lost executive sponsorship when Dr. Okafor's predecessor left.

Dr. Blackwell: That failure taught us two things. First, we need a vendor-agnostic approach that handles the long tail of EHR systems, not just Epic and Cerner. Second, we need a partner who can execute, not just sell software. The HealthShare team gave us a platform but left us to figure out the integration architecture ourselves.

Elena: What about Epic's Care Everywhere? I imagine the Epic hospital administrators are pushing for that.

Jamal: They absolutely are. Care Everywhere is excellent for Epic-to-Epic connections. But it doesn't solve our fundamental problem — 31 of our 53 hospitals are NOT on Epic. Care Everywhere won't connect our Cerner, MEDITECH, Allscripts, or smaller vendor hospitals. We need a solution that works across all 8 EHR vendors.

Dr. Blackwell: Plus, Care Everywhere is a query-response model. You have to know to look for data at another facility. What we need is a unified data layer where ALL patient data flows automatically and is available without the clinician needing to know which facility generated it.

Elena: What about infrastructure? Where does the platform need to run?

Jamal: We have a primary data center in Atlanta and a DR site in Nashville. We have a Microsoft Enterprise Agreement, so Azure is our preferred cloud. We've started moving some non-clinical workloads to Azure, but all clinical data is still on-prem. We're open to hybrid architecture — we understand cloud is necessary for scale — but PHI can never leave US soil and we need to maintain HIPAA BAA coverage throughout.

Elena: Tell me about your IT team's capabilities.

Jamal: Honestly, that's one of my concerns. I have 210 people in IT, but only about 15 have experience with modern APIs, FHIR, or cloud architecture. Most of my team grew up in the Citrix and on-prem world. We need significant knowledge transfer and hands-on training as part of any engagement. I don't want to be dependent on a vendor forever — we need to own and operate this platform ourselves within 18 months.

Dr. Okafor: That's non-negotiable. Meridian is a health system, not a tech company, but we need to build enough internal capability to maintain and evolve the platform independently.

Elena: What about the population health analytics and AI capabilities?

Dr. Blackwell: This is the real prize beyond interoperability. Once we have the unified data fabric, we want to build three things. First, clinical NLP — 40% of our patient data is in unstructured clinical notes. We need to extract structured data from notes across all 53 hospitals. Second, predictive models — readmission risk, sepsis early warning, chronic disease progression. Our current rule-based sepsis system misses 35% of cases. Third, social determinants of health data integration. We partner with 140 community organizations, and their SDOH data could dramatically improve our population health models.

Elena: What's the budget picture?

Dr. Okafor: The board approved $6.2 million over 14 months. We have $3.5 million available for the first 7 months — that covers the data fabric foundation and initial hospital connections. The remaining $2.7 million is for Phase 2, covering analytics, AI models, and connecting the remaining smaller hospitals. Phase 2 funding is contingent on demonstrating CMS compliance readiness and measurable improvement in patient matching accuracy.

Jamal: I should add — we have $1.8 million in existing annual budget for the Rhapsody integration engine. As we migrate interfaces to the new platform, we expect to redirect $1.2 million of that to ongoing operations of the new system. So the total cost of ownership needs to account for that funding shift.

Elena: Who else needs to be involved in the decision process?

Dr. Okafor: Dr. Blackwell and I are the executive sponsors. Jamal is the day-to-day technical lead. You'll also need to work with Catherine Rivera, our Chief Compliance Officer — she has veto power on anything touching PHI. And Dr. Marcus Thompson, our VP of Population Health, will define requirements for the analytics layer. Our CFO, Lisa Chang, controls Phase 2 funding release and wants monthly cost-to-value reporting.

Dr. Blackwell: One more thing — our Epic administrator leads, particularly Dr. James Park at our flagship Atlanta hospital, will need to be brought along. They're skeptical of anything that isn't Epic-native. We need to demonstrate that this platform enhances Epic, not competes with it.

Elena: What does success look like at the 6-month mark?

Dr. Blackwell: Three things. First, all 22 Epic hospitals and all 15 Cerner hospitals connected to the FHIR data fabric with real-time bidirectional data flow. That's 37 of 53 hospitals — 70% coverage. Second, patient matching accuracy improved from 78% to at least 95% across connected hospitals. Third, a working CMS compliance demonstration for FHIR-based patient access APIs.

Jamal: I'd add: my team has at least 30 people trained on FHIR and the new platform architecture, up from 15 today. And we've decommissioned at least 100 of our 340 Rhapsody point-to-point interfaces.

Dr. Okafor: And I need a board-ready presentation showing ROI trajectory — specifically the path to eliminating the $12.4 million reconciliation cost and the risk mitigation on the $111 million CMS penalty exposure.

Elena: Let me summarize what I'm hearing: $6.2 million over 14 months to build a FHIR R4-compliant patient data interoperability platform connecting 53 hospitals across 8 EHR vendors. The platform needs to achieve sub-second clinical data exchange, 99%+ patient matching accuracy, CMS regulatory compliance by September 2026, and eventually enable population health analytics with clinical NLP and predictive models. Phase 1 focuses on connecting Epic and Cerner hospitals, establishing the data fabric, and demonstrating compliance. Phase 2 extends to smaller vendors and adds the analytics and AI layer.

Dr. Okafor: That captures it perfectly. When can we see a proposal?`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pageText(page: Page): Promise<string> {
  return page.locator("body").innerText().catch(() => "");
}

async function hasText(page: Page, text: string): Promise<boolean> {
  return page
    .locator(`text=${text}`)
    .first()
    .isVisible()
    .catch(() => false);
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
  const cancel = page.locator(
    '[role="alertdialog"] button:has-text("Cancel")'
  );
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click().catch(() => {});
    await sleep(500);
    return true;
  }
  const overlay = page.locator('[data-state="open"][aria-hidden="true"]');
  if (await overlay.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await sleep(500);
    return true;
  }
  return false;
}

// ─── Context ingestion via chat bindings API ────────────────

/**
 * Save context as a DealContextSource before generating a touch.
 * Uses page.evaluate to call the API from within the browser's auth context.
 */
async function ingestContext(
  page: Page,
  dealId: string,
  contextText: string,
  touchType: string,
  title: string
): Promise<boolean> {
  console.log(`   📥 Ingesting context: "${title}"...`);
  try {
    const result = await page.evaluate(
      async ({ dealId, contextText, touchType, title }) => {
        const res = await fetch(
          `/api/deals/${encodeURIComponent(dealId)}/chat/bindings`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: {
                id: null,
                sourceType: "note",
                touchType: touchType,
                title: title,
                rawText: contextText,
                refinedText: null,
                routeContext: {
                  section: "touch",
                  touchType: touchType,
                  pathname: `/deals/${dealId}/touch/${touchType.replace("touch_", "")}`,
                  pageLabel: `Touch ${touchType.replace("touch_", "")}`,
                },
              },
              action: "save_general_note",
              touchType: touchType,
            }),
          }
        );
        return { ok: res.ok, status: res.status };
      },
      { dealId, contextText, touchType, title }
    );
    if (result.ok) {
      console.log(`   ✅ Context saved`);
      return true;
    } else {
      console.log(`   ⚠️ Context save returned ${result.status}`);
      return false;
    }
  } catch (e) {
    console.log(
      `   ⚠️ Context ingestion failed: ${(e as Error).message?.slice(0, 80)}`
    );
    return false;
  }
}

// ─── Deal creation ──────────────────────────────────────────

async function createDeal(page: Page): Promise<string> {
  console.log("\n📋 Creating deal for Meridian Health Partners...");
  await page.goto(`${BASE_URL}/deals`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(3000);

  // Click "New Deal" trigger button
  const newDealBtn = page.locator('button:has-text("New Deal")').first();
  if (await newDealBtn.isVisible().catch(() => false)) {
    await newDealBtn.click();
  } else {
    // Try any button with "Create" or "+"
    const createBtn = page.locator('button:has-text("Create")').first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
    }
  }
  await sleep(1500);

  // Fill company name
  const companyInput = page.locator("input#companyName");
  await companyInput.waitFor({ state: "visible", timeout: 5000 });
  await companyInput.fill(COMPANY_NAME);

  // Select industry
  const industryTrigger = page.locator("#industry");
  await industryTrigger.click();
  await sleep(500);
  const healthOption = page.locator(
    `[role="option"]:has-text("${INDUSTRY}")`
  );
  await healthOption.click();
  await sleep(300);

  // Fill deal name
  await page.locator("input#dealName").fill(DEAL_NAME);

  // Fill salesperson
  await page.locator("input#salesperson").fill(SALESPERSON_NAME);

  // Submit
  await clickButton(page, "Create Deal");
  await page.waitForURL("**/deals/**", { timeout: 15000 });
  await sleep(2000);

  // Extract deal ID from URL
  const url = page.url();
  const dealId = url.split("/deals/")[1]?.split("/")[0] ?? "";
  console.log(`   ✅ Deal created: ${dealId}`);
  return dealId;
}

// ─── Run a standard HITL touch (1-3) to completion ──────────

async function runTouch(
  page: Page,
  dealId: string,
  touchNum: number,
  touchName: string
): Promise<string | null> {
  const touchUrl = `${BASE_URL}/deals/${dealId}/touch/${touchNum}`;
  console.log(`\n🎯 Touch ${touchNum}: ${touchName}`);

  let generateClicked = false;

  // Navigate to the touch page
  await page.goto(touchUrl);
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(4000);

  for (let cycle = 0; cycle < 300; cycle++) {
    // Re-navigate only if we somehow left the touch page
    if (!page.url().includes(`/touch/${touchNum}`)) {
      await page.goto(touchUrl);
      await page.waitForLoadState("networkidle").catch(() => {});
      await sleep(3000);
    }

    // DONE: check for saved to Drive
    if (await hasText(page, "Saved to Drive")) {
      const link = page.locator('a:has-text("Open")').first();
      const url = await link.getAttribute("href").catch(() => null);
      console.log(`   ✅ Complete! URL: ${url}`);
      return url;
    }

    // DONE: "Generate Another" means ready state
    if (await hasText(page, "Generate Another")) {
      const openLink = page.locator('a:has-text("Open")').first();
      if (await openLink.isVisible().catch(() => false)) {
        const url = await openLink.getAttribute("href").catch(() => null);
        console.log(`   ✅ Complete! URL: ${url}`);
        return url;
      }
      if (cycle % 10 === 0)
        console.log(`   ⏳ Waiting for Drive save... (${cycle * 2}s)`);
      await sleep(2000);
      continue;
    }

    if (await dismissDialogs(page)) continue;

    // APPROVE stages
    if (await clickButton(page, "Approve & Continue")) {
      console.log(`   ✅ Approved stage`);
      await sleep(8000);
      continue;
    }
    if (await clickButton(page, "Mark as Ready")) {
      console.log(`   ✅ Marked as ready — waiting for deck assembly...`);
      // After Mark as Ready, the workflow continues with deck assembly/copy.
      // Wait longer and keep refreshing to detect completion.
      for (let wait = 0; wait < 30; wait++) {
        await sleep(10000);
        await page.goto(touchUrl);
        await page.waitForLoadState("networkidle").catch(() => {});
        await sleep(3000);
        if (await hasText(page, "Saved to Drive")) break;
        if (await hasText(page, "Generate Another")) break;
        if (wait % 3 === 0) console.log(`   ⏳ Assembling deck... (${(wait + 1) * 10}s)`);
      }
      continue;
    }

    // RETRY failed generation — refresh page first, it may have completed
    if (await clickButton(page, "Retry Deck Generation")) {
      console.log(`   🔄 Retrying deck generation...`);
      generateClicked = true;
      // Wait for retry to process, then refresh to get actual state
      await sleep(10000);
      await page.goto(touchUrl);
      await page.waitForLoadState("networkidle").catch(() => {});
      await sleep(5000);
      continue;
    }

    // GENERATE button — click only if never clicked before
    if (!generateClicked) {
      const genBtn = page.locator('button:has-text("Generate")').first();
      const genVisible = await genBtn.isVisible().catch(() => false);
      const genEnabled =
        genVisible && !(await genBtn.isDisabled().catch(() => true));
      if (genEnabled) {
        const btnText = (await genBtn.textContent().catch(() => "")) || "";
        if (btnText.trim() === "Generate") {
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
    if (
      text.includes("did not complete") ||
      text.includes("previous generation did not complete")
    ) {
      console.log(`   ⚠️ Failed state detected`);
      if (await clickButton(page, "Start Over")) {
        console.log(`   🔄 Starting over...`);
        generateClicked = false;
        await sleep(5000);
        continue;
      }
      generateClicked = false;
      await sleep(2000);
      continue;
    }

    // STATUS
    if (cycle % 10 === 0) {
      if (
        text.includes("Generating") ||
        text.includes("Processing") ||
        text.includes("Generation in progress")
      ) {
        console.log(`   ⏳ Generating... (${cycle * 2}s)`);
      } else if (text.includes("Checking generation status")) {
        console.log(`   ⏳ Checking status... (${cycle * 2}s)`);
      } else {
        console.log(`   ⏳ Waiting... (${cycle * 2}s)`);
      }
    }

    await sleep(2000);
  }

  console.log(`   ❌ Timed out`);
  await page.screenshot({
    path: `e2e-healthcare-touch${touchNum}.png`,
    fullPage: true,
  });
  return null;
}

// ─── Touch 4: Sales Proposal ────────────────────────────────

async function runTouch4(
  page: Page,
  dealId: string
): Promise<{
  deckUrl: string | null;
  talkTrackUrl: string | null;
  faqUrl: string | null;
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
    if (
      !url.includes("/touch/4") &&
      !url.includes("/asset-review/") &&
      !url.includes("/review/")
    ) {
      await page.goto(touchUrl);
      await page.waitForLoadState("networkidle").catch(() => {});
      await sleep(3000);
    }

    // DONE: check for artifact links
    if (url.includes("/touch/4")) {
      const proposalLink = page.locator('a:has-text("Proposal")');
      if (await proposalLink.isVisible().catch(() => false)) {
        const deckUrl = await proposalLink.getAttribute("href");
        const talkTrackUrl = await page
          .locator('a:has-text("Talk Track")')
          .getAttribute("href")
          .catch(() => null);
        const faqUrl = await page
          .locator('a:has-text("FAQ")')
          .getAttribute("href")
          .catch(() => null);
        console.log(`   ✅ Complete!`);
        return { deckUrl, talkTrackUrl, faqUrl };
      }
      if (await hasText(page, "Saved to Drive")) {
        const driveLink = page.locator('a:has-text("Open")').first();
        const deckUrl = await driveLink
          .getAttribute("href")
          .catch(() => null);
        console.log(`   ✅ Complete (single URL)!`);
        return { deckUrl, talkTrackUrl: null, faqUrl: null };
      }
    }

    if (await dismissDialogs(page)) continue;

    // FILL FORM (only once, max 3 attempts)
    if (!formSubmitted && formFillAttempts < 3) {
      const transcriptField = page.locator("textarea#transcript");
      if (await transcriptField.isVisible().catch(() => false)) {
        formFillAttempts++;
        const val = await transcriptField.inputValue();
        if (!val.trim()) {
          console.log(`   📝 Filling transcript form...`);
          try {
            await page.keyboard.press("Escape").catch(() => {});
            await sleep(300);

            // Click ALL select trigger buttons to open dropdowns
            const triggers = page.locator('button[role="combobox"]');
            const triggerCount = await triggers.count();
            for (let t = 0; t < triggerCount; t++) {
              const trigger = triggers.nth(t);
              const currentValue =
                (await trigger.textContent().catch(() => "")) || "";
              if (currentValue && !currentValue.includes("Select")) continue;

              await trigger.click({ timeout: 3000 }).catch(() => {});
              await sleep(800);

              // Try to find the specific subsector option
              const specificOption = page
                .locator(
                  `[role="option"]:has-text("${SUBSECTOR}")`
                )
                .first();
              if (
                await specificOption
                  .isVisible({ timeout: 2000 })
                  .catch(() => false)
              ) {
                await specificOption
                  .click({ timeout: 3000 })
                  .catch(() => {});
                console.log(`   📝 Selected: ${SUBSECTOR}`);
                await sleep(500);
              } else {
                // Select first available option
                const option = page.locator('[role="option"]').first();
                if (
                  await option
                    .isVisible({ timeout: 2000 })
                    .catch(() => false)
                ) {
                  const optText =
                    (await option.textContent().catch(() => "")) || "unknown";
                  await option.click({ timeout: 3000 }).catch(() => {});
                  console.log(`   📝 Selected dropdown ${t + 1}: ${optText}`);
                  await sleep(500);
                } else {
                  await page.keyboard.press("Escape").catch(() => {});
                  await sleep(300);
                }
              }
            }
          } catch (e) {
            console.log(
              `   ⚠️ Dropdown selection failed: ${(e as Error).message?.slice(0, 80)}`
            );
            await page.keyboard.press("Escape").catch(() => {});
            await sleep(300);
          }
          await transcriptField.fill(TOUCH_4_TRANSCRIPT);
          await sleep(300);
          const notesField = page.locator("textarea#additional-notes");
          if (await notesField.isVisible().catch(() => false)) {
            await notesField.fill(
              "Budget: $6.2M over 14 months ($3.5M Phase 1). CMS compliance deadline September 2026. 53 hospitals, 8 EHR vendors. FHIR R4 data fabric. Real-time clinical data exchange. Patient matching 78%→99%+. Azure-native. HIPAA BAA required. Previous $3.1M HealthShare failure. Key stakeholders: CEO Dr. Robert Okafor, CMIO Dr. Sarah Blackwell, VP Health IT Jamal Washington, CCO Catherine Rivera, VP Pop Health Dr. Marcus Thompson, CFO Lisa Chang."
            );
          }
          await sleep(300);
        }
        if (await clickButton(page, "Process Transcript")) {
          console.log(`   ⏳ Processing transcript...`);
          formSubmitted = true;
          await sleep(15000);
          continue;
        }
      }
    }

    // FIELD REVIEW
    if (await hasText(page, "Review Extracted Fields")) {
      console.log(`   📋 Field review stage...`);
      for (const { id, fallback } of [
        {
          id: "field-customerContext",
          fallback:
            "Meridian Health Partners is a $9.8B regional health system with 53 hospitals and 280+ clinics serving 4.2M patients across the Southeastern US. They run 8 different EHR vendors (Epic in 22, Cerner in 15, 6 others in remaining 16). Patient matching accuracy across systems is only 78%. Data transfer latency averages 4.3 hours. 85 FTEs ($12.4M/year) dedicated to manual chart reconciliation. Failed CMS interoperability audit — $111M aggregate penalty exposure. Population health analytics limited to 34% of patient population.",
        },
        {
          id: "field-businessOutcomes",
          fallback:
            "Build FHIR R4-compliant patient data interoperability platform connecting all 53 hospitals. Achieve sub-second clinical data exchange replacing 4.3-hour batch transfers. Improve patient matching from 78% to 99%+. Eliminate $12.4M annual reconciliation cost and redeploy 85 FTEs. Achieve CMS compliance by September 2026 (avoid $111M penalty exposure). Enable population health analytics across all facilities for $45M in value-based care revenue.",
        },
        {
          id: "field-constraints",
          fallback:
            "Zero disruption to clinical workflows during migration — HL7v2 ADT feeds must continue. HIPAA BAA coverage throughout — PHI cannot leave US soil. Azure preferred (existing Microsoft EA). Must support 8 different EHR vendors. CMS compliance deadline September 2026. Previous $3.1M HealthShare implementation failed. Knowledge transfer critical — only 15 of 210 IT staff have modern API experience.",
        },
        {
          id: "field-stakeholders",
          fallback:
            "Dr. Robert Okafor (CEO, executive sponsor, board liaison — needs progress for April 2026 board meeting). Dr. Sarah Blackwell (CMIO, executive sponsor, hired from Cleveland Clinic, FHIR-first advocate). Jamal Washington (VP Health IT, day-to-day lead, 210-person IT team). Catherine Rivera (Chief Compliance Officer, veto on PHI decisions). Dr. Marcus Thompson (VP Population Health, analytics requirements). Lisa Chang (CFO, Phase 2 funding control). Dr. James Park (Epic admin lead, skeptical of non-Epic solutions).",
        },
        {
          id: "field-timeline",
          fallback:
            "14-month program. Phase 1 (months 1-7, $3.5M): Connect 37 hospitals (22 Epic + 15 Cerner) to FHIR data fabric, achieve 95%+ patient matching, demonstrate CMS compliance readiness, train 30 IT staff. Phase 2 (months 8-14, $2.7M): Connect remaining 16 smaller-vendor hospitals, deploy clinical NLP, predictive analytics, SDOH integration. Board checkpoint April 2026. CMS deadline September 2026.",
        },
        {
          id: "field-budget",
          fallback:
            "$6.2M total over 14 months. $3.5M for Phase 1 (first 7 months). $2.7M for Phase 2 (contingent on CMS compliance readiness and patient matching improvement). $1.8M existing annual Rhapsody budget — $1.2M redirectable. Previous failed: $3.1M HealthShare. ROI targets: eliminate $12.4M reconciliation cost, mitigate $111M CMS penalty, enable $45M value-based care revenue.",
        },
      ]) {
        const f = page.locator(`textarea#${id}`);
        if (await f.isVisible().catch(() => false)) {
          const v = await f.inputValue();
          if (!v.trim()) await f.fill(fallback);
        }
      }
      await sleep(500);
      if (
        (await clickButton(page, "Continue to Brief Generation")) ||
        (await clickButton(page, "Continue to Brief")) ||
        (await clickButton(page, "Submit"))
      ) {
        console.log(`   ✅ Submitted field review`);
        await sleep(15000);
        continue;
      }
    }

    // BRIEF APPROVAL
    if (
      (await hasText(page, "Awaiting Approval")) ||
      (await hasText(page, "Brief Approval")) ||
      (await hasText(page, "Review Sales Brief"))
    ) {
      const reviewerInput = page.locator("input#reviewer-name");
      if (await reviewerInput.isVisible().catch(() => false)) {
        const val = await reviewerInput.inputValue();
        if (!val.trim()) await reviewerInput.fill(SALESPERSON_NAME);
      }
      if (
        (await clickButton(page, "Approve")) ||
        (await clickButton(page, "Approve Brief"))
      ) {
        console.log(`   ✅ Brief approved!`);
        await sleep(15000);
        continue;
      }
    }

    // HITL APPROVE stages
    if (await clickButton(page, "Approve & Continue")) {
      console.log(`   ✅ Approved stage`);
      await sleep(8000);
      continue;
    }
    if (await clickButton(page, "Mark as Ready")) {
      console.log(`   ✅ Marked as ready`);
      await sleep(8000);
      continue;
    }

    // APPROVE ASSETS
    if (
      (await clickButton(page, "Approve Assets")) ||
      (await clickButton(page, "Approve All"))
    ) {
      console.log(`   ✅ Assets approved!`);
      await sleep(5000);
      continue;
    }

    // REVIEW ASSETS
    if (
      (await clickLink(page, "Review Assets")) ||
      (await clickButton(page, "Review Assets")) ||
      (await clickButton(page, "Review & Approve"))
    ) {
      console.log(`   📋 Navigating to asset review...`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await sleep(3000);
      continue;
    }

    // DELIVERED
    if (await hasText(page, "Assets Approved")) {
      console.log(`   ✅ Assets approved/delivered! Checking URLs...`);
      await page.goto(touchUrl);
      await page.waitForLoadState("networkidle").catch(() => {});
      await sleep(5000);
      continue;
    }

    // STATUS
    if (cycle % 10 === 0 && cycle > 0) {
      const text = await pageText(page);
      if (text.includes("Extracting"))
        console.log(`   ⏳ Extracting fields... (${cycle * 2}s)`);
      else if (text.includes("Generating"))
        console.log(`   ⏳ Generating... (${cycle * 2}s)`);
      else if (text.includes("Processing"))
        console.log(`   ⏳ Processing... (${cycle * 2}s)`);
      else if (text.includes("Mapping"))
        console.log(`   ⏳ Mapping solution... (${cycle * 2}s)`);
      else console.log(`   ⏳ Waiting... (${cycle * 2}s)`);
    }

    await sleep(2000);
  }

  console.log(`   ❌ Touch 4 timed out`);
  await page.screenshot({
    path: "e2e-healthcare-touch4.png",
    fullPage: true,
  });
  return { deckUrl: null, talkTrackUrl: null, faqUrl: null };
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log(
    "🚀 AtlusDeck E2E Demo — Meridian Health Partners\n" + "=".repeat(55)
  );
  console.log(`📋 Company: ${COMPANY_NAME}`);
  console.log(`🏥 Industry: ${INDUSTRY} / ${SUBSECTOR}`);
  console.log(`👤 Salesperson: ${SALESPERSON_NAME}\n`);

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
    if (page.url().includes("/login")) {
      console.log("🔑 Please sign in...");
      const btn = page.locator('button:has-text("Sign in with Google")');
      if (await btn.isVisible().catch(() => false)) await btn.click();
      await page.waitForURL("**/deals**", { timeout: 300_000 });
      console.log("✅ Authenticated!\n");
      await sleep(2000);
    }

    // Use provided deal ID or create a new one
    let dealId = process.env.DEAL_ID || "";
    if (!dealId) {
      dealId = await createDeal(page);
    } else {
      console.log(`📋 Using existing deal: ${dealId}`);
    }

    // ─── Progressive context ingestion + touch generation ───

    console.log("\n" + "─".repeat(55));
    console.log("Starting touch generation with progressive context...");
    console.log("─".repeat(55));

    // Before Touch 1: ingest company overview context
    // Navigate to a deal page first so the API calls have auth cookies
    await page.goto(`${BASE_URL}/deals/${dealId}/touch/1`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await sleep(3000);
    await ingestContext(
      page,
      dealId,
      TOUCH_1_CONTEXT,
      "touch_1",
      "Meridian Health Partners — Company Overview & Pain Points"
    );

    const touch1Url = await runTouch(
      page,
      dealId,
      1,
      "First Contact Pager"
    );

    // Before Touch 2: ingest technology landscape context
    await page.goto(`${BASE_URL}/deals/${dealId}/touch/2`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await sleep(2000);
    await ingestContext(
      page,
      dealId,
      TOUCH_2_CONTEXT,
      "touch_2",
      "Technology Landscape & Organizational Dynamics"
    );

    const touch2Url = await runTouch(page, dealId, 2, "Meet Lumenalta");

    // Before Touch 3: ingest capability-specific context
    await page.goto(`${BASE_URL}/deals/${dealId}/touch/3`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await sleep(2000);
    await ingestContext(
      page,
      dealId,
      TOUCH_3_CONTEXT,
      "touch_3",
      "Capability Requirements — Data Engineering + AI/ML"
    );

    const touch3Url = await runTouch(
      page,
      dealId,
      3,
      "Capability Alignment"
    );

    // Touch 4: transcript ingestion via form (built into workflow)
    const touch4 = await runTouch4(page, dealId);

    // Summary
    console.log("\n" + "=".repeat(55));
    console.log("🎉 RESULTS — Meridian Health Partners\n");
    console.log(`Touch 1 (Pager):             ${touch1Url}`);
    console.log(`Touch 2 (Meet Lumenalta):    ${touch2Url}`);
    console.log(`Touch 3 (Capability):        ${touch3Url}`);
    console.log(`Touch 4 (Proposal Deck):     ${touch4.deckUrl}`);
    console.log(`Touch 4 (Talk Track):        ${touch4.talkTrackUrl}`);
    console.log(`Touch 4 (Buyer FAQ):         ${touch4.faqUrl}`);
    console.log(`\nDeal: ${BASE_URL}/deals/${dealId}/overview`);

    fs.writeFileSync(
      "e2e-healthcare-results.json",
      JSON.stringify(
        {
          dealId,
          company: COMPANY_NAME,
          industry: INDUSTRY,
          subsector: SUBSECTOR,
          touch1: touch1Url,
          touch2: touch2Url,
          touch3: touch3Url,
          touch4_deck: touch4.deckUrl,
          touch4_talk_track: touch4.talkTrackUrl,
          touch4_faq: touch4.faqUrl,
        },
        null,
        2
      )
    );
  } catch (err) {
    console.error("\n❌", err);
    await page.screenshot({
      path: "e2e-healthcare-error.png",
      fullPage: true,
    });
  } finally {
    await context.close();
  }
}

main().catch(console.error);
