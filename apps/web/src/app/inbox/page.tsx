"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatDate, confidenceLevel } from "@/lib/utils";
import type { DocumentType, InboxItemStatus, InboxItem } from "@/types/database";
import {
  FileText,
  Receipt,
  FileSignature,
  Mail,
  Ban,
  CreditCard,
  ChevronRight,
} from "lucide-react";

const typeIcons: Record<DocumentType, typeof FileText> = {
  incoming_invoice: Receipt,
  outgoing_invoice: FileText,
  credit_note: CreditCard,
  contract: FileSignature,
  general_correspondence: Mail,
  irrelevant: Ban,
};

const typeLabels: Record<DocumentType, string> = {
  incoming_invoice: "Eingangsrechnungen",
  outgoing_invoice: "Ausgangsrechnungen",
  credit_note: "Gutschriften",
  contract: "Verträge",
  general_correspondence: "Korrespondenz",
  irrelevant: "Irrelevant",
};

const statusLabels: Record<InboxItemStatus, string> = {
  processing: "In Verarbeitung",
  ready_for_review: "Zur Freigabe",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
  unclear: "Unklar",
  error: "Fehler",
};

const statusOptions = [
  { value: "", label: "Alle Status" },
  { value: "ready_for_review", label: "Zur Freigabe" },
  { value: "processing", label: "In Verarbeitung" },
  { value: "approved", label: "Freigegeben" },
  { value: "rejected", label: "Abgelehnt" },
  { value: "unclear", label: "Unklar" },
  { value: "error", label: "Fehler" },
];

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Wird geladen...</div>}>
      <InboxContent />
    </Suspense>
  );
}

function InboxContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") as InboxItemStatus | null;
  const [statusFilter, setStatusFilter] = useState<InboxItemStatus | "">(
    initialStatus ?? ""
  );

  const { data, isLoading } = trpc.inbox.list.useQuery({
    status: statusFilter || undefined,
    limit: 100,
    offset: 0,
  });

  // Group items by type
  const grouped = groupByType(data?.items ?? []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Posteingang</h1>
          <p className="text-muted-foreground">
            {data?.total ?? 0} Einträge gesamt
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as InboxItemStatus | "")
            }
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">
          Wird geladen...
        </div>
      ) : !data?.items.length ? (
        <div className="py-12 text-center text-muted-foreground">
          Keine Einträge gefunden
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = typeIcons[type as DocumentType] ?? FileText;
            return (
              <Card key={type}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className="h-5 w-5" />
                    {typeLabels[type as DocumentType] ?? type}
                    <Badge variant="secondary" className="ml-2">
                      {items.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 pt-0">
                  {items.map((item) => (
                    <InboxItemRow key={item.id} item={item} />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InboxItemRow({ item }: { item: InboxItem }) {
  const firstDoc = item.documents?.[0];
  const grossAmount = firstDoc?.extracted_data?.gross_amount;

  return (
    <Link
      href={`/inbox/${item.id}`}
      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {item.email_subject ?? "Kein Betreff"}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {item.email_from}
            {item.email_received_at &&
              ` · ${formatDate(item.email_received_at)}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {grossAmount != null && (
          <span className="font-medium">{formatCurrency(grossAmount)}</span>
        )}
        {item.company && (
          <Badge variant="outline">{item.company.name}</Badge>
        )}
        {item.overall_confidence != null && (
          <ConfidenceDot score={item.overall_confidence} />
        )}
        <StatusBadge status={item.status} />
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: InboxItemStatus }) {
  const variantMap: Record<InboxItemStatus, "default" | "secondary" | "success" | "warning" | "error" | "destructive" | "outline"> = {
    processing: "secondary",
    ready_for_review: "warning",
    approved: "success",
    rejected: "destructive",
    unclear: "warning",
    error: "error",
  };
  return (
    <Badge variant={variantMap[status]}>
      {statusLabels[status]}
    </Badge>
  );
}

function ConfidenceDot({ score }: { score: number }) {
  const level = confidenceLevel(score);
  const colors = {
    high: "bg-green-500",
    medium: "bg-yellow-500",
    low: "bg-red-500",
  };
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${colors[level]}`}
      title={`Confidence: ${Math.round(score * 100)}%`}
    />
  );
}

function groupByType(items: InboxItem[]): Record<string, InboxItem[]> {
  const groups: Record<string, InboxItem[]> = {};
  for (const item of items) {
    if (!groups[item.type]) {
      groups[item.type] = [];
    }
    groups[item.type].push(item);
  }
  return groups;
}
