-- Add the EMPLOYEE role: the plainest account, provisioned by default via the
-- portal SSO. Sees only its own evaluation and messages its manager.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'EMPLOYEE';
