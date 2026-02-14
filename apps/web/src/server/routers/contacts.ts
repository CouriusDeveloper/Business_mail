import { z } from "zod";
import { router, orgProcedure } from "../trpc";
import type { Contact } from "@/types/database";

export const contactsRouter = router({
  /** List contacts with optional filtering */
  list: orgProcedure
    .input(
      z
        .object({
          companyId: z.string().uuid().optional(),
          type: z.enum(["supplier", "customer", "both"]).optional(),
          search: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from("contacts")
        .select("*", { count: "exact" })
        .eq("organization_id", ctx.organizationId)
        .order("name")
        .range(
          input?.offset ?? 0,
          (input?.offset ?? 0) + (input?.limit ?? 50) - 1
        );

      if (input?.companyId) {
        query = query.eq("company_id", input.companyId);
      }
      if (input?.type) {
        query = query.eq("type", input.type);
      }
      if (input?.search) {
        query = query.ilike("name", `%${input.search}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { contacts: data as Contact[], total: count ?? 0 };
    }),

  /** Create a new contact */
  create: orgProcedure
    .input(
      z.object({
        name: z.string().min(1),
        company_id: z.string().uuid().optional(),
        type: z.enum(["supplier", "customer", "both"]).default("supplier"),
        tax_id: z.string().optional(),
        iban: z.string().optional(),
        email_addresses: z.array(z.string().email()).default([]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("contacts")
        .insert({
          organization_id: ctx.organizationId,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Contact;
    }),

  /** Update a contact */
  update: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        company_id: z.string().uuid().optional(),
        type: z.enum(["supplier", "customer", "both"]).optional(),
        tax_id: z.string().optional(),
        iban: z.string().optional(),
        email_addresses: z.array(z.string().email()).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const { data, error } = await ctx.supabase
        .from("contacts")
        .update(updates)
        .eq("id", id)
        .eq("organization_id", ctx.organizationId)
        .select()
        .single();

      if (error) throw error;
      return data as Contact;
    }),

  /** Delete a contact */
  delete: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from("contacts")
        .delete()
        .eq("id", input.id)
        .eq("organization_id", ctx.organizationId);

      if (error) throw error;
      return { success: true };
    }),
});
