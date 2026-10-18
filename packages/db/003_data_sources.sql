-- Earlier releases mixed generated and observed local events without provenance.
-- Preserve those rows as legacy; never guess that they were recorded activity.
ALTER TABLE views ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'legacy'
 CHECK(data_source IN ('recorded','seeded','legacy'));
ALTER TABLE views ALTER COLUMN data_source SET DEFAULT 'recorded';
CREATE INDEX IF NOT EXISTS views_source_date_idx ON views(site_id,page_key,data_source,started_at);
INSERT INTO schema_migrations(version) VALUES(3) ON CONFLICT DO NOTHING;
