CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sites(
 id text PRIMARY KEY, site_key text UNIQUE NOT NULL, name text NOT NULL,
 origin text UNIQUE NOT NULL, domain_group text NOT NULL, market text, family text NOT NULL,
 environment text NOT NULL CHECK(environment IN ('synthetic','real')),
 enabled boolean NOT NULL DEFAULT false, approval_state text NOT NULL DEFAULT 'pending',
 config_version integer NOT NULL DEFAULT 1, sample_rate double precision NOT NULL DEFAULT 1 CHECK(sample_rate>0 AND sample_rate<=1),
 daily_quota integer NOT NULL DEFAULT 100000, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pages(
 site_id text NOT NULL REFERENCES sites(id), page_key text NOT NULL, name text NOT NULL,
 selector jsonb NOT NULL, enabled boolean NOT NULL DEFAULT false, approval_state text NOT NULL DEFAULT 'pending',
 revision text NOT NULL DEFAULT 'UNKNOWN', locale text NOT NULL DEFAULT 'en-GB', variant text NOT NULL DEFAULT 'control',
 state text NOT NULL DEFAULT 'public-default', product text NOT NULL DEFAULT 'campaign',
 elements jsonb NOT NULL DEFAULT '[]', actions jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(site_id,page_key)
);
CREATE TABLE IF NOT EXISTS config_history(site_id text NOT NULL REFERENCES sites(id),version integer NOT NULL,sample_rate double precision NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(site_id,version));
CREATE TABLE IF NOT EXISTS users(id text PRIMARY KEY,email text UNIQUE NOT NULL,password_hash text NOT NULL,role text NOT NULL CHECK(role IN ('owner','administrator','analyst','installer','viewer')));
CREATE TABLE IF NOT EXISTS site_memberships(user_id text NOT NULL REFERENCES users(id),site_id text NOT NULL REFERENCES sites(id),PRIMARY KEY(user_id,site_id));
CREATE TABLE IF NOT EXISTS sessions(token_hash text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),csrf text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),last_seen timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS views(
 site_id text NOT NULL REFERENCES sites(id),view_id text NOT NULL,page_key text NOT NULL,
 started_at timestamptz NOT NULL,context jsonb NOT NULL,context_hash text NOT NULL,config_version integer NOT NULL,sample_rate double precision NOT NULL,
 PRIMARY KEY(site_id,view_id),FOREIGN KEY(site_id,page_key) REFERENCES pages(site_id,page_key)
);
CREATE TABLE IF NOT EXISTS events(
 site_id text NOT NULL, event_id text NOT NULL,view_id text NOT NULL,event_hash text NOT NULL,
 event_type text NOT NULL,payload jsonb NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(site_id,event_id),FOREIGN KEY(site_id,view_id) REFERENCES views(site_id,view_id)
);
CREATE INDEX IF NOT EXISTS events_view_idx ON events(site_id,view_id);
CREATE INDEX IF NOT EXISTS views_date_idx ON views(site_id,page_key,started_at);
CREATE TABLE IF NOT EXISTS ingestion_quotas(site_id text NOT NULL REFERENCES sites(id),day date NOT NULL,event_count integer NOT NULL,PRIMARY KEY(site_id,day));
CREATE TABLE IF NOT EXISTS jobs(
 id text PRIMARY KEY,site_id text NOT NULL,view_id text NOT NULL,state text NOT NULL DEFAULT 'pending',
 attempts integer NOT NULL DEFAULT 0,locked_until timestamptz,worker_id text,next_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_error text,updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(site_id,view_id)
);
CREATE TABLE IF NOT EXISTS view_facts(
 site_id text NOT NULL,view_id text NOT NULL,has_page_view boolean NOT NULL,facts jsonb NOT NULL,
 aggregation_version integer NOT NULL DEFAULT 1,processed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(site_id,view_id),FOREIGN KEY(site_id,view_id) REFERENCES views(site_id,view_id)
);
CREATE TABLE IF NOT EXISTS page_references(
 id text PRIMARY KEY,site_id text NOT NULL,page_key text NOT NULL,manifest jsonb NOT NULL,object_key text NOT NULL,
 status text NOT NULL DEFAULT 'pending-review',created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(site_id,page_key) REFERENCES pages(site_id,page_key)
);
CREATE TABLE IF NOT EXISTS settings(key text PRIMARY KEY,value jsonb NOT NULL);
INSERT INTO settings(key,value) VALUES('privacy','{"raw_days":30,"reference_days":90,"minimum_views":20,"global_stop":false}') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS audit(id text PRIMARY KEY,user_id text,action text NOT NULL,site_id text,detail jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
