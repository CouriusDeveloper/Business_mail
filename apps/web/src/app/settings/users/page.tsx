"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users } from "lucide-react";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Benutzer</h1>
        <p className="text-muted-foreground">
          Benutzer und Rollenverwaltung
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Benutzerverwaltung</CardTitle>
              <CardDescription>
                Einladung neuer Benutzer und Rollenzuweisung. Verfügbare Rollen:
                Admin, Sachbearbeiter, Viewer.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Die Benutzerverwaltung wird in einer kommenden Version erweitert.
          Aktuell können Benutzer über Supabase Auth eingeladen werden.
        </CardContent>
      </Card>
    </div>
  );
}
