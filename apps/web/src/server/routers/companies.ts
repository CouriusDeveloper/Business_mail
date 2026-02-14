import { z } from "zod";
import { router, orgProcedure } from "../trpc";
import type { Company } from "@/types/database";

export const companiesRouter = router({
  /** List all companies for the current organization */
  list: orgProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("companies")
      .select("*")
      .eq("organization_id", ctx.organizationId)
      .order("name");

    if (error) throw error;
    return data as Company[];
  }),

  /** Get a single company */
  getById: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("companies")
        .select("*")
        .eq("id", input.id)
        .eq("organization_id", ctx.organizationId)
        .single();

      if (error) throw error;
      return data as Company;
    }),

  /** Create a new company */
  create: orgProcedure
    .input(
      z.object({
        name: z.string().min(1),
        tax_id: z.string().optional(),
        datev_upload_email: z.string().email().optional(),
        onedrive_folder_path: z.string().optional(),
        export_target: z.enum(["datev", "onedrive", "both"]).default("datev"),
        filename_schema: z
          .string()
          .default("{type}_{date}_{supplier}_{amount}"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("companies")
        .insert({
          organization_id: ctx.organizationId,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Company;
    }),

  /** Update company settings */
  update: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        tax_id: z.string().optional(),
        datev_upload_email: z.string().email().optional(),
        onedrive_folder_path: z.string().optional(),
        export_target: z.enum(["datev", "onedrive", "both"]).optional(),
        filename_schema: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const { data, error } = await ctx.supabase
        .from("companies")
        .update(updates)
        .eq("id", id)
        .eq("organization_id", ctx.organizationId)
        .select()
        .single();

      if (error) throw error;
      return data as Company;
    }),

  /** Delete a company */
  delete: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from("companies")
        .delete()
        .eq("id", input.id)
        .eq("organization_id", ctx.organizationId);

      if (error) throw error;
      return { success: true };
    }),
});
