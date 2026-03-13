import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSlidesClient } from './lib/google-auth';
import { prisma } from './lib/db';

const GENERATED_ID = '1xiR_SHgfnWmg2tzJwoegSx_gMbNGJq6tb_svjAgFTe0';
const OUTPUT_DIR = '/tmp/touch2-audit';

async function fetchThumbnails(presentationId: string, label: string, outDir: string) {
  const slides = getSlidesClient();

  console.log(`\n========== ${label} ==========`);
  console.log(`Presentation ID: ${presentationId}`);

  const pres = await slides.presentations.get({ presentationId });
  const slidesList = pres.data.slides ?? [];
  console.log(`Total slides: ${slidesList.length}`);

  mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < slidesList.length; i++) {
    const slide = slidesList[i];
    const objectId = slide.objectId!;
    console.log(`  Slide ${i + 1}: objectId=${objectId}`);

    try {
      const thumb = await slides.presentations.pages.getThumbnail({
        presentationId,
        pageObjectId: objectId,
        'thumbnailProperties.thumbnailSize': 'LARGE',
      });
      const url = thumb.data.contentUrl;
      if (url) {
        const resp = await fetch(url);
        const buf = Buffer.from(await resp.arrayBuffer());
        const filePath = join(outDir, `slide_${String(i + 1).padStart(2, '0')}_${objectId}.png`);
        writeFileSync(filePath, buf);
        console.log(`    -> Saved thumbnail (${buf.length} bytes) to ${filePath}`);
      } else {
        console.log(`    -> No contentUrl returned`);
      }
    } catch (err: any) {
      console.log(`    -> ERROR fetching thumbnail: ${err.message}`);
    }
  }

  return slidesList.length;
}

async function main() {
  // 1) Fetch and save thumbnails for the generated presentation
  await fetchThumbnails(GENERATED_ID, 'GENERATED Touch 2 Presentation', join(OUTPUT_DIR, 'generated'));

  // 2) Query Template table for touch_2 templates
  console.log('\n========== Template DB Query ==========');
  const templates = await prisma.template.findMany({
    where: {
      touchTypes: { contains: 'touch_2' },
    },
    orderBy: { updatedAt: 'desc' },
  });

  console.log(`Found ${templates.length} touch_2 template(s) in Template table:`);
  for (const t of templates) {
    console.log(`  - ${t.name} | presentationId=${t.presentationId} | slideCount=${t.slideCount} | classification=${t.contentClassification} | artifact=${t.artifactType}`);
  }

  // 3) Query SlideEmbedding for touch_2 related entries
  console.log('\n========== SlideEmbedding DB Query ==========');
  // Get distinct templateIds that have touch_2 templates
  const templateIds = templates.map(t => t.presentationId);
  if (templateIds.length > 0) {
    for (const tid of templateIds) {
      const count = await prisma.slideEmbedding.count({ where: { templateId: tid } });
      const withThumbs = await prisma.slideEmbedding.count({ where: { templateId: tid, thumbnailUrl: { not: null } } });
      console.log(`  templateId=${tid}: ${count} embeddings, ${withThumbs} with thumbnails`);

      // Show first few thumbnail URLs
      const samples = await prisma.slideEmbedding.findMany({
        where: { templateId: tid, thumbnailUrl: { not: null } },
        select: { slideIndex: true, slideObjectId: true, thumbnailUrl: true },
        take: 3,
        orderBy: { slideIndex: 'asc' },
      });
      for (const s of samples) {
        console.log(`    slide ${s.slideIndex} (${s.slideObjectId}): ${s.thumbnailUrl}`);
      }
    }
  }

  // 4) Fetch thumbnails for the primary template too (first one)
  if (templates.length > 0) {
    const primary = templates[0];
    try {
      await fetchThumbnails(primary.presentationId, `TEMPLATE: ${primary.name}`, join(OUTPUT_DIR, 'template'));
    } catch (err: any) {
      console.log(`  -> Could not fetch template thumbnails: ${err.message}`);
    }
  }

  console.log('\n========== AUDIT COMPLETE ==========');
  console.log(`All outputs saved to: ${OUTPUT_DIR}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
