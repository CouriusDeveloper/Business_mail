import { router } from "../trpc";
import { inboxRouter } from "./inbox";
import { companiesRouter } from "./companies";
import { contactsRouter } from "./contacts";
import { organizationRouter } from "./organization";

export const appRouter = router({
  inbox: inboxRouter,
  companies: companiesRouter,
  contacts: contactsRouter,
  organization: organizationRouter,
});

export type AppRouter = typeof appRouter;
