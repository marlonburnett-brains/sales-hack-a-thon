/**
 * Ingest Brand Guidelines
 *
 * Finds and ingests the "Branded Basics" brand guidelines document from the
 * Hack-a-thon Google Drive folder into AtlusAI as a single whole-reference
 * document with content_type: brand_guide.
 *
 * Run: npx tsx apps/agent/src/ingestion/ingest-brand-guidelines.ts
 *
 * Design decisions (from RESEARCH.md recommendations):
 * - Keep as whole reference document, do NOT extract structured rules
 * - Single AtlusAI document with deterministic ID (hash of "brand-guidelines:{presentationId}")
 * - If it's a Google Slides presentation, extract ALL slides' text content as one concatenated doc
 * - If it's a Google Doc or PDF, attempt to read content via appropriate API
 *
 * Dependencies:
 * - getDriveClient() and getSlidesClient() from google-auth.ts (Phase 1)
 * - ingestDocument() from atlusai-client.ts (Plan 02-01) — optional, gracefully degrades
 */

import { createHash } from 'node:crypto'
import { getDriveClient, getSlidesClient } from '../lib/google-auth'
import { env } from '../env'

// AtlusAI project ID for the hack-a-thon knowledge base
const ATLUSAI_PROJECT_ID = 'b455bbd9-18c7-409d-8454-24e79591ee97'

// Search terms to find the brand guidelines document
const BRAND_GUIDE_SEARCH_TERMS = [
  'Branded Basics',
  'Brand Guide',
  'Brand Guidelines',
]

interface FoundDocument {
  id: string
  name: string
  mimeType: string
}

interface BrandGuidelineContent {
  documentId: string
  title: string
  content: string
  sourceFileId: string
  sourceMimeType: string
  metadata: {
    contentType: string
    industries: string[]
    touchType: string[]
    projectId: string
    sourceFileName: string
  }
}

/**
 * Search for the brand guidelines document in the Drive folder.
 */
async function findBrandGuidelinesDocument(): Promise<FoundDocument | null> {
  const drive = getDriveClient()

  for (const searchTerm of BRAND_GUIDE_SEARCH_TERMS) {
    console.log(`  Searching for "${searchTerm}"...`)

    let pageToken: string | undefined
    do {
      const response = await drive.files.list({
        q: `'${env.GOOGLE_DRIVE_FOLDER_ID}' in parents and name contains '${searchTerm}' and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType)',
        pageSize: 50,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageToken,
      })

      for (const file of response.data.files ?? []) {
        console.log(`  Found: "${file.name}" (${file.mimeType})`)
        return {
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
        }
      }

      pageToken = response.data.nextPageToken ?? undefined
    } while (pageToken)
  }

  // Also search recursively in subfolders
  console.log('  Searching in subfolders...')
  const subfolders = await listSubfoldersRecursive(env.GOOGLE_DRIVE_FOLDER_ID, 0)

  for (const folderId of subfolders) {
    for (const searchTerm of BRAND_GUIDE_SEARCH_TERMS) {
      const response = await getDriveClient().files.list({
        q: `'${folderId}' in parents and name contains '${searchTerm}' and trashed = false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 10,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })

      for (const file of response.data.files ?? []) {
        // Skip ingested slide docs -- we want the ORIGINAL presentation, not
        // a previously-created Google Doc from the _slide-level-ingestion folder.
        if (file.name?.startsWith('[SLIDE]')) continue

        console.log(`  Found in subfolder: "${file.name}" (${file.mimeType})`)
        return {
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
        }
      }
    }
  }

  return null
}

/**
 * Recursively list subfolder IDs (limited depth to avoid traversing 01 Resources).
 */
async function listSubfoldersRecursive(
  parentId: string,
  depth: number
): Promise<string[]> {
  if (depth > 2) return []

  const drive = getDriveClient()
  const folderIds: string[] = []
  let pageToken: string | undefined

  do {
    const response = await drive.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    })

    for (const file of response.data.files ?? []) {
      // Skip the massive 01 Resources folder and the ingestion output folder
      if (file.name?.includes('01 Resources')) continue
      if (file.name === '_slide-level-ingestion') continue

      folderIds.push(file.id!)
      const nested = await listSubfoldersRecursive(file.id!, depth + 1)
      folderIds.push(...nested)
    }

    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return folderIds
}

/**
 * Extract all text content from a Google Slides presentation.
 * Concatenates all slides' text into one document.
 */
