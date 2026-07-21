/**
 * Pages reachable without a session, opened straight from an email.
 *
 * Deliberately outside the dashboard shell: there is no nav to show someone who
 * is not signed in, and its auth guard would bounce them to the login screen —
 * which is exactly the detour these pages exist to avoid.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 justify-center bg-muted/30 p-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight">MICA MAB Fleet</h1>
          <p className="text-sm text-muted-foreground">Fleet &amp; Maintenance Management</p>
        </div>
        {children}
      </div>
    </div>
  );
}
