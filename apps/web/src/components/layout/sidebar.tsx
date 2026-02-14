"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Inbox,
  Building2,
  Users,
  Contact,
  Settings,
  AlertCircle,
  LayoutDashboard,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Posteingang", href: "/inbox", icon: Inbox },
  { name: "Unklar", href: "/inbox?status=unclear", icon: AlertCircle },
  { name: "Unternehmen", href: "/settings/companies", icon: Building2 },
  { name: "Kontakte", href: "/settings/contacts", icon: Contact },
  { name: "Benutzer", href: "/settings/users", icon: Users },
  { name: "Einstellungen", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Inbox className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Inbox Agent</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href.split("?")[0]));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
