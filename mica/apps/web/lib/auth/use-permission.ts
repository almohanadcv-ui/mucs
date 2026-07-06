import { useSession } from "./session-context";

/** UI-hiding convenience only — the API's PermissionsGuard is the real boundary. */
export function usePermission(key: string): boolean {
  const { user } = useSession();
  return user?.permissions.includes(key) ?? false;
}

export function usePermissions(): string[] {
  const { user } = useSession();
  return user?.permissions ?? [];
}
