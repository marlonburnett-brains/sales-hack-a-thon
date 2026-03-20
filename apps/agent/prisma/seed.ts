import * as fs from "node:fs";
import * as path from "node:path";

import { PrismaClient } from "@prisma/client";

import { seedPublishedAgentCatalog } from "../src/lib/agent-catalog-defaults";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding demo data...");

  await seedPublishedAgentCatalog(prisma, new Date());
  console.log("Named agent catalog: published version-1 defaults seeded.");

  // Financial Services demo company (upsert = idempotent)
  const company = await prisma.company.upsert({
    where: { name: "Meridian Capital Group" },
    update: {},
    create: {
      name: "Meridian Capital Group",
      industry: "Financial Services",
    },
  });
  console.log(`Company: ${company.name} (${company.id})`);

  // Check for existing demo deal to prevent duplicates
  const existingDeals = await prisma.deal.findMany({
    where: {
      companyId: company.id,
      name: "Enterprise Digital Transformation - Q1 2026",
    },
  });

  let deal;
  if (existingDeals.length > 0) {
    deal = existingDeals[0];
    console.log(`Deal already exists: ${deal.name} (${deal.id})`);
  } else {
    deal = await prisma.deal.create({
      data: {
        companyId: company.id,
        name: "Enterprise Digital Transformation - Q1 2026",
        salespersonName: "Alex Chen",
      },
    });
    console.log(`Deal created: ${deal.name} (${deal.id})`);
  }

  // Pre-seed a Touch 1 interaction (shows cross-touch context in later flows)
  const existingInteractions = await prisma.interactionRecord.findMany({
    where: { dealId: deal.id, touchType: "touch_1" },
  });

  if (existingInteractions.length === 0) {
    const interaction = await prisma.interactionRecord.create({
      data: {
        dealId: deal.id,
        touchType: "touch_1",
        status: "approved",
        decision: "approved",
        inputs: JSON.stringify({
          companyName: "Meridian Capital Group",
          industry: "Financial Services",
          context:
            "Enterprise payment infrastructure modernization. Legacy monolithic system processing 850K transactions/month needs cloud-native upgrade for real-time settlement.",
        }),
        generatedContent: JSON.stringify({
          headline: "Modernize Payment Infrastructure with Lumenalta",
          valueProposition:
            "Reduce transaction latency by 70% and enable real-time settlement while maintaining PCI DSS compliance through cloud-native microservices architecture.",
          keyCapabilities: [
            "Cloud-native payment processing with sub-100ms latency",
            "Automated PCI DSS compliance monitoring and reporting",
            "Zero-downtime migration strategy with backward-compatible APIs",
          ],
          callToAction:
            "Schedule a technical deep-dive to map your current architecture to a phased modernization roadmap.",
        }),
        outputRefs: JSON.stringify([
          "https://docs.google.com/presentation/d/demo-touch1-meridian/edit",
        ]),
      },
    });
    console.log(`Touch 1 interaction seeded: ${interaction.id}`);
  } else {
    console.log("Touch 1 interaction already exists, skipping.");
  }

  // ── Content Sources: known presentations from CONTENT_TYPE_OVERRIDES ──
  // These are the known Drive content targets. Discovery pipeline will update
  // accessStatus and driveFileId on each run.

  const knownSources: Array<{
    name: string;
    sourceType: string;
    contentType: string;
    touchTypes: string[];
  }> = [
    { name: "Two Pager Template", sourceType: "presentation", contentType: "template", touchTypes: ["touch_1"] },
    { name: "Meet Lumenalta", sourceType: "presentation", contentType: "template", touchTypes: ["touch_2"] },
    { name: "NBCUniversal", sourceType: "presentation", contentType: "example", touchTypes: ["touch_2"] },
    { name: "Bleecker Street Group", sourceType: "presentation", contentType: "example", touchTypes: ["touch_2"] },
    { name: "Master Solutions", sourceType: "presentation", contentType: "template", touchTypes: ["touch_3"] },
    { name: "2026 GTM Solutions", sourceType: "presentation", contentType: "template", touchTypes: ["touch_3"] },
    { name: "200A Master Deck", sourceType: "presentation", contentType: "template", touchTypes: ["touch_3"] },
    { name: "Alaska Airlines", sourceType: "presentation", contentType: "example", touchTypes: ["touch_4"] },
    { name: "MasterControl", sourceType: "presentation", contentType: "example", touchTypes: ["touch_4"] },
    { name: "Encompass", sourceType: "presentation", contentType: "example", touchTypes: ["touch_4"] },
    { name: "WSA", sourceType: "presentation", contentType: "example", touchTypes: ["touch_4"] },
    { name: "Satellite Industries", sourceType: "presentation", contentType: "example", touchTypes: ["touch_4"] },
    { name: "Gravie", sourceType: "presentation", contentType: "example", touchTypes: ["touch_4"] },
    { name: "L2 Capability Decks", sourceType: "folder", contentType: "template", touchTypes: ["touch_2", "touch_3"] },
    { name: "1-2 Pager Templates", sourceType: "folder", contentType: "template", touchTypes: ["touch_1"] },
    { name: "Case Study Decks", sourceType: "folder", contentType: "case_study", touchTypes: ["touch_4"] },
    { name: "Branded Basics", sourceType: "presentation", contentType: "brand_guide", touchTypes: [] },
  ];

  let seededCount = 0;
  for (const src of knownSources) {
    await prisma.contentSource.upsert({
      where: { name: src.name },
      update: {},
      create: {
        name: src.name,
        sourceType: src.sourceType,
        contentType: src.contentType,
        touchTypes: JSON.stringify(src.touchTypes),
        accessStatus: "not_accessible",
      },
    });
    seededCount++;
  }
  console.log(`Content sources: ${seededCount} known sources seeded (status: not_accessible)`);

  // ── Tutorials: seed from fixtures + manifest ──

  const TUTORIAL_CATALOG: Array<{
    slug: string;
    category: string;
    sortOrder: number;
  }> = [
    { slug: "getting-started", category: "getting_started", sortOrder: 1 },
    { slug: "deals", category: "deal_workflows", sortOrder: 2 },
    { slug: "deal-overview", category: "deal_workflows", sortOrder: 3 },
    { slug: "deal-chat", category: "deal_workflows", sortOrder: 4 },
    { slug: "briefing", category: "deal_workflows", sortOrder: 5 },
    { slug: "touch-1-pager", category: "touch_points", sortOrder: 6 },
    { slug: "touch-2-intro-deck", category: "touch_points", sortOrder: 7 },
    { slug: "touch-3-capability-deck", category: "touch_points", sortOrder: 8 },
    { slug: "touch-4-hitl", category: "touch_points", sortOrder: 9 },
    { slug: "template-library", category: "content_management", sortOrder: 10 },
    { slug: "slide-library", category: "content_management", sortOrder: 11 },
    { slug: "deck-structures", category: "content_management", sortOrder: 12 },
    { slug: "atlus-integration", category: "content_management", sortOrder: 13 },
    { slug: "asset-review", category: "review", sortOrder: 14 },
    { slug: "action-center", category: "review", sortOrder: 15 },
    { slug: "agent-prompts", category: "settings_admin", sortOrder: 16 },
    { slug: "google-drive-settings", category: "settings_admin", sortOrder: 17 },
  ];

  const manifestPath = path.resolve(
    __dirname,
    "../../tutorials/output/tutorials-manifest.json",
  );
  const thumbnailManifestPath = path.resolve(
    __dirname,
    "../../tutorials/output/tutorial-thumbnails-manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    console.warn(
      "tutorials-manifest.json not found -- run upload-to-gcs.ts first. Skipping tutorial seed.",
    );
  } else {
    const manifest: Array<{
      slug: string;
      gcsUrl: string;
      durationSec: number;
    }> = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    let thumbnailManifest: Array<{
      slug: string;
      thumbnailUrl: string;
    }> = [];

    if (!fs.existsSync(thumbnailManifestPath)) {
      console.warn(
        "tutorial-thumbnails-manifest.json not found -- continuing with thumbnailUrl: null.",
      );
    } else {
      thumbnailManifest = JSON.parse(
        fs.readFileSync(thumbnailManifestPath, "utf-8"),
      );
    }

    const manifestMap = new Map(manifest.map((m) => [m.slug, m]));
    const thumbnailManifestMap = new Map(
      thumbnailManifest.map((entry) => [entry.slug, entry]),
    );
    let tutorialSeeded = 0;

    for (const entry of TUTORIAL_CATALOG) {
      // Read fixture script.json for title, description, stepCount
      const scriptPath = path.resolve(
        __dirname,
        `../../tutorials/fixtures/${entry.slug}/script.json`,
      );

      if (!fs.existsSync(scriptPath)) {
        console.warn(`  Fixture not found for ${entry.slug}, skipping`);
        continue;
      }

      const script: { title: string; description: string; steps: unknown[] } =
        JSON.parse(fs.readFileSync(scriptPath, "utf-8"));

      const manifestEntry = manifestMap.get(entry.slug);
      const thumbnailEntry = thumbnailManifestMap.get(entry.slug);
      if (!manifestEntry) {
        console.warn(`  Manifest entry not found for ${entry.slug}, skipping`);
        continue;
      }

      await prisma.tutorial.upsert({
        where: { slug: entry.slug },
        update: {
          title: script.title,
          description: script.description,
          category: entry.category,
          gcsUrl: manifestEntry.gcsUrl,
          thumbnailUrl: thumbnailEntry?.thumbnailUrl ?? null,
          durationSec: manifestEntry.durationSec,
          sortOrder: entry.sortOrder,
          stepCount: script.steps.length,
        },
        create: {
          slug: entry.slug,
          title: script.title,
          description: script.description,
          category: entry.category,
          gcsUrl: manifestEntry.gcsUrl,
          thumbnailUrl: thumbnailEntry?.thumbnailUrl ?? null,
          durationSec: manifestEntry.durationSec,
          sortOrder: entry.sortOrder,
          stepCount: script.steps.length,
        },
      });
      tutorialSeeded++;
    }

    console.log(`Tutorials: ${tutorialSeeded} of 17 seeded successfully`);
  }

  console.log("\nDemo data seeded successfully!");
  console.log(`\nDemo scenario ready:`);
  console.log(`  Company: Meridian Capital Group (Financial Services)`);
  console.log(`  Deal: Enterprise Digital Transformation - Q1 2026`);
  console.log(`  Salesperson: Alex Chen`);
  console.log(`  Pre-seeded: 1 approved Touch 1 interaction`);
  console.log(`  Content sources: ${seededCount} known Drive targets tracked`);
  console.log(`\nDemo flow: Pre-call -> Touch 1 -> Touch 2 -> Touch 3 -> Touch 4`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
