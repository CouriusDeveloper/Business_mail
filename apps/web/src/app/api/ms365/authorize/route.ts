import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

/**
 * GET /api/ms365/authorize
 * Starts the Microsoft 365 OAuth Authorization Code flow.
 * Redirects the user to the Microsoft login page.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  // Ensure user is authenticated
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  // Look up user's organization
  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.redirect(
      `${origin}/settings/organization?error=no_org`
    );
  }

  const clientId = process.env.AZURE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(
      `${origin}/settings/organization?error=not_configured`
    );
  }

  // Generate state parameter (org_id + CSRF token)
  const csrfToken = randomBytes(16).toString("hex");
  const state = `${profile.organization_id}:${csrfToken}`;

  // Store CSRF token in a short-lived cookie
  const redirectUri = `${origin}/api/ms365/callback`;
  const scopes = [
    "Mail.Read",
    "Mail.ReadWrite",
    "Mail.Send",
    "User.Read",
    "offline_access",
  ].join(" ");

  // Build Microsoft OAuth authorize URL (multi-tenant: /common/)
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes,
    state,
    response_mode: "query",
    prompt: "consent",
  });

  const authorizeUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

  const response = NextResponse.redirect(authorizeUrl);

  // Set state cookie for CSRF verification in callback
  response.cookies.set("ms365_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
