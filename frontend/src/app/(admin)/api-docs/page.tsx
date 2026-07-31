"use client";

import { useEffect, useRef } from "react";
import SwaggerUIBundle from "swagger-ui-dist/swagger-ui-bundle.js";
import SwaggerUIStandalonePreset from "swagger-ui-dist/swagger-ui-standalone-preset.js";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";

const OPENAPI_JSON_PATH = "/openapi.json";

export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const ui = SwaggerUIBundle({
      url: OPENAPI_JSON_PATH,
      domNode: containerRef.current,
      deepLinking: true,
      docExpansion: "list",
      showCommonExtensions: true,
      showExtensions: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIStandalonePreset,
      ],
      layout: "StandaloneLayout",
      validatorUrl: null,
    });

    return () => {
      if (typeof ui?.destroy === "function") {
        ui.destroy();
      }
    };
  }, []);

  return (
    <PageShell
      variant="detailWide"
      title="API Documentation"
      description="Interactive Swagger UI for the Alleato Procore frontend + backend endpoints."
      actions={
        <div className="flex flex-wrap gap-4">
          <Button asChild variant="outline">
            <a href="/openapi.json" download>
              Download JSON
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/openapi.yaml" download>
              Download YAML
            </a>
          </Button>
        </div>
      }
    >
      <div
        ref={containerRef}
        id="swagger-ui"
        className="w-full rounded-lg bg-card shadow-sm"
        style={{ minHeight: "40rem" }}
      />
    </PageShell>
  );
}
