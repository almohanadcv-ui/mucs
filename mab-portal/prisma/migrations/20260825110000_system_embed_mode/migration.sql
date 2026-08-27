-- How each system is embedded: proxy (same-origin /apps/<key>) or subdomain.
ALTER TABLE "systems" ADD COLUMN "embedMode" TEXT NOT NULL DEFAULT 'proxy';

-- SPAs with absolute paths embed on their own subdomain.
UPDATE "systems" SET "embedMode" = 'subdomain' WHERE key IN ('gatepass', 'mica', 'tasks', 'tickets');
