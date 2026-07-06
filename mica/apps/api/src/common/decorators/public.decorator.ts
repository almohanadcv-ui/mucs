import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Marks a route as exempt from the global JWT auth guard (added in Phase 2). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
