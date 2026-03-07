ALTER TABLE "DeckStructure"
ADD COLUMN IF NOT EXISTS "artifactType" TEXT;

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
