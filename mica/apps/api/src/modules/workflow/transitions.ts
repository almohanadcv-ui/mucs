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
  // Simplified linear flow. PENDING_APPROVAL -> APPROVED is system-driven by the
  // approval decision endpoint (not a manual transition). Cancel from any
  // active state.
  { from: "DRAFT", to: "PENDING_APPROVAL", permission: "maintenance:transition" },
  { from: "DRAFT", to: "CANCELLED", permission: "maintenance:transition" },

  { from: "PENDING_APPROVAL", to: "CANCELLED", permission: "maintenance:transition" },

  { from: "APPROVED", to: "IN_PROGRESS", permission: "maintenance:transition" },
  { from: "APPROVED", to: "CANCELLED", permission: "maintenance:transition" },

  { from: "IN_PROGRESS", to: "COMPLETED", permission: "maintenance:transition" },
  { from: "IN_PROGRESS", to: "CANCELLED", permission: "maintenance:transition" },

  { from: "COMPLETED", to: "DELIVERED", permission: "maintenance:transition" },
  { from: "COMPLETED", to: "CANCELLED", permission: "maintenance:transition" },
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
