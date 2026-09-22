"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BellRingIcon,
  LayoutDashboard,
  LogOut,
  Settings,
  Wrench,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  "/dashboard": <LayoutDashboard className="h-4 w-4" />,
  "/machines": <Settings className="h-4 w-4" />,
  "/alarms": <BellRingIcon className="h-4 w-4" />,
  "/maintenance": <Wrench className="h-4 w-4" />,
};

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/machines", label: "Machines" },
  { href: "/alarms", label: "Alarms" },
  { href: "/maintenance", label: "Maintenance" },
];

export default function Nav({
  name,
  role,
  email,
}: {
  name: string;
  role: string;
  email: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 ring-1 ring-sky-400/30">
            <Activity className="h-4 w-4 text-sky-400" />
          </span>
          <span className="hidden text-sm font-semibold text-white sm:block">
            Alarm &amp; Maintenance
          </span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                {ICONS[link.href]}
                <span className="hidden md:inline">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-white">{name || "User"}</p>
            <p className="text-xs text-slate-400">
              <span
                className={`inline-block rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${
                  role === "admin"
                    ? "bg-violet-500/20 text-violet-300"
                    : role === "viewer"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-sky-500/20 text-sky-300"
                }`}
              >
                {role}
              </span>{" "}
              {email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-red-500/40 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}