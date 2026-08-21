import "server-only";
import { prisma } from "./db";

/** Record one asset change (append-only). Best-effort. */
export async function logAsset(entry: {
  assetId: string;
  action: string;
  summary: string;
  detail?: unknown;
  actorId?: string | null;
  actorName?: string | null;
}): Promise<void> {
  try {
    await prisma.assetLog.create({
      data: {
        assetId: entry.assetId,
        action: entry.action,
        summary: entry.summary,
        detail: (entry.detail ?? undefined) as never,
        actorId: entry.actorId ?? null,
        actorName: entry.actorName ?? null,
      },
    });
  } catch (err) {
    console.error("[portal] asset log failed:", err);
  }
}
