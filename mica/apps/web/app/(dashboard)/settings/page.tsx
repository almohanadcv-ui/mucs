"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanySettingsForm } from "@/features/settings/company-settings-form";
import { SmtpSettingsForm } from "@/features/settings/smtp-settings-form";
import { ThemeSettingsForm } from "@/features/settings/theme-settings-form";

export default function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Company profile, email delivery, and branding defaults.</p>
      </div>

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="smtp">Email (SMTP)</TabsTrigger>
          <TabsTrigger value="theme">Branding</TabsTrigger>
        </TabsList>
        <TabsContent value="company">
          <CompanySettingsForm />
        </TabsContent>
        <TabsContent value="smtp">
          <SmtpSettingsForm />
        </TabsContent>
        <TabsContent value="theme">
          <ThemeSettingsForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
