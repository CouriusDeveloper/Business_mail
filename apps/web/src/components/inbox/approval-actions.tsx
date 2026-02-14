"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface ApprovalActionsProps {
  inboxItemId: string;
  currentCompanyId: string | null;
  onAction: () => void;
}

export function ApprovalActions({
  inboxItemId,
  currentCompanyId,
  onAction,
}: ApprovalActionsProps) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [showUnclearInput, setShowUnclearInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [unclearNote, setUnclearNote] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    currentCompanyId ?? ""
  );

  const { data: companies } = trpc.companies.list.useQuery();

  const approveMutation = trpc.inbox.approve.useMutation({
    onSuccess: onAction,
  });
  const rejectMutation = trpc.inbox.reject.useMutation({
    onSuccess: () => {
      setShowRejectInput(false);
      onAction();
    },
  });
  const unclearMutation = trpc.inbox.moveToUnclear.useMutation({
    onSuccess: () => {
      setShowUnclearInput(false);
      onAction();
    },
  });

  const companyOptions = (companies ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const isPending =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    unclearMutation.isPending;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Company selection */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Unternehmen zuordnen
          </label>
          <Select
            options={companyOptions}
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            placeholder="Unternehmen wählen..."
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() =>
              approveMutation.mutate({
                id: inboxItemId,
                companyId: selectedCompanyId,
              })
            }
            disabled={!selectedCompanyId || isPending}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Freigeben
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => setShowRejectInput(true)}
            disabled={isPending}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Ablehnen
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowUnclearInput(true)}
            disabled={isPending}
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            Unklar
          </Button>
        </div>

        {/* Reject reason input */}
        {showRejectInput && (
          <div className="space-y-2">
            <Input
              placeholder="Grund der Ablehnung..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  rejectMutation.mutate({
                    id: inboxItemId,
                    reason: rejectReason,
                  })
                }
                disabled={isPending}
              >
                Ablehnen
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRejectInput(false)}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}

        {/* Unclear note input */}
        {showUnclearInput && (
          <div className="space-y-2">
            <Input
              placeholder="Notiz zum Problem..."
              value={unclearNote}
              onChange={(e) => setUnclearNote(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  unclearMutation.mutate({
                    id: inboxItemId,
                    note: unclearNote,
                  })
                }
                disabled={!unclearNote || isPending}
              >
                Als unklar markieren
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUnclearInput(false)}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
