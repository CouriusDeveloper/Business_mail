import { createServiceRoleClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * GET /api/ms365/callback
 * Handles the Microsoft 365 OAuth callback.
 * Exchanges the authorization code for access + refresh tokens,
 * then stores them in the organization record.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const settingsUrl = `${origin}/settings/organization`;

  // Handle OAuth errors
  if (error) {
    console.error("MS365 OAuth error:", error, errorDescription);
    return NextResponse.redirect(
      `${settingsUrl}?ms365_error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}?ms365_error=missing_params`);
  }

  // Verify CSRF state
  const cookieStore = cookies();
  const storedState = cookieStore.get("ms365_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${settingsUrl}?ms365_error=invalid_state`);
  }

  // Extract organization ID from state
  const organizationId = state.split(":")[0];
  if (!organizationId) {
    return NextResponse.redirect(`${settingsUrl}?ms365_error=invalid_state`);
  }

  // Exchange code for tokens
  const clientId = process.env.AZURE_CLIENT_ID!;
  const clientSecret = process.env.AZURE_CLIENT_SECRET!;
  const redirectUri = `${origin}/api/ms365/callback`;

  const tokenResponse = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: "Mail.Read Mail.ReadWrite Mail.Send User.Read offline_access",
      }),
    }
  );

  if (!tokenResponse.ok) {
    const tokenError = await tokenResponse.text();
    console.error("MS365 token exchange failed:", tokenError);
    return NextResponse.redirect(
      `${settingsUrl}?ms365_error=token_exchange_failed`
    );
  }

  const tokens = await tokenResponse.json();
  const accessToken: string = tokens.access_token;
  const refreshToken: string = tokens.refresh_token;
  const expiresIn: number = tokens.ext_expires_in || tokens.expires_in || 3600;

  // Extract tenant ID from the id_token (JWT payload)
  let tenantId: string | null = null;
  if (tokens.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(tokens.id_token.split(".")[1], "base64").toString()
      );
      tenantId = payload.tid || null;
    } catch {
      // Non-critical: tenant ID can be extracted from /me call
    }
  }

  // Fetch the connected user's email from Microsoft Graph
  const meResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let connectedEmail = "";
  if (meResponse.ok) {
    const meData = await meResponse.json();
    connectedEmail = meData.mail || meData.userPrincipalName || "";
    if (!tenantId) {
      // Fallback: get tenant from /me/organization
      // The tid is usually available in the /me response indirectly
    }
  }

  // Calculate token expiry
  const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Store tokens in the organization (using service role to bypass RLS)
  const serviceClient = createServiceRoleClient();
  const { error: updateError } = await serviceClient
    .from("organizations")
    .update({
      ms365_access_token: accessToken,
      ms365_refresh_token: refreshToken,
      ms365_token_expiry: tokenExpiry,
      ms365_tenant_id: tenantId,
      ms365_connected_email: connectedEmail,
      ms365_connected: true,
      inbox_email: connectedEmail || undefined,
    })
    .eq("id", organizationId);

  if (updateError) {
    console.error("Failed to store MS365 tokens:", updateError);
    return NextResponse.redirect(
      `${settingsUrl}?ms365_error=storage_failed`
    );
  }

  // Clear the state cookie
  const response = NextResponse.redirect(
    `${settingsUrl}?ms365_connected=true`
  );
  response.cookies.delete("ms365_oauth_state");

  return response;
}
