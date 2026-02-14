import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { Mail } from "lucide-react";

interface EmailThreadProps {
  emailBody: string | null;
  emailFrom: string | null;
  emailTo: string | null;
  emailSubject: string | null;
  receivedAt: string | null;
}

export function EmailThread({
  emailBody,
  emailFrom,
  emailTo,
  emailSubject,
  receivedAt,
}: EmailThreadProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Mail className="h-4 w-4" />
          E-Mail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Email metadata */}
        <div className="space-y-1 text-xs text-muted-foreground">
          {emailFrom && (
            <p>
              <span className="font-medium text-foreground">Von:</span>{" "}
              {emailFrom}
            </p>
          )}
          {emailTo && (
            <p>
              <span className="font-medium text-foreground">An:</span>{" "}
              {emailTo}
            </p>
          )}
          {emailSubject && (
            <p>
              <span className="font-medium text-foreground">Betreff:</span>{" "}
              {emailSubject}
            </p>
          )}
          {receivedAt && (
            <p>
              <span className="font-medium text-foreground">Datum:</span>{" "}
              {formatDate(receivedAt)}
            </p>
          )}
        </div>

        {/* Email body */}
        <div className="border-t pt-3">
          {emailBody ? (
            <div className="prose prose-sm max-w-none text-sm">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                {emailBody}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Kein E-Mail-Inhalt vorhanden
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
