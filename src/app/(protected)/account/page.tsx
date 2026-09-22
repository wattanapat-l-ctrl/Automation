"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Field, inputClass, btnPrimary, btnSecondary } from "@/components/ui/Field";
import { useAuth } from "@/hooks/useAuth";

export default function AccountPage() {
  const { loading, profile, user } = useAuth();
  const supabase = createClient();

  const [nameDraft, setNameDraft] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passSaving, setPassSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const msgTimer = useRef(0);

  useEffect(() => {
    if (!profile) return;
    const t = window.setTimeout(() => setNameDraft(profile.full_name ?? ""), 0);
    return () => window.clearTimeout(t);
  }, [profile]);

  function flash(ok: boolean, text: string) {
    setMessage({ ok, text });
    window.clearTimeout(msgTimer.current);
    msgTimer.current = window.setTimeout(() => setMessage(null), 4000);
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const name = nameDraft.trim();
    if (!name) {
      flash(false, "Name cannot be empty.");
      return;
    }
    setNameSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name })
      .eq("id", profile.id);
    setNameSaving(false);
    if (error) {
      flash(false, `Failed to update name: ${error.message}`);
      return;
    }
    flash(true, "Display name updated.");
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      flash(false, "Please enter a new password.");
      return;
    }
    if (password.length < 6) {
      flash(false, "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      flash(false, "Passwords do not match.");
      return;
    }
    setPassSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPassSaving(false);
    if (error) {
      flash(false, `Failed to change password: ${error.message}`);
      return;
    }
    setPassword("");
    setConfirm("");
    flash(true, "Password changed successfully.");
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        Loading account…
      </div>
    );
  }

  const initials = (profile?.full_name || user?.email || "U")
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<UserRound className="h-5 w-5" />}
        iconClass="from-sky-500 to-violet-600"
        title="My Account"
        subtitle="Manage your profile and password"
      />

      {message && (
        <div
          className={`rounded-xl border p-3 text-sm animate-fade-in ${
            message.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-violet-600 text-lg font-bold text-white shadow-lg shadow-sky-500/25">
              {initials || "U"}
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {profile?.full_name || user?.email?.split("@")[0] || "User"}
              </h2>
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Mail className="h-3.5 w-3.5" />
                {user?.email}
              </div>
            </div>
            <div className="ml-auto">
              <Badge value={profile?.role ?? "technician"} />
            </div>
          </div>

          <form onSubmit={saveName} className="mt-6 space-y-4">
            <Field label="Display name">
              <input
                className={inputClass}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Your full name"
              />
            </Field>
            <div className="flex justify-end">
              <button type="submit" disabled={nameSaving} className={btnPrimary}>
                <Save className="h-4 w-4" />
                {nameSaving ? "Saving…" : "Save name"}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md shadow-red-500/30">
              <KeyRound className="h-4 w-4" />
            </span>
            Change Password
          </h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Update the password you use to sign in to this system.
          </p>

          <form onSubmit={changePassword} className="space-y-4">
            <Field label="New password" required>
              <input
                type="password"
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm new password" required>
              <input
                type="password"
                className={inputClass}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />
            </Field>
            <div className="flex justify-end">
              <button type="submit" disabled={passSaving} className={btnSecondary}>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                {passSaving ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}