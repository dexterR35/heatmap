ALTER TABLE pages ADD COLUMN IF NOT EXISTS campaign_codes jsonb NOT NULL DEFAULT '["unknown"]';
ALTER TABLE pages ADD COLUMN IF NOT EXISTS diagnostic_error_codes jsonb NOT NULL DEFAULT '["runtime-error","unhandled-rejection"]';
ALTER TABLE pages ADD COLUMN IF NOT EXISTS diagnostics_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS primary_cta_id text NOT NULL DEFAULT 'hero-register';
ALTER TABLE pages ADD COLUMN IF NOT EXISTS primary_action_id text NOT NULL DEFAULT 'registration-start';
-- Enable only the known, anonymous local fixture; real properties stay gated.
UPDATE pages SET diagnostics_enabled=true WHERE site_id='local-demo'
 AND NOT EXISTS(SELECT 1 FROM schema_migrations WHERE version=4);
CREATE TABLE IF NOT EXISTS operation_runs(
 id text PRIMARY KEY,kind text NOT NULL CHECK(kind IN ('retention','backup','monitor')),
 status text NOT NULL CHECK(status IN ('running','completed','failed')),
 started_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,
 detail jsonb NOT NULL DEFAULT '{}',error_code text
);
CREATE TABLE IF NOT EXISTS operation_alerts(
 code text PRIMARY KEY,severity text NOT NULL CHECK(severity IN ('warning','critical')),
 active boolean NOT NULL DEFAULT true,detail jsonb NOT NULL DEFAULT '{}',
 first_seen timestamptz NOT NULL DEFAULT now(),last_seen timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz
);
INSERT INTO settings(key,value) VALUES('operations','{"automatic_retention":true,"retention_hour_utc":2,"automatic_backup":false,"backup_hour_utc":3,"backup_days":7,"queue_warning_seconds":60,"rejection_warning_percent":10}') ON CONFLICT DO NOTHING;
UPDATE jobs SET state='pending',attempts=0,next_attempt_at=now()
 WHERE EXISTS(SELECT 1 FROM view_facts f WHERE f.site_id=jobs.site_id AND f.view_id=jobs.view_id AND f.aggregation_version<3)
 AND NOT EXISTS(SELECT 1 FROM schema_migrations WHERE version=4);
INSERT INTO schema_migrations(version) VALUES(4) ON CONFLICT DO NOTHING;
