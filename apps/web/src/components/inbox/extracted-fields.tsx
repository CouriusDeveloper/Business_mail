"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, confidenceLevel } from "@/lib/utils";
import type { Document } from "@/types/database";
import { Pencil, Check, X } from "lucide-react";

interface ExtractedFieldsProps {
  document: Document;
  inboxItemId: string;
  onUpdate: () => void;
}

const vatRateOptions = [
  { value: "0", label: "0%" },
  { value: "7", label: "7%" },
  { value: "19", label: "19%" },
];

const fieldLabels: Record<string, string> = {
  invoice_number: "Rechnungsnummer",
  invoice_date: "Rechnungsdatum",
  net_amount: "Nettobetrag",
  vat_rate: "USt-Satz",
  vat_amount: "USt-Betrag",
  gross_amount: "Bruttobetrag",
  supplier_name: "Lieferant",
  customer_name: "Kunde",
  vat_id: "USt-ID",
  iban: "IBAN",
  payment_terms: "Zahlungsziel",
  due_date: "Fälligkeitsdatum",
};

export function ExtractedFields({
  document,
  inboxItemId,
  onUpdate,
}: ExtractedFieldsProps) {
  const data = document.extracted_data;
  const confidences = document.field_confidences ?? {};

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Keine extrahierten Daten vorhanden
        </CardContent>
      </Card>
    );
  }

  const fields = [
    { key: "invoice_number", value: data.invoice_number, type: "text" as const },
    { key: "invoice_date", value: data.invoice_date, type: "date" as const },
    { key: "supplier_name", value: data.supplier_name, type: "text" as const },
    { key: "customer_name", value: data.customer_name, type: "text" as const },
    { key: "net_amount", value: data.net_amount, type: "currency" as const },
    { key: "vat_rate", value: data.vat_rate, type: "vat" as const },
    { key: "vat_amount", value: data.vat_amount, type: "currency" as const },
    { key: "gross_amount", value: data.gross_amount, type: "currency" as const },
    { key: "vat_id", value: data.vat_id, type: "text" as const },
    { key: "iban", value: data.iban, type: "text" as const },
    { key: "payment_terms", value: data.payment_terms, type: "text" as const },
    { key: "due_date", value: data.due_date, type: "date" as const },
  ];

  // Plausibility check: net + vat = gross
  const plausibilityOk =
    data.net_amount != null &&
    data.vat_amount != null &&
    data.gross_amount != null &&
    Math.abs(data.net_amount + data.vat_amount - data.gross_amount) < 0.02;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          Extrahierte Daten
          {data.net_amount != null && (
            <span
              className={cn(
                "text-xs",
                plausibilityOk ? "text-green-600" : "text-red-600"
              )}
            >
              {plausibilityOk ? "Plausibel" : "Betrag-Abweichung!"}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((field) => (
          <EditableField
            key={field.key}
            fieldKey={field.key}
            label={fieldLabels[field.key] ?? field.key}
            value={field.value}
            type={field.type}
            confidence={confidences[field.key]}
            documentId={document.id}
            inboxItemId={inboxItemId}
            onUpdate={onUpdate}
          />
        ))}

        {/* Line Items */}
        {data.line_items && data.line_items.length > 0 && (
          <div className="mt-4">
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Positionen
            </Label>
            <div className="space-y-2">
              {data.line_items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {item.position}. {item.description}
                  </span>
                  {item.total_price != null && (
                    <span className="ml-3 font-medium">
                      {formatCurrency(item.total_price)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Editable Field Component ───────────────────────────────

interface EditableFieldProps {
  fieldKey: string;
  label: string;
  value: unknown;
  type: "text" | "date" | "currency" | "vat";
  confidence?: number;
  documentId: string;
  inboxItemId: string;
  onUpdate: () => void;
}

function EditableField({
  fieldKey,
  label,
  value,
  type,
  confidence,
  documentId,
  inboxItemId,
  onUpdate,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ""));

  const updateMutation = trpc.inbox.updateDocumentFields.useMutation({
    onSuccess: () => {
      setEditing(false);
      onUpdate();
    },
  });

  function handleSave() {
    let parsedValue: unknown = editValue;
    if (type === "currency") {
      parsedValue = parseFloat(editValue);
    } else if (type === "vat") {
      parsedValue = parseFloat(editValue);
    }
    updateMutation.mutate({
      documentId,
      inboxItemId,
      fields: { [fieldKey]: parsedValue },
    });
  }

  const level = confidence != null ? confidenceLevel(confidence) : null;
  const borderColor = {
    high: "border-l-green-500",
    medium: "border-l-yellow-500",
    low: "border-l-red-500",
  };

  const displayValue =
    value == null
      ? "—"
      : type === "currency"
        ? formatCurrency(value as number)
        : type === "vat"
          ? `${value}%`
          : String(value);

  return (
    <div
      className={cn(
        "rounded-md border border-l-4 px-3 py-2",
        level ? borderColor[level] : "border-l-muted"
      )}
    >
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="flex items-center gap-1">
          {confidence != null && (
            <span className="text-xs text-muted-foreground">
              {Math.round(confidence * 100)}%
            </span>
          )}
          {!editing && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                setEditValue(String(value ?? ""));
                setEditing(true);
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {editing ? (
        <div className="mt-1 flex items-center gap-1">
          {type === "vat" ? (
            <Select
              options={vatRateOptions}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-8 text-sm"
            />
          ) : (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              type={type === "currency" ? "number" : "text"}
              step={type === "currency" ? "0.01" : undefined}
              className="h-8 text-sm"
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setEditing(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <p className="mt-0.5 text-sm font-medium">{displayValue}</p>
      )}
    </div>
  );
}
