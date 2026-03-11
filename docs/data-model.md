# Data Model

## Overview

The business data model lives in `apps/agent/prisma/schema.prisma`.

It covers:

- deals and workflow interactions
- generated artifacts and approvals
- chat persistence
- template and slide ingestion
- deck intelligence
- encrypted integration tokens
- prompt configuration

## Core Deal Models

### `Company`

Stores customer organizations.

Fields of note:

- `name`
- `industry`
- `logoUrl`

Relations:

- one company has many deals

### `Deal`

The primary business object for seller work.

Fields of note:

- `companyId`
- `name`
- `salespersonName`
- `salespersonPhoto`
- `driveFolderId`
- `status`
- `ownerId`, `ownerEmail`, `ownerName`
- `collaborators` as JSON string

Relations:

- belongs to a company
- has many `InteractionRecord`
- has one `DealChatThread`
- has many `DealContextSource`

### `InteractionRecord`

Represents a single pre-call or touch workflow run.

Fields of note:

- `touchType`
- `status`
- `inputs`
- `decision`
- `generatedContent`
- `outputRefs`
- `driveFileId`
- `hitlStage`
- `stageContent`

Relations:

- belongs to a deal
- has many `FeedbackSignal`
- may have one `Transcript`
- may have one `Brief`
- may have many `DealContextSource`

## Touch 4 Models

### `Transcript`

Stores raw transcript text plus the six extracted or reviewed fields.

Important fields:

- `rawText`
- `additionalNotes`
- `subsector`
- `customerContext`
- `businessOutcomes`
- `constraints`
- `stakeholders`
- `timeline`
- `budget`

### `Brief`

Stores the structured sales brief derived from the transcript.

Important fields:

- `primaryPillar`
- `secondaryPillars`
- `evidence`
- structured business fields
- `useCases`
- `roiFraming`
- approval fields such as `approvalStatus`, `reviewerName`, `approvedAt`, `rejectionFeedback`
- `workflowRunId`

## Feedback And Chat Models

### `FeedbackSignal`

Captures approval, rejection, edits, uploads, and other interaction feedback.

Fields of note:

- `signalType`
- `source`
- `content`

### `DealChatThread`

One thread per deal.

Fields of note:

- `dealId`
- `promptSummary`

### `DealChatMessage`

Stores chat history with route context.

Fields of note:

- `role`
- `content`
- `routeSection`
- `routeTouchType`
- `routePathname`
- `routePageLabel`
- `metaJson`

### `DealContextSource`

Stores notes or transcript-derived text that can be bound to a deal or touch.

Fields of note:

- `sourceType`
- `touchType`
- `interactionId`
- `originPage`
- `rawText`
- `refinedText`
- `status`
- `bindingMetaJson`

## Template And Slide Models

### `Template`

Represents a Google Slides presentation tracked by the system.

Fields of note:

- `name`
- `presentationId`
- `googleSlidesUrl`
- `touchTypes`
- `accessStatus`
- `lastIngestedAt`
- `sourceModifiedAt`
- `slideCount`
- `ingestionStatus`
- `ingestionProgress`
- `contentClassification`
- `artifactType`

### `SlideEmbedding`

Stores slide-level content, metadata, and embeddings for retrieval.

Fields of note:

- `templateId`
- `slideIndex`
- `slideObjectId`
- `contentText`
- `speakerNotes`
- `embedding` as `vector(768)`
- classification fields and `classificationJson`
- `confidence`
- `contentHash`
- `thumbnailUrl`
- `description`
- `reviewStatus`
- `archived`, `needsReReview`

### `SlideElement`

Stores layout and text structure extracted from Slides API responses.

Fields of note:

- `elementId`
- `elementType`
- geometry fields
- `contentText`
- typography metadata like `fontSize`, `fontColor`, `isBold`

## Deck Intelligence Models

### `DeckStructure`

Stores inferred section flow by touch type and optional artifact type.

Fields of note:

- `touchType`
- `artifactType`
- `structureJson`
- `exampleCount`
- `confidence`
- `chatContextJson`
- `dataHash`
- `inferredAt`
- `lastChatAt`

### `DeckChatMessage`

Stores chat refinement history for deck structures.

Fields of note:

- `role`
- `content`
- `structureDiff`

## Integration And Settings Models

### `UserGoogleToken`

Encrypted per-user Google refresh-token storage.

### `UserAtlusToken`

Encrypted per-user AtlusAI token storage.

### `UserSetting`

Generic per-user key/value store. Used for values like Drive root folder overrides.

### `ActionRequired`

Tracks manual remediation steps needed by users or admins.

Important fields:

- `userId`
- `actionType`
- `title`
- `description`
- `resourceId`
- `resolved`, `silenced`, `seenAt`

## Prompt Management Models

### `AgentConfig`

Stable identity record for a named agent.

Fields of note:

- `agentId`
- `name`
- `responsibility`
- `family`
- `isShared`
- `touchTypes`
- `status`
- `publishedVersionId`

### `AgentConfigVersion`

Immutable version history for prompts.

Fields of note:

- `version`
- `baselinePrompt`
- `rolePrompt`
- `compiledPrompt`
- `changeSummary`
- `isPublished`
- `publishedAt`
- `publishedBy`

## Other Supporting Models

### `WorkflowJob`

Generic application-level job tracking model used by early phases.

### `ImageAsset`

Registry of reusable brand or imagery assets from Drive.

### `ContentSource`

Tracks discovered Drive sources and their accessibility state.

### `DiscoveryDocCache`

Caches AtlusAI document to Drive-file resolution so repeated lookups do not keep hitting the Drive API.

## Migration Discipline

Project rules for schema changes:

- use Prisma migrations, not `prisma db push`
- do not reset the database
- commit migration files with schema changes
- use `prisma migrate resolve` for baseline or drift remediation when needed
