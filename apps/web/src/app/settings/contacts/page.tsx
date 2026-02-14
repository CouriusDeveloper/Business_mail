"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Contact, Plus, Search } from "lucide-react";

const typeOptions = [
  { value: "supplier", label: "Lieferant" },
  { value: "customer", label: "Kunde" },
  { value: "both", label: "Beides" },
];

const typeLabels: Record<string, string> = {
  supplier: "Lieferant",
  customer: "Kunde",
  both: "Lieferant & Kunde",
};

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "supplier" as "supplier" | "customer" | "both",
    tax_id: "",
    iban: "",
    email_addresses: [] as string[],
    notes: "",
  });
  const [emailInput, setEmailInput] = useState("");

  const { data, isLoading, refetch } = trpc.contacts.list.useQuery({
    search: search || undefined,
    limit: 100,
    offset: 0,
  });

  const createMutation = trpc.contacts.create.useMutation({
    onSuccess: () => {
      setShowForm(false);
      setFormData({
        name: "",
        type: "supplier",
        tax_id: "",
        iban: "",
        email_addresses: [],
        notes: "",
      });
      refetch();
    },
  });

  function addEmail() {
    if (emailInput && !formData.email_addresses.includes(emailInput)) {
      setFormData((d) => ({
        ...d,
        email_addresses: [...d.email_addresses, emailInput],
      }));
      setEmailInput("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate(formData);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kontakte</h1>
          <p className="text-muted-foreground">
            Lieferanten- und Kunden-Stammdaten
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Kontakt
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Kontakt suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Neuer Kontakt</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((d) => ({ ...d, name: e.target.value }))
                    }
                    placeholder="TechSupply GmbH"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Typ</Label>
                  <Select
                    options={typeOptions}
                    value={formData.type}
                    onChange={(e) =>
                      setFormData((d) => ({
                        ...d,
                        type: e.target.value as "supplier" | "customer" | "both",
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>USt-ID</Label>
                  <Input
                    value={formData.tax_id}
                    onChange={(e) =>
                      setFormData((d) => ({ ...d, tax_id: e.target.value }))
                    }
                    placeholder="DE987654321"
                  />
                </div>
                <div className="space-y-2">
                  <Label>IBAN</Label>
                  <Input
                    value={formData.iban}
                    onChange={(e) =>
                      setFormData((d) => ({ ...d, iban: e.target.value }))
                    }
                    placeholder="DE89 3704 0044 0532 0130 00"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>E-Mail-Adressen</Label>
                  <div className="flex gap-2">
                    <Input
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="rechnung@example.de"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addEmail();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addEmail}>
                      Hinzufügen
                    </Button>
                  </div>
                  {formData.email_addresses.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {formData.email_addresses.map((email) => (
                        <Badge
                          key={email}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() =>
                            setFormData((d) => ({
                              ...d,
                              email_addresses: d.email_addresses.filter(
                                (e) => e !== email
                              ),
                            }))
                          }
                        >
                          {email} &times;
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Notizen</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((d) => ({ ...d, notes: e.target.value }))
                    }
                    placeholder="Optionale Notizen..."
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  Erstellen
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                >
                  Abbrechen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Contacts List */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">
          Wird geladen...
        </div>
      ) : !data?.contacts.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {search ? "Keine Kontakte gefunden" : "Noch keine Kontakte angelegt"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.contacts.map((contact) => (
            <Card key={contact.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <Contact className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {contact.email_addresses.join(", ") || "Keine E-Mail"}
                      {contact.tax_id && ` · ${contact.tax_id}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{typeLabels[contact.type]}</Badge>
                  {contact.auto_created && (
                    <Badge variant="secondary">Auto</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
