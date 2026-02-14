"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Building2, Shield, CheckCircle } from "lucide-react";

export default function OrganizationSettingsPage() {
  const { data: org, isLoading } = trpc.organization.get.useQuery();
  const utils = trpc.useUtils();
  const updateMutation = trpc.organization.update.useMutation({
    onSuccess: () => {
      utils.organization.get.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const [name, setName] = useState("");
  const [inboxEmail, setInboxEmail] = useState("");
  const [ms365TenantId, setMs365TenantId] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (org) {
      setName(org.name);
      setInboxEmail(org.inbox_email ?? "");
      setMs365TenantId(org.ms365_tenant_id ?? "");
    }
  }, [org]);

  function handleSave() {
    updateMutation.mutate({
      name,
      inbox_email: inboxEmail,
      ms365_tenant_id: ms365TenantId,
    });
  }

  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Wird geladen...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organisation</h1>
        <p className="text-muted-foreground">
          Organisationsname und E-Mail-Posteingang konfigurieren
        </p>
      </div>

      {/* Organization name */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Organisationsname</CardTitle>
              <CardDescription>
                Der Name Ihrer Organisation
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="orgName">Name</Label>
            <Input
              id="orgName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mein Unternehmen"
            />
          </div>
        </CardContent>
      </Card>

      {/* Email inbox */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">E-Mail-Posteingang</CardTitle>
              <CardDescription>
                Die E-Mail-Adresse, die als Posteingang verwendet wird.
                Eingehende E-Mails werden automatisch verarbeitet.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inboxEmail">Posteingang E-Mail</Label>
            <Input
              id="inboxEmail"
              type="email"
              value={inboxEmail}
              onChange={(e) => setInboxEmail(e.target.value)}
              placeholder="inbox@ihre-firma.de"
            />
          </div>
          {org?.inbox_email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Posteingang konfiguriert: {org.inbox_email}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Microsoft 365 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Microsoft 365 Anbindung</CardTitle>
              <CardDescription>
                Verbinden Sie Ihren Microsoft 365 Mandanten, um E-Mails
                automatisch abzurufen.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenantId">Microsoft 365 Tenant-ID</Label>
            <Input
              id="tenantId"
              value={ms365TenantId}
              onChange={(e) => setMs365TenantId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
            <p className="text-xs text-muted-foreground">
              Ihre Azure AD / Entra ID Mandanten-ID. Zu finden im Azure Portal
              unter Azure Active Directory.
            </p>
          </div>
          {org?.graph_webhook_id && (
            <div className="flex items-center gap-2">
              <Badge variant="success">Webhook aktiv</Badge>
              {org.graph_webhook_expiry && (
                <span className="text-xs text-muted-foreground">
                  Gültig bis:{" "}
                  {new Date(org.graph_webhook_expiry).toLocaleDateString(
                    "de-DE"
                  )}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isLoading || !name}
        >
          {updateMutation.isLoading ? "Wird gespeichert..." : "Speichern"}
        </Button>
        {saved && (
          <span className="text-sm text-green-600">
            Einstellungen gespeichert
          </span>
        )}
        {updateMutation.error && (
          <span className="text-sm text-destructive">
            Fehler: {updateMutation.error.message}
          </span>
        )}
      </div>
    </div>
  );
}
