import { MaintenanceStatus } from "@prisma/client";

export interface TransitionRule {
  from: MaintenanceStatus;
  to: MaintenanceStatus;
  permission: string;
}

/**
 * Explicit transition table for the maintenance request state machine.
 * PENDING_APPROVAL -> APPROVED/REJECTED are intentionally NOT listed here —
 * those are system-driven outcomes of the approval-chain decision endpoint,
 * never a direct, manually-requested transition (see WorkflowService.decideApproval).
 */
export const TRANSITIONS: TransitionRule[] = [
  { from: "DRAFT", to: "PENDING_APPROVAL", permission: "maintenance:transition" },
  { from: "DRAFT", to: "CANCELLED", permission: "maintenance:transition" },

  // Driver-submitted reports skip approval entirely and go straight to a
  // mechanic's inbox as REPORTED (see MaintenanceService.createDriverReport).
  { from: "REPORTED", to: "IN_PROGRESS", permission: "maintenance:transition" },
  { from: "REPORTED", to: "CANCELLED", permission: "maintenance:transition" },

  { from: "REJECTED", to: "DRAFT", permission: "maintenance:transition" },
  { from: "REJECTED", to: "CANCELLED", permission: "maintenance:transition" },

  { from: "APPROVED", to: "SCHEDULED", permission: "maintenance:transition" },
  { from: "APPROVED", to: "CANCELLED", permission: "maintenance:transition" },

  { from: "SCHEDULED", to: "ASSIGNED", permission: "maintenance:assign" },
  { from: "SCHEDULED", to: "CANCELLED", permission: "maintenance:transition" },

  { from: "ASSIGNED", to: "IN_PROGRESS", permission: "maintenance:transition" },
  { from: "ASSIGNED", to: "CANCELLED", permission: "maintenance:transition" },

  { from: "IN_PROGRESS", to: "WAITING_PARTS", permission: "maintenance:transition" },
  { from: "IN_PROGRESS", to: "QUALITY_INSPECTION", permission: "maintenance:transition" },
  { from: "IN_PROGRESS", to: "CANCELLED", permission: "maintenance:transition" },

  { from: "WAITING_PARTS", to: "IN_PROGRESS", permission: "maintenance:transition" },
  { from: "WAITING_PARTS", to: "CANCELLED", permission: "maintenance:transition" },

  { from: "QUALITY_INSPECTION", to: "COMPLETED", permission: "maintenance:transition" },
  { from: "QUALITY_INSPECTION", to: "IN_PROGRESS", permission: "maintenance:transition" },
  { from: "QUALITY_INSPECTION", to: "CANCELLED", permission: "maintenance:transition" },

  { from: "COMPLETED", to: "DELIVERED", permission: "maintenance:transition" },
];

export function getAllowedTransitions(from: MaintenanceStatus): TransitionRule[] {
  return TRANSITIONS.filter((rule) => rule.from === from);
}

export function findTransitionRule(
  from: MaintenanceStatus,
  to: MaintenanceStatus,
): TransitionRule | undefined {
  return TRANSITIONS.find((rule) => rule.from === from && rule.to === to);
}
