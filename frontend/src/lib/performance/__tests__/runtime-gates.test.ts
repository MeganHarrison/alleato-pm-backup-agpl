import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldEnableHeavyProductAnalytics,
  shouldForceCollaborationRuntime,
  shouldHideGlobalAiWidgetForRoute,
  shouldHideGlobalCollaborationLayerForRoute,
} from "../runtime-gates";

test("runtime performance gates", async (t) => {
  await t.test("hides the global AI widget on immersive assistant routes", () => {
    assert.equal(shouldHideGlobalAiWidgetForRoute("/ai"), true);
    assert.equal(shouldHideGlobalAiWidgetForRoute("/ai-dashboard"), true);
    assert.equal(
      shouldHideGlobalAiWidgetForRoute("/ai-assistant/session-1"),
      true,
    );
    assert.equal(
      shouldHideGlobalAiWidgetForRoute("/760/drawings/viewer/123"),
      true,
    );
    assert.equal(shouldHideGlobalAiWidgetForRoute("/760/home"), false);
    assert.equal(
      shouldHideGlobalAiWidgetForRoute("/admin/daily-briefs/brief-1"),
      true,
    );
    assert.equal(
      shouldHideGlobalCollaborationLayerForRoute("/admin/daily-briefs/brief-1"),
      true,
    );
    assert.equal(shouldHideGlobalCollaborationLayerForRoute("/admin/users"), false);
  });

  await t.test(
    "forces collaboration runtime only on collaboration-dedicated routes",
    () => {
      assert.equal(shouldForceCollaborationRuntime("/comments"), true);
      assert.equal(shouldForceCollaborationRuntime("/feedback-inbox"), true);
      assert.equal(shouldForceCollaborationRuntime("/team-chat/room-1"), true);
      assert.equal(shouldForceCollaborationRuntime("/760/home"), false);
    },
  );

  await t.test(
    "forces collaboration runtime on project-scoped drawing routes only",
    () => {
      // Project drawing viewer/detail host the comment tool → force the runtime.
      assert.equal(
        shouldForceCollaborationRuntime("/760/drawings/viewer/123"),
        true,
      );
      assert.equal(shouldForceCollaborationRuntime("/760/drawings/456"), true);
      assert.equal(shouldForceCollaborationRuntime("/760/drawings"), true);
      // The unscoped global drawings table page has no comment tool and must not
      // pay the runtime + heavy-analytics cost.
      assert.equal(shouldForceCollaborationRuntime("/drawings"), false);
      // A `drawings` segment nested elsewhere must not over-match.
      assert.equal(
        shouldForceCollaborationRuntime("/760/submittals/drawings"),
        false,
      );
    },
  );

  await t.test("keeps heavy analytics off standard project pages", () => {
    assert.equal(shouldEnableHeavyProductAnalytics("/760/home"), false);
    assert.equal(shouldEnableHeavyProductAnalytics("/comments"), true);
    assert.equal(shouldEnableHeavyProductAnalytics("/ai"), true);
    assert.equal(
      shouldEnableHeavyProductAnalytics("/760/drawings/viewer/123"),
      true,
    );
    assert.equal(shouldEnableHeavyProductAnalytics("/drawings"), false);
  });
});
