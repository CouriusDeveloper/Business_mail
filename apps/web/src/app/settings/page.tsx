"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Contact, Users, Settings, Mail, Shield } from "lucide-react";

const settingsCards = [
  {
    title: "Unternehmen",
    description: "Unternehmen, DATEV Upload Mail und OneDrive-Konfiguration",
    href: "/settings/companies",
    icon: Building2,
  },
  {
    title: "Kontakte",
    description: "Lieferanten- und Kunden-Stammdaten verwalten",
    href: "/settings/contacts",
    icon: Contact,
  },
  {
    title: "Benutzer",
    description: "Benutzer und Rollen verwalten",
    href: "/settings/users",
    icon: Users,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Einstellungen</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Ihre Organisation und Konfiguration
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-primary/10 p-2">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{card.title}</CardTitle>
                      <CardDescription>{card.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
