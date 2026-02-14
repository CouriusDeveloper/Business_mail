"use client";

import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PdfViewer } from "@/components/inbox/pdf-viewer";
import { ExtractedFields } from "@/components/inbox/extracted-fields";
import { EmailThread } from "@/components/inbox/email-thread";
import { ApprovalActions } from "@/components/inbox/approval-actions";
import { ArrowLeft } from "lucide-react";

export default function InboxDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: item, isLoading, refetch } = trpc.inbox.getById.useQuery(
    { id },
    { enabled: !!id }
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Wird geladen...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Eintrag nicht gefunden</p>
      </div>
    );
  }

  const primaryDocument = item.documents?.[0];

  return (
    <div className="flex h-full flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/inbox")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">
              {item.email_subject ?? "Kein Betreff"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Von: {item.email_from}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {item.summary && (
            <Badge variant="secondary" className="max-w-md truncate">
              {item.summary}
            </Badge>
          )}
        </div>
      </div>

      {/* 3-Panel Layout */}
      <div className="grid flex-1 grid-cols-12 gap-0 overflow-hidden">
        {/* Left Panel: PDF Viewer */}
        <div className="col-span-5 overflow-auto border-r bg-muted/20 p-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Originaldokument
              </CardTitle>
            </CardHeader>
            <CardContent>
              {primaryDocument ? (
                <PdfViewer
                  filePath={primaryDocument.file_path}
                  fileName={primaryDocument.file_name ?? "document.pdf"}
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-muted-foreground">
                  Kein Dokument vorhanden
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Center Panel: Extracted Fields */}
        <div className="col-span-4 overflow-auto border-r p-4">
          <div className="space-y-4">
            {/* Approval Actions */}
            {item.status === "ready_for_review" && (
              <ApprovalActions
                inboxItemId={item.id}
                currentCompanyId={item.company_id}
                onAction={() => refetch()}
              />
            )}

            {/* Extracted Data */}
            {primaryDocument && (
              <ExtractedFields
                document={primaryDocument}
                inboxItemId={item.id}
                onUpdate={() => refetch()}
              />
            )}

            {/* Summary */}
            {item.summary && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    AI-Zusammenfassung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {item.summary}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right Panel: Email Thread */}
        <div className="col-span-3 overflow-auto p-4">
          <EmailThread
            emailBody={item.email_body}
            emailFrom={item.email_from}
            emailTo={item.email_to}
            emailSubject={item.email_subject}
            receivedAt={item.email_received_at}
          />
        </div>
      </div>
    </div>
  );
}
