export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight">MICA MAB Fleet</h1>
          <p className="text-sm text-muted-foreground">Fleet &amp; Maintenance Management</p>
        </div>
        {children}
      </div>
    </div>
  );
}
