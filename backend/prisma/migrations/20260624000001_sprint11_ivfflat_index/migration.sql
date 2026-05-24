-- Sprint 11 (US-1108)
-- IVFFlat index for fast cosine similarity queries on question embeddings
--
-- Gate 1 Status: NO GO as of 2026-05-24
-- - question_embeddings row count: 0 (threshold: >= 10k)
-- - Index creation deferred until production data availability
-- - Keep exact scan for now
--
-- When ready to create the index:
--   CREATE INDEX CONCURRENTLY question_embeddings_ivfflat_idx
--     ON question_embeddings USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 100);
--
-- Rollback:
--   DROP INDEX CONCURRENTLY IF EXISTS question_embeddings_ivfflat_idx;
--
-- Conditional creation in case migration is re-run with sufficient data:
DO $$
DECLARE
  row_count INTEGER;
  index_exists BOOLEAN;
BEGIN
  -- Check if question_embeddings table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'question_embeddings'
  ) THEN
    -- Check if index already exists
    SELECT EXISTS(
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'question_embeddings'
      AND indexname = 'question_embeddings_ivfflat_idx'
    ) INTO index_exists;

    IF NOT index_exists THEN
      SELECT COUNT(*) INTO row_count FROM question_embeddings;
      IF row_count >= 10000 THEN
        -- Production data available, create index
        EXECUTE 'CREATE INDEX CONCURRENTLY question_embeddings_ivfflat_idx
                 ON question_embeddings USING ivfflat (embedding vector_cosine_ops)
                 WITH (lists = 100)';
        RAISE NOTICE 'Created IVFFlat index on question_embeddings (% rows)', row_count;
      ELSE
        -- Not enough data yet, log decision
        RAISE NOTICE 'Deferring IVFFlat index creation: % rows (need >= 10000)', row_count;
      END IF;
    END IF;
  END IF;
END
$$;
