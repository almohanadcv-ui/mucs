import { registerAs } from "@nestjs/config";

/** Empty string means "rely on PATH" (typical for Docker/Linux deploys where pg_dump ships on PATH). */
export default registerAs("backup", () => ({
  pgBinDir: process.env.PG_BIN_DIR ?? "",
}));
