import { isAxiosError } from "axios";

/**
 * Largest file the API accepts (mirrors MAX_FILE_SIZE_BYTES in media.controller).
 * Checked in the browser too so an oversized file is refused instantly with a
 * clear reason instead of being sent and bounced.
 */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Carries an already-explained upload failure to the mutation's onError. */
export class UploadRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadRejected";
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

/**
 * Reject a file before it is sent. Returns an Arabic reason, or null if fine.
 */
export function checkFileBeforeUpload(file: File): string | null {
  if (file.size === 0) {
    return `الملف «${file.name}» فارغ.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `الملف «${file.name}» حجمه ${formatBytes(file.size)} ويتجاوز الحد المسموح (${formatBytes(MAX_UPLOAD_BYTES)}).`;
  }
  return null;
}

/**
 * Turn an upload failure into a reason the user can act on.
 *
 * The important case is 413: that response comes from the reverse proxy, not
 * the API, so it carries an HTML body with no `message` field — which is why a
 * too-large upload used to surface as a bare "تعذّر الرفع" with no explanation.
 * Phones hit it and laptops usually don't, because phone cameras produce much
 * larger files.
 */
export function describeUploadError(error: unknown, file?: File): string {
  if (!isAxiosError(error)) return "تعذّر الرفع.";

  const status = error.response?.status;
  const serverMessage = (error.response?.data as { message?: string } | undefined)?.message;

  if (status === 413) {
    const size = file ? ` (حجمه ${formatBytes(file.size)})` : "";
    return `الملف كبير جداً${size} ورفضه الخادم قبل الوصول للتطبيق. يجب رفع حد الرفع في إعدادات الخادم (client_max_body_size).`;
  }
  if (status === 415 || serverMessage === "Unsupported file type") {
    return `نوع الملف${file ? ` «${file.name}»` : ""} غير مدعوم.`;
  }
  if (status === 401 || status === 403) {
    return "لا تملك صلاحية رفع الملفات، أو انتهت الجلسة.";
  }
  if (status === 0 || error.code === "ERR_NETWORK") {
    return "انقطع الاتصال أثناء الرفع. تحقق من الشبكة وحاول مجدداً.";
  }
  if (error.code === "ECONNABORTED") {
    return "انتهت مهلة الرفع — الملف كبير أو الشبكة بطيئة.";
  }
  // A real API error: it carries a JSON message worth showing verbatim.
  if (serverMessage) return serverMessage;
  return `تعذّر الرفع${status ? ` (رمز ${status})` : ""}.`;
}
