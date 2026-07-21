import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { monthlyUploads } from "@/lib/data";
import { useStore } from "@/lib/store";

export function AppShell({ children, showNav = true }: { children: ReactNode; showNav?: boolean }) {
  const userName = useStore((s) => s.userName);
  const initial = userName.charAt(0).toUpperCase();
  return (
    <div className="min-h-screen bg-cream text-forest">
      {showNav && (
        <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-forest/5 bg-cream/85 px-5 py-3.5 backdrop-blur-md">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-full bg-sage">
              <div className="size-3 rounded-full bg-cream" />
            </div>
            <span className="font-serif text-xl font-semibold tracking-tight">NutriWise</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 rounded-full border border-sage/20 bg-sage/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-sage sm:inline-flex">
              <span className="size-1.5 rounded-full bg-sage animate-pulse" />
              {monthlyUploads} uploads
            </div>
            <Link
              to="/upload"
              className="rounded-full bg-forest px-3.5 py-1.5 text-xs font-medium text-cream transition-transform active:scale-95"
            >
              + Upload
            </Link>
            <Link
              to="/profile"
              aria-label={`Open profile for ${userName}`}
              className="grid size-9 place-items-center rounded-full border border-sage/30 bg-sage/10 font-serif text-sm font-semibold text-sage transition-colors hover:bg-sage/20"
            >
              {initial}
            </Link>
          </div>
        </nav>
      )}
      {children}
    </div>
  );
}
