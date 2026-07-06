import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";

/** Route requires the caller to hold ALL listed permission keys (e.g. "vehicles:create"). */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
