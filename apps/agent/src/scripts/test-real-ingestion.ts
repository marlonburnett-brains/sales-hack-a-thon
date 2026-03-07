/**
 * Test real ingestion on the actual template
 * Run: npx tsx --env-file=.env src/scripts/test-real-ingestion.ts
 */
import { ingestTemplate } from "../ingestion/ingest-template";

async function main() {
  const templateId = "cmmfi92ra0002vd8klc45avv3";
  console.log(`Starting real ingestion for template ${templateId}...`);
  try {
    const result = await ingestTemplate(templateId);
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err: unknown) {
    const e = err as Error;
    console.error("Ingestion failed:", e.message);
    console.error("Stack:", e.stack);
  }
  process.exit(0);
}

main();
