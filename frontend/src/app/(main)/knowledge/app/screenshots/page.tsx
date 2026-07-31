import { PageShell } from "@/components/layout";
import { AppPageScreenshotBrowser } from "@/features/knowledge/app-page-screenshots/screenshot-browser";
import { loadAppPageScreenshots } from "@/features/knowledge/app-page-screenshots/data";

export const metadata = {
  title: "App Page Screenshots",
};

export default async function AppPageScreenshotsPage() {
  const { manifest, items, error } = await loadAppPageScreenshots();

  return (
    <PageShell
      variant="table"
      title="App Page Screenshots"
      showHeader={false}
      contentClassName="p-0"
      fillHeight
    >
      <AppPageScreenshotBrowser
        manifest={manifest}
        items={items}
        error={error}
      />
    </PageShell>
  );
}
