import "dotenv/config";
import { google } from "googleapis";
import * as fs from "fs";
import * as path from "path";

const PRESENTATION_ID = "1AWAPRhS0FkskSb5DBxQ1XEvoj-bz-FKaGV4EB4tLUiA";
const OUTPUT_DIR = "/tmp/touch4-audit/generated";

async function main() {
  // Use GOOGLE_SERVICE_ACCOUNT_KEY for read-only doc access
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}");
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/presentations.readonly"],
  });
  
  const slides = google.slides({ version: "v1", auth });
  const presentation = await slides.presentations.get({ presentationId: PRESENTATION_ID });
  const slideList = presentation.data.slides || [];
  
  console.log(`Found ${slideList.length} slides in Touch 4 deck`);
  
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  
  for (let i = 0; i < slideList.length; i++) {
    const slide = slideList[i];
    const slideId = slide.objectId;
    const thumbUrl = `https://slides.googleapis.com/v1/presentations/${PRESENTATION_ID}/pages/${slideId}/thumbnail?thumbnailProperties.mimeType=PNG&thumbnailProperties.thumbnailSize=LARGE`;
    
    const authClient = await auth.getClient() as any;
    const resp = await authClient.request({ url: thumbUrl, responseType: "arraybuffer" });
    
    const filename = path.join(OUTPUT_DIR, `slide_${String(i + 1).padStart(2, "0")}.png`);
    fs.writeFileSync(filename, Buffer.from(resp.data));
    console.log(`  Saved slide ${i + 1}/${slideList.length}: ${filename}`);
  }
  
  console.log(`\nAll ${slideList.length} thumbnails saved to ${OUTPUT_DIR}`);
}

main().catch(console.error);
