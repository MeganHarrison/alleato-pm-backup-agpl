import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  conversationMatchesSurface,
  parseAssistantSurface,
} from "@/lib/ai/chat-surface";
import {
  appendTrainingSourceLinks,
  buildTrainingContext,
  normalizeTrainingSources,
  trainingLibraryRecoveryMessage,
} from "../grounding";

describe("training library grounding", () => {
  it("keeps the chat route on the exact training source filter", () => {
    const route = readFileSync(
      resolve(process.cwd(), "src/app/api/training/library/chat/route.ts"),
      "utf8",
    );
    expect(route).toContain('surface: "training_library"');
    expect(route).toContain("sourceTypes: [...TRAINING_SOURCE_TYPES]");
    expect(route).toContain("conversationBelongsToSurface");
  });

  it("isolates training conversations from both general assistant surfaces", () => {
    const metadata = { surface: "training_library" };
    expect(parseAssistantSurface("training_library")).toBe("training_library");
    expect(conversationMatchesSurface(metadata, "training_library")).toBe(true);
    expect(conversationMatchesSurface(metadata, "alleato_ai")).toBe(false);
    expect(conversationMatchesSurface(metadata, "ask_alleato")).toBe(false);
  });

  it("keeps only training sources and deduplicates documents", () => {
    const sources = normalizeTrainingSources([
      {
        document_id: "guide-1",
        source_type: "training_guide",
        doc_title: "PM Handbook",
        chunk_text: "Build the submittal log from the specifications.",
        doc_metadata: { source_web_url: "/training/guides/pm-handbook" },
        similarity: 0.81,
      },
      {
        document_id: "guide-1",
        source_type: "training_guide",
        doc_title: "PM Handbook",
        chunk_text: "Duplicate chunk",
        doc_metadata: { source_web_url: "/training/guides/pm-handbook" },
      },
      {
        document_id: "email-1",
        source_type: "email",
        doc_title: "Private email",
        chunk_text: "Must never enter training context",
        doc_metadata: { source_web_url: "/email/1" },
      },
    ]);

    expect(sources).toEqual([
      expect.objectContaining({
        id: "guide-1",
        sourceType: "training_guide",
        url: "/training/guides/pm-handbook",
      }),
    ]);
    expect(buildTrainingContext(sources)).not.toContain("Private email");
  });

  it("always appends clickable grounded sources", () => {
    const answer = appendTrainingSourceLinks("Start with Division 01.", [
      {
        id: "guide-1",
        title: "PM Handbook",
        url: "/training/guides/pm-handbook",
        sourceType: "training_guide",
        excerpt: "Read Division 01.",
        similarity: 0.8,
      },
    ]);

    expect(answer).toContain("[PM Handbook](/training/guides/pm-handbook)");
  });

  it("makes empty and unavailable recovery explicit", () => {
    expect(trainingLibraryRecoveryMessage("empty")).toContain("couldn’t find");
    expect(trainingLibraryRecoveryMessage("unavailable")).toContain(
      "temporarily unavailable",
    );
    expect(trainingLibraryRecoveryMessage("empty")).toContain(
      "notebooklm.google.com",
    );
  });
});
