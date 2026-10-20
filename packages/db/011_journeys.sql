-- Journeys link page views in one browser tab through a tab-only session ID. Off unless the site enables it.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS journeys_enabled boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS views_session ON views(site_id,(context->>'session_id')) WHERE context ? 'session_id';
