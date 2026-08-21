import "server-only";

/** Server env, read once. Missing critical values fail fast at first use. */
export const env = {
  APP_URL: process.env.APP_URL ?? "http://localhost:3005",
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-insecure-portal-secret",
  SSO_SECRET: process.env.SSO_SECRET ?? "dev-insecure-sso-secret",

  GRAPH_TENANT_ID: process.env.GRAPH_TENANT_ID ?? "",
  GRAPH_CLIENT_ID: process.env.GRAPH_CLIENT_ID ?? "",
  GRAPH_CLIENT_SECRET: process.env.GRAPH_CLIENT_SECRET ?? "",
  MAIL_FROM: process.env.MAIL_FROM ?? "",
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME ?? "منصّة MAB",
};

export function isMailConfigured(): boolean {
  return Boolean(
    env.GRAPH_TENANT_ID && env.GRAPH_CLIENT_ID && env.GRAPH_CLIENT_SECRET && env.MAIL_FROM,
  );
}
