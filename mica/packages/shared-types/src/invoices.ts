import { z } from "zod";

export const INVOICE_STATUSES = ["PENDING", "ACCEPTED", "REJECTED"] as const;
export type InvoiceStatusValue = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatusValue, { en: string; ar: string }> = {
  PENDING: { en: "Pending", ar: "بانتظار الاعتماد" },
  ACCEPTED: { en: "Accepted", ar: "مقبولة" },
  REJECTED: { en: "Rejected", ar: "مرفوضة" },
};

/** Metadata sent alongside the uploaded file (multipart), hence coerced strings. */
export const createInvoiceSchema = z.object({
  vehicleId: z.string().min(1),
  amount: z.coerce.number().positive(),
  description: z.string().max(1000).optional(),
  workshopName: z.string().max(200).optional(),
  invoiceDate: z
    .string()
    .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Invalid date")
    .optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const rejectInvoiceSchema = z.object({
  rejectionReason: z.string().min(1, "A reason is required").max(1000),
  notes: z.string().max(1000).optional(),
});
export type RejectInvoiceInput = z.infer<typeof rejectInvoiceSchema>;

export const acceptInvoiceSchema = z.object({
  notes: z.string().max(1000).optional(),
});
export type AcceptInvoiceInput = z.infer<typeof acceptInvoiceSchema>;

/** Whitelist for invoice uploads (spec: PDF / PNG / JPG / JPEG only). */
export const INVOICE_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;
