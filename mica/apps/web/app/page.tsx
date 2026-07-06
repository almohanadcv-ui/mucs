"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/session-context";

export default function Home() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useSession();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    router.replace(user?.roles.includes("Driver") ? "/driver/vehicles" : "/dashboard");
  }, [isLoading, isAuthenticated, user, router]);

  return null;
}
