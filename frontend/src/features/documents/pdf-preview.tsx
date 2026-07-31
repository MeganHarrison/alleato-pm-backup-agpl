"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// SSR-safe: next/dynamic with ssr:false prevents "DOMMatrix is not defined"
// during server render. Worker path matches the repo's established pattern
// (see email-attachments-client.tsx lines 76-92).
const PdfDocument = dynamic(
  async () => {
    const mod = await import("react-pdf");
    mod.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return mod.Document;
  },
  { ssr: false },
);

const PdfPage = dynamic(
  async () => {
    const mod = await import("react-pdf");
    return mod.Page;
  },
  { ssr: false },
);

export function PdfPreview({ src, scale }: { src: string; scale: number }) {
  const [numPages, setNumPages] = React.useState(0);

  return (
    <div className="flex h-full w-full justify-center overflow-auto bg-background p-4">
      <PdfDocument
        file={src}
        onLoadSuccess={({ numPages: n }: { numPages: number }) =>
          setNumPages(n)
        }
        loading={
          <div className="p-8 text-sm text-muted-foreground">Loading…</div>
        }
        error={
          <div className="p-8 text-sm text-muted-foreground">
            Could not render this PDF.
          </div>
        }
      >
        {Array.from({ length: numPages }, (_, i) => (
          <PdfPage
            key={i}
            pageNumber={i + 1}
            scale={scale}
            className="mb-4 bg-background"
            renderTextLayer
            renderAnnotationLayer
          />
        ))}
      </PdfDocument>
    </div>
  );
}
