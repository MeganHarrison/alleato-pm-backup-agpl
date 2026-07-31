import {
  getProjectHomeLinkHref,
  getProjectHomeLinkKind,
  getProjectHomeLinks,
  type ProjectHomeLinkDocument,
} from "./project-home-links";

function doc(
  overrides: Partial<ProjectHomeLinkDocument>,
): ProjectHomeLinkDocument {
  return {
    id: 1,
    title: "Document",
    file_name: "document.pdf",
    category: null,
    created_at: "2026-06-01T12:00:00Z",
    description: null,
    document_type: null,
    content_type: null,
    file_url: "supabase://documents/document.pdf",
    source_system: null,
    source_web_url: null,
    ...overrides,
  };
}

describe("project home links", () => {
  it("keeps only external links and prioritizes drone or site footage", () => {
    const links = getProjectHomeLinks([
      doc({
        id: 1,
        title: "General SharePoint folder",
        source_web_url: "https://sharepoint.example.com/project-folder",
        created_at: "2026-06-25T12:00:00Z",
      }),
      doc({
        id: 2,
        title: "Drone flight over south wall blocking",
        file_name: "south-wall-flight.mp4",
        file_url: "https://videos.example.com/south-wall-flight.mp4",
        created_at: "2026-06-20T12:00:00Z",
      }),
      doc({
        id: 3,
        title: "Uploaded local file",
        file_url: "supabase://documents/local-only.pdf",
        created_at: "2026-06-26T12:00:00Z",
      }),
    ]);

    expect(links.map((link) => link.id)).toEqual([2, 1]);
  });

  it("uses source web URLs before direct file URLs", () => {
    const link = doc({
      source_web_url: "https://sharepoint.example.com/watch",
      file_url: "https://cdn.example.com/watch.mp4",
    });

    expect(getProjectHomeLinkHref(link)).toBe("https://sharepoint.example.com/watch");
  });

  it("classifies drone and video records as video links", () => {
    expect(
      getProjectHomeLinkKind(
        doc({
          title: "Drone flight 2026-06-25",
          file_url: "https://videos.example.com/flight.mp4",
        }),
      ),
    ).toBe("video");

    expect(
      getProjectHomeLinkKind(
        doc({
          title: "Permit link",
          source_web_url: "https://sharepoint.example.com/permit",
        }),
      ),
    ).toBe("link");
  });
});
