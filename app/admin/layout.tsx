import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Daily Glow — Admin",
  robots: { index: false, follow: false },
};

// Pure-Tailwind island: explicit colors on every element so nothing from the
// site-wide daisyui theme (data-theme on <html>) bleeds into the dashboard.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased [color-scheme:dark]">
      {children}
    </div>
  );
}
