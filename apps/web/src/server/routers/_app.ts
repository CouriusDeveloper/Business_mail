import { router } from "../trpc";
import { inboxRouter } from "./inbox";
import { companiesRouter } from "./companies";
import { contactsRouter } from "./contacts";

export const appRouter = router({
  inbox: inboxRouter,
  companies: companiesRouter,
  contacts: contactsRouter,
});

export type AppRouter = typeof appRouter;
