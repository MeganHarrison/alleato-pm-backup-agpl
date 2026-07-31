import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";
import { expect, test } from "../../fixtures/index";

const PROJECT_ID = 118;
const BUCKET = "photos";

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase environment variables are not configured");
  }

  return createClient(supabaseUrl, serviceKey);
}

test.describe("Project photos page", () => {
  test("shows images stored in the Supabase photos bucket", async ({
    page,
    safeNavigate,
  }) => {
    const supabase = getSupabaseAdmin();
    const fileName = `playwright-photo-${Date.now()}.png`;
    const storagePath = `projects/${PROJECT_ID}/photos/${fileName}`;
    const pixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PvZbWQAAAABJRU5ErkJggg==",
      "base64",
    );

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, pixel, {
        contentType: "image/png",
        upsert: true,
      });

    expect(uploadError).toBeNull();

    const { error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 60);

    expect(signError).toBeNull();

    try {
      await safeNavigate(`/${PROJECT_ID}/photos`);
      await expect(page.getByTestId("photo-summary")).toBeVisible();

      const photoCard = page
        .getByTestId("photo-card")
        .filter({ hasText: fileName });

      await expect(photoCard).toBeVisible();
      await expect(photoCard).toContainText("image/png");
    } finally {
      const { error: cleanupError } = await supabase.storage
        .from(BUCKET)
        .remove([storagePath]);

      if (cleanupError) {
        throw new Error(
          `Cleanup failed for ${storagePath}: ${cleanupError.message}`,
        );
      }
    }
  });
});
