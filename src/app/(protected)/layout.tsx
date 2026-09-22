import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";

export default async function ProtectedLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    const fullName =
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : undefined;
    await supabase
      .from("profiles")
      .insert({ id: user.id, email: user.email, full_name: fullName });
  }

  return (
    <div className="min-h-screen">
      <Nav
        name={profile?.full_name || user.email?.split("@")[0] || "User"}
        role={profile?.role || "technician"}
        email={user.email || ""}
      />
      <main className="mx-auto max-w-7xl px-4 py-6 animate-fade-in">
        {children}
      </main>
    </div>
  );
}