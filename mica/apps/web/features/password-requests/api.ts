import { apiClient } from "@/lib/api-client";

export interface ResetRequestItem {
  id: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
}

export async function listResetRequests() {
  const { data } = await apiClient.get<ResetRequestItem[]>("/auth/reset-requests");
  return data;
}

export async function handleResetRequest(id: string) {
  const { data } = await apiClient.post<{ setPasswordUrl: string; name: string; phone: string | null }>(
    `/auth/reset-requests/${id}/handle`,
  );
  return data;
}

/** Saudi-friendly WhatsApp deep link: normalize 05xxxxxxxx → 9665xxxxxxxx. */
export function whatsappLink(phone: string | null, message: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `966${digits.slice(1)}`;
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
