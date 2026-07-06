import type { AcceptInvoiceInput, RejectInvoiceInput } from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

export interface InvoiceItem {
  id: string;
  vehicleId: string;
  amount: string;
  description: string | null;
  workshopName: string | null;
  invoiceDate: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  rejectionReason: string | null;
  decisionNotes: string | null;
  decidedAt: string | null;
  createdAt: string;
  createdById: string | null;
  vehicle: { id: string; plateNumber: string; name: string | null } | null;
}

export async function listInvoices(params: { vehicleId?: string; status?: string } = {}) {
  const { data } = await apiClient.get<InvoiceItem[]>("/invoices", { params });
  return data;
}

export interface CreateInvoiceForm {
  file: File;
  vehicleId: string;
  amount: number;
  description?: string;
  workshopName?: string;
  invoiceDate?: string;
}

export async function createInvoice(input: CreateInvoiceForm) {
  const form = new FormData();
  form.append("file", input.file);
  form.append("vehicleId", input.vehicleId);
  form.append("amount", String(input.amount));
  if (input.description) form.append("description", input.description);
  if (input.workshopName) form.append("workshopName", input.workshopName);
  if (input.invoiceDate) form.append("invoiceDate", input.invoiceDate);
  const { data } = await apiClient.post<InvoiceItem>("/invoices", form);
  return data;
}

export async function acceptInvoice(id: string, input: AcceptInvoiceInput) {
  const { data } = await apiClient.post<InvoiceItem>(`/invoices/${id}/accept`, input);
  return data;
}

export async function rejectInvoice(id: string, input: RejectInvoiceInput) {
  const { data } = await apiClient.post<InvoiceItem>(`/invoices/${id}/reject`, input);
  return data;
}

export async function deleteInvoice(id: string) {
  await apiClient.delete(`/invoices/${id}`);
}

/** The file endpoint is auth-gated, so fetch it as a blob and open the object URL. */
export async function openInvoiceFile(id: string) {
  const { data } = await apiClient.get(`/invoices/${id}/file`, { responseType: "blob" });
  const url = URL.createObjectURL(data as Blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
