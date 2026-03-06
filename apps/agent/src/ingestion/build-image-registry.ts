/**
 * Build Image Registry
 *
 * Discovers and catalogs curated image assets (headshots, logos, icons)
 * from the Hack-a-thon Google Drive folder into the ImageAsset Prisma table.
 *
 * Run: npx tsx apps/agent/src/ingestion/build-image-registry.ts
 *
 * Design decisions:
 * - Curated subset only: leadership headshots, company logos, key brand icons
 * - Skips stock photos, duplicates, and the bulk of ~9,000 files in 01 Resources
 * - Idempotent: uses upsert on driveFileId (unique key) so re-runs don't create duplicates
 * - Images served from Google Drive URLs (no GCS/public URL setup)
 */

import { prisma } from '../lib/db'
import { getDriveClient } from '../lib/google-auth'
import { env } from '../env'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

// Image mimeTypes we care about
const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/gif',
  'image/webp',
])

// Folder name patterns that indicate curated brand assets
const CATEGORY_PATTERNS: Array<{
  pattern: RegExp
  category: 'headshot' | 'logo' | 'icon' | 'brand_element'
  tags: string[]
}> = [
  {
    pattern: /headshot|head\s*shot/i,
    category: 'headshot',
    tags: ['headshot', 'people'],
  },
  {
    pattern: /team|leadership|executive|people/i,
    category: 'headshot',
    tags: ['leadership', 'people'],
  },
  {
    pattern: /logo/i,
    category: 'logo',
    tags: ['logo', 'branding'],
  },
  {
    pattern: /brand(?!ed\s*basics)/i,
    category: 'brand_element',
    tags: ['brand', 'branding'],
  },
  {
    pattern: /icon/i,
    category: 'icon',
    tags: ['icon'],
  },
]

// Skip patterns: files that look like duplicates or stock photos
const SKIP_PATTERNS = [
  /\(\d+\)\.\w+$/, // "John Smith (1).jpg" — duplicate with numeric suffix
  /copy\s*\d*/i, // "logo copy.png"
  /stock|getty|istock|shutterstock|unsplash/i, // stock photo indicators
  /thumbnail|thumb|preview/i, // thumbnail variants
]

interface DriveFile {
  id: string
  name: string
  mimeType: string
}

interface DriveFolder {
  id: string
  name: string
  path: string // Reconstructed path for tag derivation
}

interface CuratedAsset {
  driveFileId: string
  name: string
  cleanName: string
  category: 'headshot' | 'logo' | 'icon' | 'brand_element'
  driveUrl: string
  mimeType: string
  tags: string[]
  folderPath: string
}

interface RegistryReport {
  generatedAt: string
  totalDiscovered: number
  totalCurated: number
  totalSkipped: number
  byCategory: Record<string, number>
  items: Array<{
    name: string
    category: string
    driveUrl: string
    tags: string[]
  }>
}

/**
 * List all subfolders in a given folder, with pagination support.
 */
async function listSubfolders(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient()
  const folders: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    })

    for (const file of response.data.files ?? []) {
      folders.push({
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
      })
    }

    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return folders
}

/**
 * List all image files in a given folder, with pagination support.
 */
async function listImageFiles(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient()
  const files: DriveFile[] = []
  let pageToken: string | undefined

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    })

    for (const file of response.data.files ?? []) {
      if (file.mimeType && IMAGE_MIME_TYPES.has(file.mimeType)) {
        files.push({
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
        })
      }
    }

    pageToken = response.data.nextPageToken ?? undefined
  } while (pageToken)

  return files
}

/**
 * Determine if a folder name matches any curated category pattern.
 */
function matchCategory(
  folderName: string,
  folderPath: string
): { category: CuratedAsset['category']; tags: string[] } | null {
  // Check path segments too (e.g., "Leadership/Headshots")
  const searchText = `${folderPath} ${folderName}`

  for (const { pattern, category, tags } of CATEGORY_PATTERNS) {
    if (pattern.test(searchText)) {
      return { category, tags }
    }
  }
  return null
}

/**
 * Check if a file should be skipped (duplicate, stock photo, etc.)
 */
function shouldSkip(fileName: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pattern.test(fileName))
}

/**
 * Clean a file name for use as the asset name.
 * Removes extension, cleans up formatting.
 */
