import { NextRequest } from "next/server";
import { logout } from "@/core/application/auth/auth-service";
import { readRefreshToken, clearAuthCookies } from "@/infrastructure/auth/cookies";
import { requestMeta, ok, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const meta = requestMeta(req);
  try {
    const raw = await readRefreshToken();
    await logout(raw, meta);
    await clearAuthCookies();
    return ok({ loggedOut: true });
  } catch (err) {
    return handleApiError(err);
  }
}
