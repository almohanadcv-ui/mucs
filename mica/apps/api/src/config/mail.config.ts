import { registerAs } from "@nestjs/config";

/**
 * Which transport carries MICA's mail.
 *
 * Defaults to smtp so an existing deployment keeps behaving as it did; a
 * tenant that has disabled basic authentication sets MICA_MAIL_PROVIDER=graph
 * and supplies the app registration below. No secret has a default — a missing
 * one must fail loudly rather than silently fall back to something that cannot
 * work.
 */
export default registerAs("mail", () => ({
  provider: (process.env.MICA_MAIL_PROVIDER ?? "smtp").trim().toLowerCase(),
  graph: {
    tenantId: process.env.GRAPH_TENANT_ID?.trim(),
    clientId: process.env.GRAPH_CLIENT_ID?.trim(),
    clientSecret: process.env.GRAPH_CLIENT_SECRET?.trim(),
    /** Mailbox the app sends as. Must be the one the access policy scopes it to. */
    from: process.env.MICA_MAIL_FROM?.trim(),
    fromName: process.env.MICA_MAIL_FROM_NAME?.trim() ?? "MICA Notifications",
  },
}));
