declare module "@pdftron/pdfjs-express-viewer" {
  interface WebViewerOptions {
    path: string;
    initialDoc: string;
    licenseKey: string;
  }

  type ViewerListener = () => void;
  type PageNumberListener = (pageNumber: number) => void;

  interface PdfjsExpressDocumentViewer {
    getCurrentPage(): number;
    getPageCount(): number;
    getScrollViewElement(): HTMLElement;
    addEventListener(event: "pageNumberUpdated", listener: PageNumberListener): void;
    addEventListener(
      event: "documentLoaded" | "pageComplete" | "zoomUpdated" | "rotationUpdated",
      listener: ViewerListener,
    ): void;
    removeEventListener(
      event: "pageComplete" | "zoomUpdated" | "rotationUpdated",
      listener: ViewerListener,
    ): void;
    getZoom?(): number;
    getZoomLevel?(): number;
    zoomIn?(): void;
    zoomOut?(): void;
    zoomTo?(zoom: number): void;
    rotateClockwise?(pageNumber?: number): void;
    rotateCounterClockwise?(pageNumber?: number): void;
    getRotation?(pageNumber?: number): number;
    setRotation?(rotation: number, pageNumber?: number): void;
  }

  interface PdfjsExpressInstance {
    UI: {
      disableElements(elements: string[]): void;
    };
    Core: {
      documentViewer: PdfjsExpressDocumentViewer;
    };
  }

  export default function WebViewer(
    options: WebViewerOptions,
    viewerElement: HTMLElement,
  ): Promise<PdfjsExpressInstance>;
}
