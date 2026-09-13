-- Track when the employee first opened their evaluation, and when we last
-- nudged them (and notified manager/HR) about opening it without acting.
ALTER TABLE "evaluations" ADD COLUMN "employeeOpenedAt" TIMESTAMP(3);
ALTER TABLE "evaluations" ADD COLUMN "employeeIgnoredNotifiedAt" TIMESTAMP(3);
