import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSlidesClient } from './lib/google-auth';

const GENERATED_ID = '1Rwkg7DeiuiAA-P7GGa9d73_eyVWj8QNQ4qja5iLXzVE';
const OUTPUT_DIR = '/tmp/touch3-audit/generated';

async function main() {
  const slides = getSlidesClient();

  console.log(`Presentation ID: ${GENERATED_ID}`);

  const pres = await slides.presentations.get({ presentationId: GENERATED_ID });
  const slidesList = pres.data.slides ?? [];
  console.log(`Total slides: ${slidesList.length}`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const objectIds: string[] = [];

  for (let i = 0; i < slidesList.length; i++) {
    const slide = slidesList[i];
    const objectId = slide.objectId!;
    objectIds.push(objectId);
    console.log(`  Slide ${i + 1}: objectId=${objectId}`);

    try {
      const thumb = await slides.presentations.pages.getThumbnail({
        presentationId: GENERATED_ID,
        pageObjectId: objectId,
        'thumbnailProperties.thumbnailSize': 'LARGE',
      });
      const url = thumb.data.contentUrl;
      if (url) {
        const resp = await fetch(url);
        const buf = Buffer.from(await resp.arrayBuffer());
        const filePath = join(OUTPUT_DIR, `slide_${String(i + 1).padStart(2, '0')}_${objectId}.png`);
        writeFileSync(filePath, buf);
        console.log(`    -> Saved thumbnail (${buf.length} bytes)`);
      } else {
        console.log(`    -> No contentUrl returned`);
      }
    } catch (err: any) {
      console.log(`    -> ERROR fetching thumbnail: ${err.message}`);
    }
  }

  console.log(`\n========== SUMMARY ==========`);
  console.log(`Total slide count: ${slidesList.length}`);
  console.log(`Object IDs: ${objectIds.join(', ')}`);
  console.log(`Thumbnails saved to: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
