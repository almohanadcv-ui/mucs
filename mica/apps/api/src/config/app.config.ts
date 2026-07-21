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
  /**
   * Demands an emailed code from every user at sign-in. Off by default so
   * enabling it is a deliberate act — switching it on without working mail
   * would lock the whole company out.
   */
  requireTwoFactor: process.env.MICA_REQUIRE_2FA === "true",
}));
