import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding demo data...");

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
