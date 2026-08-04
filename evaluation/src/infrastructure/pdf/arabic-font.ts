import "server-only";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Server-side Arabic rendering needs an actual font with the Arabic
 * presentation forms — pdfkit ships none. Amiri (SIL OFL, static TTF) is
 * fetched once and cached to disk, so only the first PDF after a deploy touches
 * the network. Ops can pre-place the file and set ARABIC_FONT_PATH to run fully
 * offline.
 */
const FONT_URL =
  "https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf";

function cachePath(): string {
  return path.join(process.cwd(), ".cache", "amiri-regular.ttf");
}

let inMemory: Buffer | null = null;

/**
 * Return the Amiri TTF as a Buffer, or null if it cannot be obtained (no cache,
 * no override, and the download failed). Callers treat null as "skip the PDF"
 * rather than an error, so a missing font never breaks the email.
 */
export async function loadArabicFont(): Promise<Buffer | null> {
  if (inMemory) return inMemory;

  const override = process.env.ARABIC_FONT_PATH;
  if (override) {
    try {
      inMemory = await readFile(override);
      return inMemory;
    } catch {
      // fall through to cache/download
    }
  }

  const cache = cachePath();
  try {
    inMemory = await readFile(cache);
    return inMemory;
  } catch {
    // not cached yet
  }

  try {
    const res = await fetch(FONT_URL, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`font download failed (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    // A truncated/HTML error page would corrupt the PDF; a real TTF is >50 KB.
    if (buf.length < 50_000) throw new Error(`font download too small (${buf.length} bytes)`);
    await mkdir(path.dirname(cache), { recursive: true });
    await writeFile(cache, buf);
    inMemory = buf;
    return inMemory;
  } catch (err) {
    console.error("[pdf] could not obtain Arabic font:", err);
    return null;
  }
}
