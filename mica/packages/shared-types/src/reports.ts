import { z } from "zod";

export const REPORT_GROUP_BY = ["vehicle", "branch"] as const;
export type ReportGroupByValue = (typeof REPORT_GROUP_BY)[number];

export const maintenanceCostReportQuerySchema = z.object({
  branchId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  groupBy: z.enum(REPORT_GROUP_BY).default("vehicle"),
});
export type MaintenanceCostReportQuery = z.infer<typeof maintenanceCostReportQuerySchema>;
