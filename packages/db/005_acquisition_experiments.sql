ALTER TABLE sites ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT 'netbet';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'XXX';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS report_timezone text NOT NULL DEFAULT 'UTC';
ALTER TABLE pages ADD COLUMN IF NOT EXISTS market text;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS page_family text NOT NULL DEFAULT 'unassigned';
ALTER TABLE pages ADD COLUMN IF NOT EXISTS acquisition_goal text NOT NULL DEFAULT 'registration_completed';
ALTER TABLE views ADD COLUMN IF NOT EXISTS acquisition_context jsonb NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS acquisition_keys(
 id text PRIMARY KEY, site_id text NOT NULL REFERENCES sites(id), name text NOT NULL,
 token_hash text UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS experiments(
 id text PRIMARY KEY, site_id text NOT NULL, page_key text NOT NULL, name text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('aa','ab')), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','running','paused','completed')),
 primary_metric text NOT NULL CHECK(primary_metric IN ('registration_completed','qualified_acquisition')),
 control_variant text NOT NULL, treatment_variant text NOT NULL, revision text NOT NULL,
 baseline_rate double precision NOT NULL CHECK(baseline_rate>0 AND baseline_rate<1),
 mde_relative double precision NOT NULL CHECK(mde_relative>0 AND mde_relative<=1),
 required_per_arm integer NOT NULL CHECK(required_per_arm>0), minimum_days integer NOT NULL CHECK(minimum_days BETWEEN 1 AND 90),
 attribution_hours integer NOT NULL CHECK(attribution_hours BETWEEN 1 AND 720),
 salt text NOT NULL, context jsonb NOT NULL DEFAULT '{}', active_seconds double precision NOT NULL DEFAULT 0,
 final_readout jsonb, evidence_pruned boolean NOT NULL DEFAULT false, privacy_exclusions integer NOT NULL DEFAULT 0,
 started_at timestamptz, last_started_at timestamptz, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(site_id,page_key) REFERENCES pages(site_id,page_key), CHECK(control_variant<>treatment_variant),UNIQUE(site_id,page_key,revision,treatment_variant)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_page_experiment ON experiments(site_id,page_key) WHERE status IN ('running','paused');
CREATE TABLE IF NOT EXISTS acquisition_visits(
 id text PRIMARY KEY, site_id text NOT NULL, page_key text NOT NULL, receipt_id text NOT NULL, request_hash text NOT NULL,
 subject_hash text NOT NULL, campaign text NOT NULL, device text NOT NULL CHECK(device IN ('mobile','tablet','desktop')),
 context jsonb NOT NULL, experiment_id text REFERENCES experiments(id), variant text NOT NULL, revision text NOT NULL,
 attribution_hours integer NOT NULL CHECK(attribution_hours BETWEEN 1 AND 720), policy_version text NOT NULL,
 data_source text NOT NULL CHECK(data_source IN ('recorded','seeded')),
 created_at timestamptz NOT NULL DEFAULT now(), rendered_at timestamptz,
 FOREIGN KEY(site_id,page_key) REFERENCES pages(site_id,page_key), UNIQUE(site_id,receipt_id), UNIQUE(experiment_id,subject_hash)
);
CREATE INDEX IF NOT EXISTS acquisition_visits_scope ON acquisition_visits(site_id,page_key,created_at);
CREATE TABLE IF NOT EXISTS acquisition_outcomes(
 site_id text NOT NULL REFERENCES sites(id), event_id text NOT NULL, visit_id text NOT NULL REFERENCES acquisition_visits(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('registration_completed','qualified_acquisition')),
 occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), payload_hash text NOT NULL,
 PRIMARY KEY(site_id,event_id), UNIQUE(visit_id,kind)
);
CREATE TABLE IF NOT EXISTS acquisition_spend(
 id text PRIMARY KEY, site_id text NOT NULL, page_key text NOT NULL, campaign text NOT NULL,
 day date NOT NULL, currency text NOT NULL, amount_micros bigint NOT NULL CHECK(amount_micros>=0),
 coverage_confirmed boolean NOT NULL DEFAULT false, context jsonb NOT NULL DEFAULT '{}', data_source text NOT NULL CHECK(data_source IN ('recorded','seeded')),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(site_id,page_key) REFERENCES pages(site_id,page_key), UNIQUE(site_id,page_key,campaign,day,currency,data_source)
);
INSERT INTO schema_migrations(version) VALUES(5) ON CONFLICT DO NOTHING;
