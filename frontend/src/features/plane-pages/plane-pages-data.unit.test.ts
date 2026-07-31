import {
  createProjectPage,
  deleteProjectPage,
  listProjectPages,
  type ProjectPage,
  updateProjectPage,
} from "./plane-pages-data";

const page: ProjectPage = {
  id: 21,
  project_id: 31,
  title: "Turnover plan",
  body: "Closeout sequence",
  archived: false,
  created_at: "2026-07-30T12:00:00.000Z",
  created_by: "user-1",
  updated_at: "2026-07-30T13:00:00.000Z",
};

const fetchMock = jest.fn();

describe("Plane Pages server API adapter", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("loads project pages through the project-scoped API", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [page] }), { status: 200 }),
    );

    await expect(listProjectPages(31)).resolves.toEqual([page]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notes?project_id=31",
      expect.objectContaining({
        headers: expect.objectContaining({
          "content-type": "application/json",
        }),
      }),
    );
  });

  it("creates a page without accepting a client-supplied creator or project", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: page }), { status: 201 }),
    );

    await expect(createProjectPage(31)).resolves.toEqual(page);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          projectId: 31,
          title: "Untitled",
          body: "",
        }),
      }),
    );
  });

  it("updates only through the project-and-page-scoped API", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: page }), { status: 200 }),
    );

    await expect(
      updateProjectPage(31, 21, {
        title: "Updated turnover plan",
        archived: true,
      }),
    ).resolves.toEqual(page);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notes",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          projectId: 31,
          pageId: 21,
          title: "Updated turnover plan",
          archived: true,
        }),
      }),
    );
  });

  it("deletes only through the scoped API", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteProjectPage(31, 21)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notes?project_id=31&note_id=21",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("surfaces structured server failures with the request id", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error_message: "Insufficient permissions.",
          request_id: "request-123",
        }),
        { status: 403 },
      ),
    );

    await expect(listProjectPages(31)).rejects.toThrow(
      "Could not load page: Insufficient permissions. Request ID: request-123.",
    );
  });
});
