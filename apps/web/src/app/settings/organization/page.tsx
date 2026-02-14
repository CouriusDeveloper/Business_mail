"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
import {
  Mail,
  Building2,
  CheckCircle,
  XCircle,
  Link as LinkIcon,
  Unlink,
  AlertCircle,
} from "lucide-react";

export default function OrganizationSettingsPage() {
  const searchParams = useSearchParams();
  const { data: org, isLoading } = trpc.organization.get.useQuery();
  const utils = trpc.useUtils();

  const updateMutation = trpc.organization.update.useMutation({
    onSuccess: () => {
      utils.organization.get.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const disconnectMutation = trpc.organization.ms365Disconnect.useMutation({
    onSuccess: () => {
      utils.organization.get.invalidate();
    },
  });

  const [name, setName] = useState("");
  const [inboxEmail, setInboxEmail] = useState("");
  const [saved, setSaved] = useState(false);

  // Check for OAuth callback messages in URL params
  const ms365Connected = searchParams.get("ms365_connected");
  const ms365Error = searchParams.get("ms365_error");

  useEffect(() => {
    if (org) {
      setName(org.name);
      setInboxEmail(org.inbox_email ?? "");
    }
  }, [org]);

  function handleSave() {
    updateMutation.mutate({
      name,
      inbox_email: inboxEmail,
    });
  }

  function handleMs365Connect() {
    window.location.href = "/api/ms365/authorize";
  }

  function handleMs365Disconnect() {
    if (
      window.confirm(
        "Microsoft 365 Verbindung wirklich trennen? E-Mails werden nicht mehr automatisch abgerufen."
      )
    ) {
      disconnectMutation.mutate();
    }
  }

  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Wird geladen...
      </div>
    );
  }

  const isConnected = org?.ms365_connected;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organisation</h1>
        <p className="text-muted-foreground">
          Organisationsname und E-Mail-Posteingang konfigurieren
        </p>
      </div>

      {/* OAuth callback status messages */}
      {ms365Connected && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <span>
            Microsoft 365 wurde erfolgreich verbunden! E-Mails werden ab sofort
            automatisch abgerufen.
          </span>
        </div>
      )}
      {ms365Error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>
            Fehler bei der Microsoft 365 Verbindung:{" "}
            {decodeURIComponent(ms365Error)}
          </span>
        </div>
      )}

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

      {/* Microsoft 365 Connection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary/10 p-2">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">
                Microsoft 365 Posteingang
              </CardTitle>
              <CardDescription>
                Verbinden Sie Ihr Microsoft 365 Konto, um E-Mails automatisch
                abzurufen und zu verarbeiten.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected ? (
            <>
              {/* Connected state */}
              <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-green-900">Verbunden</p>
                  <p className="text-sm text-green-700">
                    {org.ms365_connected_email}
                  </p>
                </div>
                <Badge variant="success">Aktiv</Badge>
              </div>

              {org?.graph_webhook_id && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Webhook aktiv
                  {org.graph_webhook_expiry && (
                    <span>
                      &middot; Gültig bis{" "}
                      {new Date(org.graph_webhook_expiry).toLocaleDateString(
                        "de-DE"
                      )}
                    </span>
                  )}
                </div>
              )}

              {/* Inbox email override */}
              <div className="space-y-2 pt-2">
                <Label htmlFor="inboxEmail">
                  Posteingang E-Mail (optional abweichend)
                </Label>
                <Input
                  id="inboxEmail"
                  type="email"
                  value={inboxEmail}
                  onChange={(e) => setInboxEmail(e.target.value)}
                  placeholder={
                    org.ms365_connected_email ?? "inbox@ihre-firma.de"
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Standardmäßig wird die verbundene E-Mail-Adresse verwendet.
                  Sie können hier eine andere Adresse angeben (z.B. ein Shared
                  Mailbox).
                </p>
              </div>

              <Button
                variant="outline"
                onClick={handleMs365Disconnect}
                disabled={disconnectMutation.isPending}
                className="text-destructive hover:text-destructive"
              >
                <Unlink className="mr-2 h-4 w-4" />
                {disconnectMutation.isPending
                  ? "Wird getrennt..."
                  : "Verbindung trennen"}
              </Button>
            </>
          ) : (
            <>
              {/* Disconnected state */}
              <div className="flex items-center gap-3 rounded-lg border border-muted bg-muted/30 p-4">
                <XCircle className="h-6 w-6 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">Nicht verbunden</p>
                  <p className="text-sm text-muted-foreground">
                    Klicken Sie auf den Button unten, um sich mit Ihrem Microsoft
                    365 Konto anzumelden.
                  </p>
                </div>
              </div>

              <Button onClick={handleMs365Connect}>
                <LinkIcon className="mr-2 h-4 w-4" />
                Mit Microsoft 365 verbinden
              </Button>

              <p className="text-xs text-muted-foreground">
                Sie werden zur Microsoft-Anmeldeseite weitergeleitet. Die App
                benötigt Zugriff auf Ihren E-Mail-Posteingang (Mail.Read).
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending || !name}
        >
          {updateMutation.isPending ? "Wird gespeichert..." : "Speichern"}
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
