import { NextRequest } from "next/server";
import { refresh } from "@/core/application/auth/auth-service";
import {
  readRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} from "@/infrastructure/auth/cookies";
import { requestMeta, ok, handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const meta = requestMeta(req);
  try {
    const raw = await readRefreshToken();
    const { user, tokens } = await refresh(raw, meta);
    await setAuthCookies(tokens);
    return ok({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    await clearAuthCookies();
    return handleApiError(err);
  }
}