async function extractSlidesContent(presentationId: string): Promise<string> {
  const slides = getSlidesClient()

  const response = await slides.presentations.get({
    presentationId,
  })

  const presentation = response.data
  const parts: string[] = []

  parts.push(`# ${presentation.title ?? 'Brand Guidelines'}`)
  parts.push('')

  for (let i = 0; i < (presentation.slides?.length ?? 0); i++) {
    const slide = presentation.slides![i]
    const slideTexts: string[] = []

    // Extract text from all page elements
    for (const element of slide.pageElements ?? []) {
      if (element.shape?.text?.textElements) {
        for (const te of element.shape.text.textElements) {
          if (te.textRun?.content) {
            slideTexts.push(te.textRun.content)
          }
        }
      }

      // Also check tables
      if (element.table) {
        for (const row of element.table.tableRows ?? []) {
          for (const cell of row.tableCells ?? []) {
            if (cell.text?.textElements) {
              for (const te of cell.text.textElements) {
                if (te.textRun?.content) {
                  slideTexts.push(te.textRun.content)
                }
              }
            }
          }
        }
      }
    }

    // Extract speaker notes
    const notesPage = slide.slideProperties?.notesPage
    let speakerNotes = ''
    if (notesPage) {
      const speakerNotesId = notesPage.notesProperties?.speakerNotesObjectId
      if (speakerNotesId) {
        const notesShape = notesPage.pageElements?.find(
          (el) => el.objectId === speakerNotesId
        )
        if (notesShape?.shape?.text?.textElements) {
          speakerNotes = notesShape.shape.text.textElements
            .filter((te) => te.textRun?.content)
            .map((te) => te.textRun!.content!)
            .join('')
            .trim()
        }
      }
    }

    const slideText = slideTexts.join('').trim()
    if (slideText || speakerNotes) {
      parts.push(`## Slide ${i + 1}`)
      if (slideText) {
        parts.push(slideText)
      }
      if (speakerNotes) {
        parts.push('')
        parts.push(`**Speaker Notes:** ${speakerNotes}`)
      }
      parts.push('')
    }
  }

  return parts.join('\n')
}

/**
 * Extract content from a Google Doc.
 */
async function extractDocContent(docId: string): Promise<string> {
  const drive = getDriveClient()

  // Export as plain text
  const response = await drive.files.export({
    fileId: docId,
    mimeType: 'text/plain',
  })

  return response.data as string
}

/**
 * Generate a deterministic document ID for the brand guidelines.
 */
function generateDocumentId(sourceFileId: string): string {
  return createHash('sha256')
    .update(`brand-guidelines:${sourceFileId}`)
    .digest('hex')
    .substring(0, 32)
}

/**
 * Extract content based on the file's MIME type.
 */
async function extractContent(doc: FoundDocument): Promise<string> {
  switch (doc.mimeType) {
    case 'application/vnd.google-apps.presentation':
      console.log('  Extracting from Google Slides presentation...')
      return extractSlidesContent(doc.id)

    case 'application/vnd.google-apps.document':
      console.log('  Extracting from Google Docs document...')
      return extractDocContent(doc.id)

    case 'application/pdf':
      console.log(
        '  PDF detected — cannot extract text directly. Will store reference only.'
      )
      return `[PDF Document: ${doc.name}]\n\nThis brand guidelines document is stored as a PDF in Google Drive. View it at: https://drive.google.com/file/d/${doc.id}/view`

    default:
      console.log(
        `  Unknown MIME type: ${doc.mimeType} — will attempt Drive export as text.`
      )
      try {
        return await extractDocContent(doc.id)
      } catch {
        return `[Document: ${doc.name}]\n\nCould not extract text content. View at: https://drive.google.com/file/d/${doc.id}/view`
      }
  }
}

/**
 * Ingest the brand guidelines into AtlusAI via Google Drive.
 *
 * Strategy: Create a Google Doc in the Hack-a-thon Drive folder.
 * AtlusAI monitors this folder and auto-indexes new documents.
 * This is the same mechanism used for slide-level ingestion (Plan 02-01).
 *
 * Gracefully handles the case where atlusai-client.ts is not yet available.
 */
