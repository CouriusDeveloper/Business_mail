"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react";

interface PdfViewerProps {
  filePath: string;
  fileName: string;
}

export function PdfViewer({ filePath, fileName }: PdfViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  // In production, this URL would come from Supabase Storage
  const pdfUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${filePath}`;

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <span className="truncate text-xs text-muted-foreground">
          {fileName}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom((z) => Math.max(50, z - 25))}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[3rem] text-center text-xs">
            {zoom}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setZoom((z) => Math.min(200, z + 25))}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setRotation((r) => (r + 90) % 360)}
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* PDF Embed */}
      <div
        className="overflow-auto rounded-md border bg-white"
        style={{ height: "calc(100vh - 300px)" }}
      >
        <iframe
          src={`${pdfUrl}#toolbar=0&view=FitH`}
          className="h-full w-full"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: "top left",
          }}
          title={fileName}
        />
      </div>
    </div>
  );
}
