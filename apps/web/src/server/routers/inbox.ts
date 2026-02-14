import { z } from "zod";
import { router, orgProcedure } from "../trpc";
import type { InboxItem, DocumentType, InboxItemStatus } from "@/types/database";

export const inboxRouter = router({
  /** List inbox items with filtering and pagination */
  list: orgProcedure
    .input(
      z.object({
        status: z
          .enum([
            "processing",
            "ready_for_review",
            "approved",
            "rejected",
            "unclear",
            "error",
          ])
          .optional(),
        type: z
          .enum([
            "incoming_invoice",
            "outgoing_invoice",
            "credit_note",
            "contract",
            "general_correspondence",
            "irrelevant",
          ])
          .optional(),
        companyId: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from("inbox_items")
        .select("*, company:companies(*), documents(*)", { count: "exact" })
        .eq("organization_id", ctx.organizationId)
        .order("email_received_at", { ascending: false })
        .range(input.offset, input.offset + input.limit - 1);

      if (input.status) {
        query = query.eq("status", input.status);
      }
      if (input.type) {
        query = query.eq("type", input.type);
      }
      if (input.companyId) {
        query = query.eq("company_id", input.companyId);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { items: data as InboxItem[], total: count ?? 0 };
    }),

  /** Get a single inbox item with all related data */
  getById: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("inbox_items")
        .select(
          "*, company:companies(*), documents(*, line_items(*))"
        )
        .eq("id", input.id)
        .eq("organization_id", ctx.organizationId)
        .single();

      if (error) throw error;
      return data as InboxItem;
    }),

  /** Approve an inbox item and trigger export */
  approve: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        companyId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("inbox_items")
        .update({
          status: "approved" as InboxItemStatus,
          company_id: input.companyId,
          approved_at: new Date().toISOString(),
          approved_by: ctx.userId,
        })
        .eq("id", input.id)
        .eq("organization_id", ctx.organizationId)
        .select()
        .single();

      if (error) throw error;

      // Log audit entry
      await ctx.supabase.from("audit_log").insert({
        organization_id: ctx.organizationId,
        user_id: ctx.userId,
        action: "approve",
        entity_type: "inbox_item",
        entity_id: input.id,
        changes: { status: { old: "ready_for_review", new: "approved" } },
      });

      return data;
    }),

  /** Reject an inbox item */
  reject: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("inbox_items")
        .update({
          status: "rejected" as InboxItemStatus,
          unclear_note: input.reason,
        })
        .eq("id", input.id)
        .eq("organization_id", ctx.organizationId)
        .select()
        .single();

      if (error) throw error;

      await ctx.supabase.from("audit_log").insert({
        organization_id: ctx.organizationId,
        user_id: ctx.userId,
        action: "reject",
        entity_type: "inbox_item",
        entity_id: input.id,
        changes: { status: { old: "ready_for_review", new: "rejected" } },
      });

      return data;
    }),

  /** Move an inbox item to the unclear queue */
  moveToUnclear: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        note: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("inbox_items")
        .update({
          status: "unclear" as InboxItemStatus,
          unclear_note: input.note,
        })
        .eq("id", input.id)
        .eq("organization_id", ctx.organizationId)
        .select()
        .single();

      if (error) throw error;

      await ctx.supabase.from("audit_log").insert({
        organization_id: ctx.organizationId,
        user_id: ctx.userId,
        action: "move_to_unclear",
        entity_type: "inbox_item",
        entity_id: input.id,
        changes: {
          status: { old: "ready_for_review", new: "unclear" },
          unclear_note: { old: null, new: input.note },
        },
      });

      return data;
    }),

  /** Update extracted fields on a document */
  updateDocumentFields: orgProcedure
    .input(
      z.object({
        documentId: z.string().uuid(),
        inboxItemId: z.string().uuid(),
        fields: z.record(z.unknown()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First get current data for audit log
      const { data: current } = await ctx.supabase
        .from("documents")
        .select("extracted_data")
        .eq("id", input.documentId)
        .single();

      const { data, error } = await ctx.supabase
        .from("documents")
        .update({
          extracted_data: {
            ...(current?.extracted_data ?? {}),
            ...input.fields,
          },
        })
        .eq("id", input.documentId)
        .select()
        .single();

      if (error) throw error;

      // Build change log
      const changes: Record<string, { old: unknown; new: unknown }> = {};
      for (const [key, value] of Object.entries(input.fields)) {
        changes[key] = {
          old: (current?.extracted_data as Record<string, unknown>)?.[key] ?? null,
          new: value,
        };
      }

      await ctx.supabase.from("audit_log").insert({
        organization_id: ctx.organizationId,
        user_id: ctx.userId,
        action: "edit_field",
        entity_type: "document",
        entity_id: input.documentId,
        changes,
      });

      return data;
    }),

  /** Get counts by status for dashboard stats */
  statusCounts: orgProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("inbox_items")
      .select("status")
      .eq("organization_id", ctx.organizationId);

    if (error) throw error;

    const counts: Record<string, number> = {
      processing: 0,
      ready_for_review: 0,
      approved: 0,
      rejected: 0,
      unclear: 0,
      error: 0,
    };

    for (const item of data ?? []) {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
    }

    return counts;
  }),
});
