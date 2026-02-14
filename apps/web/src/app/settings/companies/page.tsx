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
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";

const exportTargetOptions = [
  { value: "datev", label: "DATEV Upload Mail" },
  { value: "onedrive", label: "OneDrive" },
  { value: "both", label: "Beides" },
];

export default function CompaniesPage() {
  const { data: companies, isLoading, refetch } = trpc.companies.list.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    tax_id: "",
    datev_upload_email: "",
    onedrive_folder_path: "",
    export_target: "datev" as const,
  });

  const createMutation = trpc.companies.create.useMutation({
    onSuccess: () => {
      resetForm();
      refetch();
    },
  });

  const updateMutation = trpc.companies.update.useMutation({
    onSuccess: () => {
      resetForm();
      refetch();
    },
  });

  const deleteMutation = trpc.companies.delete.useMutation({
    onSuccess: () => refetch(),
  });

  function resetForm() {
    setShowForm(false);
    setEditId(null);
    setFormData({
      name: "",
      tax_id: "",
      datev_upload_email: "",
      onedrive_folder_path: "",
      export_target: "datev",
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      updateMutation.mutate({ id: editId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Unternehmen</h1>
          <p className="text-muted-foreground">
            Verwalten Sie die Unternehmen Ihres Mandanten
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neues Unternehmen
        </Button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editId ? "Unternehmen bearbeiten" : "Neues Unternehmen"}
            </CardTitle>
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
                    placeholder="Müller GmbH"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>USt-ID</Label>
                  <Input
                    value={formData.tax_id}
                    onChange={(e) =>
                      setFormData((d) => ({ ...d, tax_id: e.target.value }))
                    }
                    placeholder="DE123456789"
                  />
                </div>
                <div className="space-y-2">
                  <Label>DATEV Upload Mail</Label>
                  <Input
                    type="email"
                    value={formData.datev_upload_email}
                    onChange={(e) =>
                      setFormData((d) => ({
                        ...d,
                        datev_upload_email: e.target.value,
                      }))
                    }
                    placeholder="uo-upload-12345@datev.de"
                  />
                </div>
                <div className="space-y-2">
                  <Label>OneDrive-Pfad</Label>
                  <Input
                    value={formData.onedrive_folder_path}
                    onChange={(e) =>
                      setFormData((d) => ({
                        ...d,
                        onedrive_folder_path: e.target.value,
                      }))
                    }
                    placeholder="/Müller GmbH/Belege/"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Export-Ziel</Label>
                  <Select
                    options={exportTargetOptions}
                    value={formData.export_target}
                    onChange={(e) =>
                      setFormData((d) => ({
                        ...d,
                        export_target: e.target.value as "datev" | "onedrive" | "both",
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editId ? "Speichern" : "Erstellen"}
                </Button>
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Abbrechen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Companies List */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">
          Wird geladen...
        </div>
      ) : !companies?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Noch keine Unternehmen angelegt
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <Card key={company.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{company.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditId(company.id);
                        setFormData({
                          name: company.name,
                          tax_id: company.tax_id ?? "",
                          datev_upload_email: company.datev_upload_email ?? "",
                          onedrive_folder_path: company.onedrive_folder_path ?? "",
                          export_target: company.export_target,
                        });
                        setShowForm(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        if (confirm("Unternehmen wirklich löschen?")) {
                          deleteMutation.mutate({ id: company.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {company.tax_id && (
                  <CardDescription>{company.tax_id}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Badge variant="outline">
                  {company.export_target === "datev"
                    ? "DATEV"
                    : company.export_target === "onedrive"
                      ? "OneDrive"
                      : "DATEV + OneDrive"}
                </Badge>
                {company.datev_upload_email && (
                  <p className="text-muted-foreground">
                    DATEV: {company.datev_upload_email}
                  </p>
                )}
                {company.onedrive_folder_path && (
                  <p className="text-muted-foreground">
                    OneDrive: {company.onedrive_folder_path}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
