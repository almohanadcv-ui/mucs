-- Set up the Technical Department the way the app expects (path B):
-- one parent "Technical Department" with two recognized disciplines linked under
-- it — Electrical + Mechanical Technical office engineer — and drop the junk.
-- Run once:
--   psql "$DATABASE_URL" -f scripts/setup-technical-department.sql
BEGIN;

-- 1) Make sure the reserved parent exists.
INSERT INTO departments (id, name, created_by_id)
SELECT 'department-' || gen_random_uuid(), 'Technical Department',
       (SELECT id FROM users WHERE role = 'superadmin' ORDER BY name LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE lower(name) = lower('Technical Department'));

-- 2) Remove the leftovers: the plural duplicate and the old mis-named discipline
--    (the app already seeds the correctly-named disciplines on boot).
DELETE FROM departments WHERE lower(name) IN (
  lower('Technical Departments'),
  lower('Electrical Office Engineer')
);

-- 3) Ensure both disciplines exist (no-op if already seeded).
INSERT INTO departments (id, name, created_by_id)
SELECT 'department-' || gen_random_uuid(), 'Electrical Technical office engineer',
       (SELECT id FROM users WHERE role = 'superadmin' ORDER BY name LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE lower(name) = lower('Electrical Technical office engineer'));

INSERT INTO departments (id, name, created_by_id)
SELECT 'department-' || gen_random_uuid(), 'Mechanical Technical office engineer',
       (SELECT id FROM users WHERE role = 'superadmin' ORDER BY name LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE lower(name) = lower('Mechanical Technical office engineer'));

-- 5) Link both disciplines under Technical Department so the org tree is correct.
UPDATE departments
   SET parent_id = (SELECT id FROM departments WHERE lower(name) = lower('Technical Department') LIMIT 1)
 WHERE lower(name) IN (
   lower('Electrical Technical office engineer'),
   lower('Mechanical Technical office engineer')
 );

COMMIT;

-- Show the result.
SELECT id, name, parent_id FROM departments ORDER BY name;
