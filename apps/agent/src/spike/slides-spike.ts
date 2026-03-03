// apps/agent/src/spike/slides-spike.ts
// Phase 1 spike: De-risk Google Slides API placeholder ID resolution + batchUpdate pattern
// This script is a one-time validation exercise — NOT production code.
// Success criteria: batchUpdate executes without error using dynamic objectIds from presentations.get

import { getSlidesClient, getDriveClient, verifyGoogleAuth } from '../lib/google-auth'
import { env } from '../env'

async function runSpike() {
  console.log('=== Google Slides API Spike ===')
  console.log('Phase 1: De-risking placeholder ID resolution and batchUpdate ordering')
  console.log('')

  // Step 1: Verify auth
  console.log('Step 1: Verifying Google service account auth...')
  const authOk = await verifyGoogleAuth()
  if (!authOk) {
    throw new Error('Google auth failed — check GOOGLE_SERVICE_ACCOUNT_KEY in apps/agent/.env')
  }
  console.log('Auth: OK\n')

  // Step 2: Copy template to shared Drive folder
  console.log('Step 2: Copying Lumenalta template to shared Drive folder...')
  const driveClient = getDriveClient()
  const copyResponse = await driveClient.files.copy({
    fileId: env.GOOGLE_TEMPLATE_PRESENTATION_ID,
    requestBody: {
      name: `Spike Test — ${new Date().toISOString()}`,
      parents: [env.GOOGLE_DRIVE_FOLDER_ID],
    },
    // supportsAllDrives is required if the target folder is a Shared Drive
    supportsAllDrives: true,
  })
  const newPresentationId = copyResponse.data.id
  if (!newPresentationId) {
    throw new Error('Drive files.copy returned no ID — check GOOGLE_DRIVE_FOLDER_ID and folder sharing permissions')
  }
  console.log(`Copy created: https://docs.google.com/presentation/d/${newPresentationId}/edit`)
  console.log('')

  // Step 3: Read live placeholder objectIds from the copied presentation
  console.log('Step 3: Reading slide element objectIds from presentations.get...')
  const slidesClient = getSlidesClient()
  const presentation = await slidesClient.presentations.get({
    presentationId: newPresentationId,
  })

  // Log all slides and their elements to understand the template structure
  const slides = presentation.data.slides ?? []
  console.log(`Template has ${slides.length} slide(s)\n`)

  // Collect all element objectIds for use in batchUpdate
  const elementIds: string[] = []

  for (const [slideIndex, slide] of slides.entries()) {
    console.log(`Slide ${slideIndex + 1} (objectId: ${slide.objectId}):`)
    for (const element of slide.pageElements ?? []) {
      const placeholderType = element.shape?.placeholder?.type ?? 'none'
      const textContent = (element.shape?.text?.textElements ?? [])
        .map((te) => te.textRun?.content ?? '')
        .join('')
        .trim()
        .substring(0, 60)

      console.log(`  Element objectId: ${element.objectId}`)
      console.log(`  Placeholder type: ${placeholderType}`)
      if (textContent) console.log(`  Current text: "${textContent}"`)

      if (element.objectId) {
        elementIds.push(element.objectId)
      }
    }
    console.log('')

    // Only process first slide to keep spike output manageable
    if (slideIndex === 0) break
  }

  if (elementIds.length === 0) {
    throw new Error('No element objectIds found in first slide — template may have no pageElements')
  }

  // Step 4: Insert text using a live objectId (CRITICAL: must be dynamic, not hardcoded)
  const targetObjectId = elementIds[0]
  console.log(`Step 4: Inserting text into element objectId: ${targetObjectId} (read from API response — NOT hardcoded)`)

  await slidesClient.presentations.batchUpdate({
    presentationId: newPresentationId,
    requestBody: {
      requests: [
        {
          insertText: {
            objectId: targetObjectId, // Dynamic from presentations.get — satisfies spike success criterion
            text: 'Inserted by Phase 1 spike',
            insertionIndex: 0,
          },
        },
      ],
    },
  })

  console.log('batchUpdate: OK — insertText executed without error\n')
  console.log('=== SPIKE COMPLETE ===')
  console.log(`View result at: https://docs.google.com/presentation/d/${newPresentationId}/edit`)
  console.log('')
  console.log('Phase 1 success criteria verified:')
  console.log('  [x] Service account authenticated')
  console.log('  [x] Template copied to shared Drive folder')
  console.log('  [x] Placeholder objectIds read from live presentations.get response')
  console.log('  [x] Text inserted using dynamic objectId (not hardcoded)')
  console.log('  [x] batchUpdate completed without error')
}

runSpike().catch((err) => {
  console.error('Spike failed:', err.message)
  if (err.response?.data) {
    console.error('API error details:', JSON.stringify(err.response.data, null, 2))
  }
  process.exit(1)
})
