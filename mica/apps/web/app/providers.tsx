"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/lib/auth/session-context";
import { LocaleProvider } from "@/lib/i18n/locale-context";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <LocaleProvider>
          <TooltipProvider>
            <SessionProvider>{children}</SessionProvider>
            <Toaster richColors position="top-center" />
          </TooltipProvider>
        </LocaleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
