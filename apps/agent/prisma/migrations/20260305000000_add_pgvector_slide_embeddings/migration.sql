-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create SlideEmbedding table
CREATE TABLE "SlideEmbedding" (
    "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "templateId"      TEXT NOT NULL,
    "slideIndex"      INTEGER NOT NULL,
    "contentText"     TEXT NOT NULL,
    "embedding"       vector(768) NOT NULL,
    "industry"        TEXT,
    "solutionPillar"  TEXT,
    "persona"         TEXT,
    "funnelStage"     TEXT,
    "contentType"     TEXT,
    "confidence"      DOUBLE PRECISION,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlideEmbedding_pkey" PRIMARY KEY ("id")
);

-- Index for filtering by template
CREATE INDEX "SlideEmbedding_templateId_idx" ON "SlideEmbedding"("templateId");

-- HNSW index for cosine similarity search (replaces Prisma's default btree)
CREATE INDEX "SlideEmbedding_embedding_idx"
    ON "SlideEmbedding"
    USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
