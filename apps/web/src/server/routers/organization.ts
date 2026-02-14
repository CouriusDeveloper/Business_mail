import { z } from "zod";
import { router, orgProcedure } from "../trpc";
import type { Organization } from "@/types/database";

/** Fields safe to return to the client (excludes tokens) */
function sanitizeOrg(org: Organization) {
  const { ms365_access_token, ms365_refresh_token, ...safe } = org;
  return safe;
}

export const organizationRouter = router({
  /** Get the current user's organization (tokens excluded) */
  get: orgProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("organizations")
      .select("*")
      .eq("id", ctx.organizationId)
      .single();

    if (error) throw error;
    return sanitizeOrg(data as Organization);
  }),

  /** Update organization settings (name, email config) */
  update: orgProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        inbox_email: z.string().email().optional().or(z.literal("")),
        ms365_tenant_id: z.string().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.inbox_email !== undefined)
        updates.inbox_email = input.inbox_email || null;
      if (input.ms365_tenant_id !== undefined)
        updates.ms365_tenant_id = input.ms365_tenant_id || null;

      const { data, error } = await ctx.supabase
        .from("organizations")
        .update(updates)
        .eq("id", ctx.organizationId)
        .select()
        .single();

      if (error) throw error;
      return sanitizeOrg(data as Organization);
    }),

  /** Disconnect Microsoft 365 – removes stored OAuth tokens */
  ms365Disconnect: orgProcedure.mutation(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("organizations")
      .update({
        ms365_access_token: null,
        ms365_refresh_token: null,
        ms365_token_expiry: null,
        ms365_connected_email: null,
        ms365_connected: false,
        ms365_tenant_id: null,
      })
      .eq("id", ctx.organizationId)
      .select()
      .single();

    if (error) throw error;
    return sanitizeOrg(data as Organization);
  }),
});
