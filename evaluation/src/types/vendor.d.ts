// Minimal ambient declarations for PDF dependencies that ship without types.
// Only the surface this app uses is declared.

declare module "arabic-reshaper" {
  /** Convert Arabic text to its joined presentation forms. */
  export function convertArabic(text: string): string;
  export function convertArabicBack(text: string): string;
}

declare module "bidi-js" {
  export interface EmbeddingLevels {
    levels: Uint8Array;
    paragraphs: Array<{ start: number; end: number; level: number }>;
  }
  export interface Bidi {
    getEmbeddingLevels(text: string, baseDirection?: "ltr" | "rtl" | "auto"): EmbeddingLevels;
    getReorderedString(text: string, embeddingLevels: EmbeddingLevels): string;
  }
  export default function bidiFactory(): Bidi;
}