async function ingestToAtlusAI(
  guidelineContent: BrandGuidelineContent
): Promise<boolean> {
  try {
    // Dynamic import — Plan 02-01 may or may not have created this module yet
    const { ingestDocument } = await import('../lib/atlusai-client.js')

    console.log('  AtlusAI client available. Ingesting brand guidelines...')

    // Create a SlideDocument-compatible object for the brand guidelines.
    // The brand guide is ingested as a single whole-reference document
    // (not split into slides), so slideIndex=0 and slideObjectId=brand-guide.
    const slideDoc = {
      documentId: guidelineContent.documentId,
      presentationId: guidelineContent.sourceFileId,
      presentationName: guidelineContent.title,
      slideObjectId: 'brand-guide',
      slideIndex: 0,
      folderPath: '_templates',
      textContent: guidelineContent.content,
      speakerNotes: '',
      isLowContent: false,
      metadata: guidelineContent.metadata,
    }

    const result = await ingestDocument(slideDoc, env.GOOGLE_DRIVE_FOLDER_ID)

    if (result.skipped) {
      console.log('  Brand guidelines document already exists in Drive (idempotent skip).')
    } else if (result.created) {
      console.log(`  Brand guidelines Google Doc created: ${result.docId}`)
    }

    console.log('  Brand guidelines ingested into AtlusAI successfully.')
    return true
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : String(err)

    if (
      errorMessage.includes('Cannot find module') ||
      errorMessage.includes('MODULE_NOT_FOUND') ||
      errorMessage.includes('ERR_MODULE_NOT_FOUND')
    ) {
      console.log('')
      console.log(
        '  WARNING: AtlusAI client not available yet (Plan 02-01 not complete).'
      )
      console.log(
        '  The brand guidelines content has been extracted but NOT ingested into AtlusAI.'
      )
      console.log(
        '  Re-run this script after Plan 02-01 completes to ingest into AtlusAI.'
      )
      console.log('')
      return false
    }

    // Some other error — log it but don't crash
    console.error('  AtlusAI ingestion failed:', errorMessage)
    console.log(
      '  Brand guidelines content extracted but NOT ingested into AtlusAI.'
    )
    console.log('  Re-run this script to retry AtlusAI ingestion.')
    return false
  }
}

/**
 * Main: find, extract, and ingest brand guidelines.
 */
async function main() {
  console.log('=== Ingest Brand Guidelines ===')
  console.log(`Drive folder: ${env.GOOGLE_DRIVE_FOLDER_ID}`)
  console.log('')

  // Step 1: Find the brand guidelines document
  console.log('Step 1: Searching for brand guidelines document...')
  const doc = await findBrandGuidelinesDocument()

  if (!doc) {
    console.log('')
    console.log(
      'ERROR: Brand guidelines document not found in Drive folder.'
    )
    console.log(
      'Expected a file named "Branded Basics", "Brand Guide", or "Brand Guidelines".'
    )
    console.log(
      'Verify the document exists in the Hack-a-thon Google Drive folder.'
    )
    process.exit(1)
  }

  console.log(`Found: "${doc.name}" (${doc.mimeType})`)
  console.log('')

  // Step 2: Extract content
  console.log('Step 2: Extracting content...')
  const content = await extractContent(doc)
  console.log(`  Extracted ${content.length} characters of text content.`)
  console.log('')

  // Step 3: Prepare the document for AtlusAI
  const documentId = generateDocumentId(doc.id)
  const guidelineContent: BrandGuidelineContent = {
    documentId,
    title: doc.name,
    content,
    sourceFileId: doc.id,
    sourceMimeType: doc.mimeType,
    metadata: {
      contentType: 'brand_guide',
      industries: ['all'],
      touchType: ['touch_1', 'touch_2', 'touch_3', 'touch_4'],
      projectId: ATLUSAI_PROJECT_ID,
      sourceFileName: doc.name,
    },
  }

  console.log(`Step 3: Document prepared with ID: ${documentId}`)
  console.log(`  Title: ${doc.name}`)
  console.log(`  Content length: ${content.length} chars`)
  console.log(
    `  Metadata: contentType=brand_guide, industries=all, touchType=all 4`
  )
  console.log('')

  // Step 4: Attempt AtlusAI ingestion
  console.log('Step 4: Attempting AtlusAI ingestion...')
  const ingested = await ingestToAtlusAI(guidelineContent)

  // Step 5: Summary
  console.log('=== Brand Guidelines Ingestion Summary ===')
  console.log(`Document: ${doc.name}`)
  console.log(`Source: ${doc.mimeType}`)
  console.log(`Document ID: ${documentId}`)
  console.log(`Content length: ${content.length} chars`)
  console.log(`AtlusAI ingested: ${ingested ? 'YES' : 'NO (deferred)'}`)

  if (!ingested) {
    console.log('')
    console.log('Next steps:')
    console.log(
      '  1. Complete Plan 02-01 (AtlusAI client setup)'
    )
    console.log(
      '  2. Re-run: npx tsx apps/agent/src/ingestion/ingest-brand-guidelines.ts'
    )
  }

  console.log('')
  console.log('=== Done ===')
}

// Run
main().catch((err) => {
  console.error('Brand guidelines ingestion failed:', err)
  process.exit(1)
})
