import { apiClient } from "@/lib/api-client";

/** Why the page cannot offer a decision, or that it can. */
export type ActionState = "actionable" | "decided" | "expired" | "used" | "unknown";

export interface InvoiceActionView {
  state: ActionState;
  addressedToSomeoneElse?: boolean;
  invoice?: {
    id: string;
    invoiceNumber: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED";
    amount: string;
    workshopName: string | null;
    rejectionReason: string | null;
    createdAt: string;
    submittedBy: string | null;
    vehicle: { id: string; plateNumber: string; name: string | null } | null;
  };
}

export async function getInvoiceAction(token: string) {
  const { data } = await apiClient.get<InvoiceActionView>(`/invoices/actions/${token}`);
  return data;
}

export async function decideInvoiceAction(
  token: string,
  body: { decision: "approve" | "reject"; rejectionReason?: string },
) {
  const { data } = await apiClient.post(`/invoices/actions/${token}/decide`, body);
  return data;
}
