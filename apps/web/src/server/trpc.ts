import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface Context {
  supabase: ReturnType<typeof createServerSupabaseClient>;
  userId: string | null;
  organizationId: string | null;
}

export async function createContext(): Promise<Context> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let organizationId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();
    organizationId = profile?.organization_id ?? null;
  }

  return {
    supabase,
    userId: user?.id ?? null,
    organizationId,
  };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Middleware: require authenticated user */
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

/** Middleware: require authenticated user with organization */
const hasOrganization = t.middleware(({ ctx, next }) => {
  if (!ctx.userId || !ctx.organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No organization assigned",
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      organizationId: ctx.organizationId,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);
export const orgProcedure = t.procedure.use(hasOrganization);
