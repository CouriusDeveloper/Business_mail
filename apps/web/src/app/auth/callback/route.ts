import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Auto-provision: ensure user has an organization
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const serviceClient = createServiceRoleClient();
        const { data: existingUser } = await serviceClient
          .from("users")
          .select("id")
          .eq("id", user.id)
          .single();

        if (!existingUser) {
          // Create a default organization and user record
          const { data: org } = await serviceClient
            .from("organizations")
            .insert({
              name: user.email?.split("@")[0] ?? "Mein Unternehmen",
              slug: user.id.slice(0, 8),
            })
            .select("id")
            .single();

          if (org) {
            await serviceClient.from("users").insert({
              id: user.id,
              organization_id: org.id,
              email: user.email ?? "",
              name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? null,
            });
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth code exchange failed, redirect to login
  return NextResponse.redirect(`${origin}/auth/login`);
}
