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

  console.log("\nDemo data seeded successfully!");
  console.log(`\nDemo scenario ready:`);
  console.log(`  Company: Meridian Capital Group (Financial Services)`);
  console.log(`  Deal: Enterprise Digital Transformation - Q1 2026`);
  console.log(`  Salesperson: Alex Chen`);
  console.log(`  Pre-seeded: 1 approved Touch 1 interaction`);
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
