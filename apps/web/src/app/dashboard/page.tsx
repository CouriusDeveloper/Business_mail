"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";

const statusConfig = {
  processing: {
    label: "In Verarbeitung",
    icon: Clock,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  ready_for_review: {
    label: "Zur Freigabe",
    icon: FileText,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  approved: {
    label: "Freigegeben",
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  rejected: {
    label: "Abgelehnt",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
  unclear: {
    label: "Unklar",
    icon: AlertCircle,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  error: {
    label: "Fehler",
    icon: AlertTriangle,
    color: "text-red-700",
    bgColor: "bg-red-50",
  },
} as const;

export default function DashboardPage() {
  const { data: counts, isLoading: countsLoading } =
    trpc.inbox.statusCounts.useQuery();
  const { data: recentItems, isLoading: itemsLoading } =
    trpc.inbox.list.useQuery({
      status: "ready_for_review",
      limit: 10,
      offset: 0,
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Überblick über Ihren Posteingang
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Object.entries(statusConfig).map(([key, config]) => {
          const Icon = config.icon;
          const count = counts?.[key] ?? 0;
          return (
            <Card key={key}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`rounded-md p-2 ${config.bgColor}`}>
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {countsLoading ? "–" : count}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {config.label}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Items for Review */}
      <Card>
        <CardHeader>
          <CardTitle>Zur Freigabe</CardTitle>
          <CardDescription>
            Belege die auf Ihre Freigabe warten
          </CardDescription>
        </CardHeader>
        <CardContent>
          {itemsLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Wird geladen...
            </div>
          ) : !recentItems?.items.length ? (
            <div className="py-8 text-center text-muted-foreground">
              Keine Belege zur Freigabe vorhanden
            </div>
          ) : (
            <div className="space-y-2">
              {recentItems.items.map((item) => (
                <Link
                  key={item.id}
                  href={`/inbox/${item.id}`}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {item.email_subject ?? "Kein Betreff"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.email_from} &middot;{" "}
                        {item.email_received_at
                          ? new Date(item.email_received_at).toLocaleDateString(
                              "de-DE"
                            )
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{typeLabel(item.type)}</Badge>
                    {item.company && (
                      <Badge variant="secondary">{item.company.name}</Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    incoming_invoice: "Eingangsrechnung",
    outgoing_invoice: "Ausgangsrechnung",
    credit_note: "Gutschrift",
    contract: "Vertrag",
    general_correspondence: "Korrespondenz",
    irrelevant: "Irrelevant",
  };
  return labels[type] ?? type;
}
