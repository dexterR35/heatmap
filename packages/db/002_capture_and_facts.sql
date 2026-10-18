CREATE TABLE IF NOT EXISTS capture_jobs(
 id text PRIMARY KEY, site_id text NOT NULL, page_key text NOT NULL,
 user_id text NOT NULL REFERENCES users(id),
 status text NOT NULL CHECK(status IN ('queued','running','pending-review','failed')),
 width integer NOT NULL, height integer NOT NULL,
 reference_id text REFERENCES page_references(id) ON DELETE SET NULL, error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(site_id,page_key) REFERENCES pages(site_id,page_key)
);
-- Rebuild derived facts from retained evidence, preserving identities and history.
UPDATE jobs SET state='pending',attempts=0,next_attempt_at=now()
WHERE EXISTS(SELECT 1 FROM view_facts f WHERE f.site_id=jobs.site_id AND f.view_id=jobs.view_id AND f.aggregation_version<2);
INSERT INTO schema_migrations(version) VALUES(2) ON CONFLICT DO NOTHING;
