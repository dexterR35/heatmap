CREATE TABLE IF NOT EXISTS installation_checks(
 site_id text NOT NULL, page_key text NOT NULL, checked_at timestamptz NOT NULL DEFAULT now(), result jsonb NOT NULL,
 PRIMARY KEY(site_id,page_key), FOREIGN KEY(site_id,page_key) REFERENCES pages(site_id,page_key)
);
CREATE INDEX IF NOT EXISTS events_view_received_idx ON events(site_id,view_id,received_at DESC);
INSERT INTO schema_migrations(version) VALUES(6) ON CONFLICT DO NOTHING;
