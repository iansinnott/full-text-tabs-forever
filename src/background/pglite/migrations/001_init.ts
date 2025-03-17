export const sql = `
-- make sure pgvector is enabled
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS document (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title TEXT, 
  url TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  md_content TEXT,
  md_content_hash TEXT,
  publication_date BIGINT,
  hostname TEXT,
  last_visit BIGINT,
  last_visit_date TEXT,
  extractor TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000,
  updated_at BIGINT
);

CREATE INDEX IF NOT EXISTS document_hostname ON document (hostname);

CREATE TABLE IF NOT EXISTS document_fragment (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  entity_id BIGINT NOT NULL REFERENCES document (id) ON DELETE CASCADE,
  attribute TEXT, 
  value TEXT,
  fragment_order INTEGER,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000,
  search_vector tsvector,
  content_vector vector(384)
);

CREATE OR REPLACE FUNCTION update_document_fragment_fts() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', NEW.value);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update search vector
DROP TRIGGER IF EXISTS update_document_fragment_fts_trigger ON document_fragment;
CREATE TRIGGER update_document_fragment_fts_trigger
BEFORE INSERT OR UPDATE ON document_fragment
FOR EACH ROW EXECUTE FUNCTION update_document_fragment_fts();

-- Index for full-text search
CREATE INDEX IF NOT EXISTS idx_document_fragment_search_vector ON document_fragment USING GIN(search_vector);

-- Index for trigram similarity search, i.e. postgres trigram
-- NOTE: Disabled for now. Takes up a significant amount of space and not yet proven useful for this project
--CREATE INDEX IF NOT EXISTS trgm_idx_document_fragment_value ON document_fragment USING GIN(value gin_trgm_ops);

CREATE TABLE IF NOT EXISTS blacklist_rule (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pattern TEXT UNIQUE NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('no_index', 'url_only')),
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000
);

CREATE INDEX IF NOT EXISTS idx_blacklist_rule_pattern ON blacklist_rule (pattern);

CREATE TABLE IF NOT EXISTS migrations (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  version INTEGER UNIQUE NOT NULL,
  applied_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000
);
`;
