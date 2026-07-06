import { SetMetadata } from "@nestjs/common";

export const API_KEY_SCOPES_KEY = "apiKeyScopes";

/** Declares the scopes an API key must hold to call this route. Pair with ApiKeyAuthGuard. */
export const ApiKeyScopes = (...scopes: string[]) => SetMetadata(API_KEY_SCOPES_KEY, scopes);
