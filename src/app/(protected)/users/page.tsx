"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PenLine, RefreshCcw, Save, Search, ShieldAlert, UserCog, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { inputClass, btnSecondary } from "@/components/ui/Field";
import { useAuth } from "@/hooks/useAuth";
import type { Profile } from "@/lib/supabase/types";

const ROLES = ["admin", "technician", "viewer"] as const;

const ROLE_SELECT: Record<string, string> = {
  admin: "border-violet-500/50 text-violet-600 dark:border-violet-500/40 dark:text-violet-300",
  technician:
    "border-sky-500/50 text-sky-600 dark:border-sky-500/40 dark:text-sky-300",
  viewer:
    "border-emerald-500/50 text-emerald-600 dark:border-emerald-500/40 dark:text-emerald-300",
};

export default function UsersPage() {
  const { loading: authLoading, isAdmin, profile: me } = useAuth();
  const supabase = createClient();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef(0);

  const load = useCallback(() => {
    return supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }
        setUsers((data ?? []) as Profile[]);
        setLoading(false);
      });
  }, [supabase]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  function flash(msg: string) {
    setNotice(msg);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3000);
  }

  async function changeRole(u: Profile, role: Profile["role"]) {
    if (u.id === me?.id) return;
    setBusyId(u.id);
    setError(null);
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", u.id);
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    flash(`${u.email} is now ${role.toUpperCase()}.`);
    void load();
  }

  async function saveName(u: Profile) {
    const name = nameDraft.trim();
    if (!name) return;
    setBusyId(u.id);
    setError(null);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name })
      .eq("id", u.id);
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingId(null);
    flash(`Display name updated.`);
    void load();
  }

  function startRename(u: Profile) {
    setEditingId(u.id);
    setNameDraft(u.full_name ?? "");
  }

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      (u.full_name ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const roleCounts: Record<Profile["role"], number> = {
    admin: users.filter((u) => u.role === "admin").length,
    technician: users.filter((u) => u.role === "technician").length,
    viewer: users.filter((u) => u.role === "viewer").length,
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        Loading users…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-500" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          User management is restricted to administrators only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<UserCog className="h-5 w-5" />}
        iconClass="from-violet-500 to-fuchsia-600"
        title="Users"
        subtitle={`Manage user accounts and roles · ${users.length} users`}
        actions={
          <button onClick={() => load()} className={btnSecondary} title="Refresh">
            <RefreshCcw className="h-4 w-4" />
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-300 animate-fade-in">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {ROLES.map((r) => (
          <div
            key={r}
            className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70"
          >
            <div className="flex items-center justify-between">
              <Badge value={r} />
              <span className="text-xl font-bold text-slate-900 dark:text-white">
                {roleCounts[r]}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-3 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or role…"
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Member Since</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-14 text-center text-slate-400">
                    No users found.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const isSelf = u.id === me?.id;
                  const initials = (u.full_name || u.email || "U")
                    .split(/[\s@]+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((s) => s[0]?.toUpperCase() ?? "")
                    .join("");
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-500 to-slate-700 text-xs font-bold text-white">
                            {initials || "U"}
                          </span>
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 truncate font-medium text-slate-900 dark:text-white">
                              {(u.full_name || u.email || "User").split("@")[0]}
                              {isSelf && (
                                <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-600 ring-1 ring-inset ring-sky-500/30 dark:text-sky-300">
                                  you
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-slate-400">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {isSelf ? (
                          <Badge value={u.role} />
                        ) : (
                          <select
                            value={u.role}
                            disabled={busyId === u.id}
                            onChange={(e) =>
                              changeRole(u, e.target.value as Profile["role"])
                            }
                            title={
                              isSelf
                                ? "You cannot change your own role"
                                : "Change role"
                            }
                            className={`rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-sky-500/30 disabled:opacity-50 dark:bg-slate-800 ${ROLE_SELECT[u.role]}`}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r.charAt(0).toUpperCase() + r.slice(1)}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(u.created_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-2">
                          {editingId === u.id ? (
                            <>
                              <input
                                value={nameDraft}
                                onChange={(e) => setNameDraft(e.target.value)}
                                className={`${inputClass} max-w-52 py-1.5 text-xs`}
                                placeholder="Display name"
                              />
                              <button
                                onClick={() => saveName(u)}
                                disabled={busyId === u.id}
                                className="rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                title="Save name"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => startRename(u)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-sky-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-sky-400"
                              title="Edit display name"
                            >
                              <PenLine className="h-3.5 w-3.5" />
                              Rename
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}