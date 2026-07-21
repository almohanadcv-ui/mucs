import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "4000", 10),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3001",
  /**
   * Where MICA is reachable from a recipient's inbox. Falls back to the CORS
   * origin, which is the web app's address in every existing deployment, so a
   * missing value produces a working link rather than a broken one.
   */
  publicUrl: (process.env.MICA_PUBLIC_URL ?? process.env.CORS_ORIGIN ?? "http://localhost:3001")
    .trim()
    .replace(/\/$/, ""),
}));