function cleanAssetName(fileName: string): string {
  return (
    fileName
      // Remove file extension
      .replace(/\.\w+$/, '')
      // Replace underscores and hyphens with spaces
      .replace(/[_-]+/g, ' ')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Construct a Google Drive view URL from a file ID.
 */
function driveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`
}

/**
 * Derive tags from the folder path.
 * e.g., "Leadership/Headshots" -> ["leadership", "headshots"]
 */
function deriveTags(folderPath: string, baseTags: string[]): string[] {
  const pathTags = folderPath
    .split('/')
    .map((segment) => segment.toLowerCase().trim())
    .filter((segment) => segment.length > 0 && segment !== '01 resources')

  // Combine, deduplicate, sort
  const allTags = [...new Set([...baseTags, ...pathTags])]
  return allTags.sort()
}

/**
 * Recursively discover curated image folders and their files.
 */
async function discoverCuratedFolders(
  parentId: string,
  parentPath: string,
  depth: number = 0
): Promise<DriveFolder[]> {
  // Limit recursion depth to prevent runaway traversal
  if (depth > 4) return []

  const subfolders = await listSubfolders(parentId)
  const curatedFolders: DriveFolder[] = []

  // Rate limiting: small delay between Drive API calls
  await sleep(100)

  for (const folder of subfolders) {
    const folderPath = parentPath ? `${parentPath}/${folder.name}` : folder.name
    const match = matchCategory(folder.name, folderPath)

    if (match) {
      curatedFolders.push({
        id: folder.id,
        name: folder.name,
        path: folderPath,
      })
    }

    // Recurse into subfolders to find nested curated folders
    const nestedFolders = await discoverCuratedFolders(
      folder.id,
      folderPath,
      depth + 1
    )
    curatedFolders.push(...nestedFolders)

    // Rate limiting between folder discovery
    await sleep(100)
  }

  return curatedFolders
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Main: discover, curate, and register image assets.
 */
async function main() {
  console.log('=== Build Image Registry ===')
  console.log(`Drive folder: ${env.GOOGLE_DRIVE_FOLDER_ID}`)
  console.log('')

  // Step 1: Discover curated folders
  console.log('Step 1: Discovering curated image folders...')
  const curatedFolders = await discoverCuratedFolders(
    env.GOOGLE_DRIVE_FOLDER_ID,
    ''
  )

  if (curatedFolders.length === 0) {
    console.log(
      'No curated image folders found. Check folder structure and naming patterns.'
    )
    console.log(
      'Expected folders with names containing: headshot, team, leadership, logo, brand, icon'
    )
    // Write empty report
    const report: RegistryReport = {
      generatedAt: new Date().toISOString(),
      totalDiscovered: 0,
      totalCurated: 0,
      totalSkipped: 0,
      byCategory: { headshot: 0, logo: 0, icon: 0, brand_element: 0 },
      items: [],
    }
    writeReport(report)
    return
  }

  console.log(`Found ${curatedFolders.length} curated folder(s):`)
  for (const folder of curatedFolders) {
    console.log(`  - ${folder.path} (${folder.id})`)
  }
  console.log('')

  // Step 2: List image files in each curated folder
  console.log('Step 2: Listing image files in curated folders...')
  let totalDiscovered = 0
  let totalSkipped = 0
  const curatedAssets: CuratedAsset[] = []

  for (const folder of curatedFolders) {
    const match = matchCategory(folder.name, folder.path)
    if (!match) continue

    const files = await listImageFiles(folder.id)
    totalDiscovered += files.length

    for (const file of files) {
      if (shouldSkip(file.name)) {
        totalSkipped++
        continue
      }

      const cleanName = cleanAssetName(file.name)
      const tags = deriveTags(folder.path, match.tags)

      curatedAssets.push({
        driveFileId: file.id,
        name: file.name,
        cleanName,
        category: match.category,
        driveUrl: driveViewUrl(file.id),
        mimeType: file.mimeType,
        tags,
        folderPath: folder.path,
      })
    }

    // Rate limiting between folder scans
    await sleep(200)
  }

  console.log(
    `Discovered ${totalDiscovered} image files, curated ${curatedAssets.length}, skipped ${totalSkipped}`
  )
  console.log('')

  // Step 3: Upsert into Prisma ImageAsset table
  console.log('Step 3: Upserting into ImageAsset table...')
  const categoryCounts: Record<string, number> = {
    headshot: 0,
    logo: 0,
    icon: 0,
    brand_element: 0,
  }

  for (const asset of curatedAssets) {
    await prisma.imageAsset.upsert({
      where: { driveFileId: asset.driveFileId },
      create: {
        category: asset.category,
        name: asset.cleanName,
        description: `From ${asset.folderPath}`,
        driveFileId: asset.driveFileId,
        driveUrl: asset.driveUrl,
        mimeType: asset.mimeType,
        tags: JSON.stringify(asset.tags),
      },
      update: {
        category: asset.category,
        name: asset.cleanName,
        description: `From ${asset.folderPath}`,
        driveUrl: asset.driveUrl,
        mimeType: asset.mimeType,
        tags: JSON.stringify(asset.tags),
      },
    })

    categoryCounts[asset.category] = (categoryCounts[asset.category] ?? 0) + 1
  }

  console.log('Upsert complete.')
  console.log('')

  // Step 4: Summary
  console.log('=== Image Registry Summary ===')
  console.log(`Total discovered: ${totalDiscovered}`)
  console.log(`Total curated:    ${curatedAssets.length}`)
  console.log(`Total skipped:    ${totalSkipped}`)
  console.log('By category:')
  for (const [category, count] of Object.entries(categoryCounts)) {
    console.log(`  ${category}: ${count}`)
  }
  console.log('')

  // Step 5: Write report
  const report: RegistryReport = {
    generatedAt: new Date().toISOString(),
    totalDiscovered,
    totalCurated: curatedAssets.length,
    totalSkipped,
    byCategory: categoryCounts,
    items: curatedAssets.map((a) => ({
      name: a.cleanName,
      category: a.category,
      driveUrl: a.driveUrl,
      tags: a.tags,
    })),
  }
  writeReport(report)

  console.log('=== Done ===')
}

/**
 * Write the registry report to a JSON file.
 */
function writeReport(report: RegistryReport): void {
  const reportPath = join(
    dirname(new URL(import.meta.url).pathname),
    'manifest',
    'image-registry-report.json'
  )
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
  console.log(`Report written to: ${reportPath}`)
}

// Run
main()
  .catch((err) => {
    console.error('Image registry build failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
