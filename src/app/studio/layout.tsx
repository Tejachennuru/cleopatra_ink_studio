// Middleware already enforces auth for /studio/* — this layout is a pass-through.
// The per-page components fetch their own staff session client-side for UI data.
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
