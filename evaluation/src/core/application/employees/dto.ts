import { z } from "zod";
import { paginationSchema } from "@/lib/pagination";
import { EmployeeStatus } from "@/core/domain/enums";

const statusEnum = z.enum([
  EmployeeStatus.ACTIVE,
  EmployeeStatus.INACTIVE,
  EmployeeStatus.ON_LEAVE,
  EmployeeStatus.TERMINATED,
]);

export const createEmployeeSchema = z.object({
  employeeNo: z.string().trim().min(1, "الرقم الوظيفي مطلوب").max(40),
  name: z.string().trim().min(2, "الاسم مطلوب").max(150),
  avatarUrl: z.string().url().max(500).optional().nullable(),
  status: statusEnum.default(EmployeeStatus.ACTIVE),
  joinedAt: z.coerce.date().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  supervisorId: z.string().uuid().optional().nullable(),
  evaluatorId: z.string().uuid().optional().nullable(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const listEmployeesSchema = paginationSchema.extend({
  status: statusEnum.optional(),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  supervisorId: z.string().uuid().optional(),
  evaluatorId: z.string().uuid().optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesInput = z.infer<typeof listEmployeesSchema>;
