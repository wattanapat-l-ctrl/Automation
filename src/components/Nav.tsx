"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bell,
  BellRing,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  UserCog,
  Wrench,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";

const ICONS: Record<string, React.ReactNode> = {
  "/dashboard": <LayoutDashboard className="h-4 w-4" />,
  "/machines": <Settings className="h-4 w-4" />,
  "/alarms": <BellRing className="h-4 w-4" />,
  "/maintenance": <Wrench className="h-4 w-4" />,
  "/audit": <ShieldCheck className="h-4 w-4" />,
  "/users": <UserCog className="h-4 w-4" />,
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
  const supabaseClient = createClient();
  const isAdmin = role === "admin";
  const { tick } = useRealtime(["alarms"]);

  const [openCount, setOpenCount] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [toast, setToast] = useState<string | null>(null);
  const prevCount = useRef<number | null>(null);
  const toastTimer = useRef(0);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setTheme(
        document.documentElement.classList.contains("dark") ? "dark" : "light"
      );
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      const { count } = await supabaseClient
        .from("alarms")
        .select("id", { count: "exact", head: true })
        .in("status", ["Open", "In Progress"]);
      if (!mounted) return;
      setOpenCount(count ?? 0);
      if (prevCount.current !== null && (count ?? 0) > prevCount.current) {
        setToast(
          `⚠ ${(count ?? 0) - prevCount.current} new alarm${(count ?? 0) - prevCount.current > 1 ? "s" : ""} detected`
        );
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 5000);
      }
      prevCount.current = count ?? 0;
    }
    void refresh();
    return () => {
      mounted = false;
      window.clearTimeout(toastTimer.current);
    };
  }, [supabaseClient, tick]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
  }

  const initials = (name || email || "U")
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/75 shadow-sm shadow-slate-950/5 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/75 dark:shadow-black/20">
      {toast && (
        <div className="absolute left-1/2 top-full z-30 -translate-x-1/2 rounded-xl border border-red-500/30 bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-xl animate-fade-up">
          {toast}
        </div>
      )}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-md shadow-sky-500/30">
              <Activity className="h-4 w-4" />
            </span>
            <span className="hidden text-sm font-semibold text-slate-900 sm:block dark:text-white">
              Alarm &amp; Maintenance
            </span>
          </Link>
          <span
            className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset md:inline ${
              isAdmin
                ? "bg-violet-500/15 text-violet-600 ring-violet-500/30 dark:text-violet-300"
                : role === "viewer"
                  ? "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300"
                  : "bg-sky-500/15 text-sky-600 ring-sky-500/30 dark:text-sky-300"
            }`}
          >
            {role}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/alarms"
            className="relative inline-flex shrink-0 items-center rounded-xl border border-slate-300/80 bg-white/60 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            title="Open alarms notification"
          >
            <Bell className="h-4 w-4" />
            {openCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {openCount > 99 ? "99+" : openCount}
              </span>
            )}
          </Link>

          <button
            onClick={toggleTheme}
            className="inline-flex shrink-0 items-center rounded-xl border border-slate-300/80 bg-white/60 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <Link
            href="/account"
            className="hidden shrink-0 items-center gap-2.5 rounded-xl px-2 py-1 transition hover:bg-slate-100/80 sm:flex dark:hover:bg-slate-800/60"
            title="My account"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-violet-600 text-xs font-bold text-white shadow-md shadow-sky-500/25">
              {initials || "U"}
            </span>
            <div className="hidden text-right lg:block">
              <p className="text-sm font-medium leading-tight text-slate-900 dark:text-white">
                {name || "User"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{email}</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            title="Log out"
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300/80 bg-white/60 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-red-500/40 hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      <nav className="border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2">
          {[...LINKS, ...(isAdmin ? [{ href: "/audit", label: "Audit Log" }, { href: "/users", label: "Users" }] : [])].map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex min-w-max items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-gradient-to-r from-sky-500/15 to-violet-500/15 text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-white dark:ring-white/10"
                    : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
                }`}
              >
                {ICONS[link.href]}
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}