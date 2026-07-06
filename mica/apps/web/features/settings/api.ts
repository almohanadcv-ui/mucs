import type { CompanySettingsInput, SmtpSettingsInput, ThemeSettingsInput } from "@mica-mab/shared-types";
import { apiClient } from "@/lib/api-client";

export type SmtpSettingsResponse = Omit<SmtpSettingsInput, "password"> & { hasPassword: boolean };

export async function getCompanySettings() {
  const { data } = await apiClient.get<CompanySettingsInput>("/settings/company");
  return data;
}

export async function updateCompanySettings(input: CompanySettingsInput) {
  const { data } = await apiClient.put<CompanySettingsInput>("/settings/company", input);
  return data;
}

export async function getSmtpSettings() {
  const { data } = await apiClient.get<SmtpSettingsResponse>("/settings/smtp");
  return data;
}

export async function updateSmtpSettings(input: SmtpSettingsInput) {
  const { data } = await apiClient.put<SmtpSettingsResponse>("/settings/smtp", input);
  return data;
}

export async function testSmtpSettings() {
  const { data } = await apiClient.post<{ sent: boolean }>("/settings/smtp/test");
  return data;
}

export async function getThemeSettings() {
  const { data } = await apiClient.get<ThemeSettingsInput>("/settings/theme");
  return data;
}

export async function updateThemeSettings(input: ThemeSettingsInput) {
  const { data } = await apiClient.put<ThemeSettingsInput>("/settings/theme", input);
  return data;
}
