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

-- 2) Remove the mistaken plural duplicate.
DELETE FROM departments WHERE lower(name) = lower('Technical Departments');

-- 3) Rename the mis-named discipline to the EXACT name the code recognizes.
UPDATE departments SET name = 'Electrical Technical office engineer'
 WHERE lower(name) = lower('Electrical Office Engineer');

-- 4) Ensure both disciplines exist.
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
