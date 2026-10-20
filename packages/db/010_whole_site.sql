-- Whole-site mode: one snippet for a site, pages created per canonical path on first visit.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS collection_mode text NOT NULL DEFAULT 'selected_pages' CHECK (collection_mode IN ('selected_pages','whole_site'));
ALTER TABLE sites ADD COLUMN IF NOT EXISTS site_rules jsonb NOT NULL DEFAULT '{"include": ["/*"], "exclude": ["/login", "/logout", "/signin", "/sign-in", "/signup/*", "/account/*", "/my-account/*", "/profile/*", "/settings/*", "/admin/*", "/wp-admin/*", "/checkout/*", "/cart", "/basket", "/payment/*", "/password/*", "/reset/*", "/verify/*", "/unsubscribe/*", "/api/*"], "patterns": []}';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS site_elements jsonb NOT NULL DEFAULT '[]';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS site_actions jsonb NOT NULL DEFAULT '[]';
ALTER TABLE pages ADD COLUMN IF NOT EXISTS path text;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS auto boolean NOT NULL DEFAULT false;
