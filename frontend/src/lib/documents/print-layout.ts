export interface BuildPrintPageCssOptions {
  landscape?: boolean;
  margin?: string;
}

export interface SimplePdfFooterOverlayVariant {
  kind: "simple";
  companyName: string;
  documentTitle: string;
  generatedAtLabel: string;
}

export interface DetailedPdfFooterOverlayVariant {
  kind: "detailed";
  companyName: string;
  phone: string;
  website: string;
  email: string;
  locations: string[];
}

export type PdfFooterOverlayVariant =
  | SimplePdfFooterOverlayVariant
  | DetailedPdfFooterOverlayVariant;

export interface PdfFooterOverlayPlan {
  marginBottom: string;
  defaultVariant: PdfFooterOverlayVariant;
  lastPageVariant?: PdfFooterOverlayVariant | null;
}

export function buildPrintPageCss({
  landscape = false,
  margin = "0.5in",
}: BuildPrintPageCssOptions = {}): string {
  return `@media print {
      @page {
        margin: ${margin};
${landscape ? "        size: landscape;\n" : ""}      }
    }`;
}
