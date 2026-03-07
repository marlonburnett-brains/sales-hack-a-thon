ALTER TABLE "Template"
ADD COLUMN IF NOT EXISTS "artifactType" TEXT;

ALTER TABLE "DeckStructure"
ADD COLUMN IF NOT EXISTS "artifactType" TEXT;

DELETE FROM "DeckStructure"
WHERE "touchType" = 'touch_4' AND "artifactType" IS NULL;

WITH ranked_null_rows AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "touchType"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS row_num
  FROM "DeckStructure"
  WHERE "artifactType" IS NULL AND "touchType" <> 'touch_4'
)
DELETE FROM "DeckStructure"
WHERE "id" IN (
  SELECT "id"
  FROM ranked_null_rows
  WHERE row_num > 1
);

DROP INDEX IF EXISTS "DeckStructure_touchType_key";

CREATE UNIQUE INDEX IF NOT EXISTS "DeckStructure_touchType_artifactType_key"
ON "DeckStructure"("touchType", "artifactType");

CREATE UNIQUE INDEX IF NOT EXISTS "DeckStructure_non_touch4_null_artifact_key"
ON "DeckStructure"("touchType")
WHERE "artifactType" IS NULL AND "touchType" <> 'touch_4';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Template_artifactType_check'
      AND conrelid = '"Template"'::regclass
  ) THEN
    ALTER TABLE "Template"
    ADD CONSTRAINT "Template_artifactType_check"
    CHECK (
      "artifactType" IS NULL
      OR "artifactType" IN ('proposal', 'talk_track', 'faq')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DeckStructure_artifactType_check'
      AND conrelid = '"DeckStructure"'::regclass
  ) THEN
    ALTER TABLE "DeckStructure"
    ADD CONSTRAINT "DeckStructure_artifactType_check"
    CHECK (
      "artifactType" IS NULL
      OR "artifactType" IN ('proposal', 'talk_track', 'faq')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DeckStructure_touch4_requires_artifact_check'
      AND conrelid = '"DeckStructure"'::regclass
  ) THEN
    ALTER TABLE "DeckStructure"
    ADD CONSTRAINT "DeckStructure_touch4_requires_artifact_check"
    CHECK (
      "touchType" <> 'touch_4'
      OR "artifactType" IS NOT NULL
    );
  END IF;
END $$;
