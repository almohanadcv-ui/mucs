import { registerAs } from "@nestjs/config";

export default registerAs("smtp", () => ({
  host: process.env.SMTP_HOST ?? "localhost",
  port: parseInt(process.env.SMTP_PORT ?? "1025", 10),
  secure: process.env.SMTP_SECURE === "true",
  user: process.env.SMTP_USER || undefined,
  password: process.env.SMTP_PASSWORD || undefined,
  from: process.env.SMTP_FROM ?? "MICA MAB Fleet <no-reply@mica-mab.local>",
}));
