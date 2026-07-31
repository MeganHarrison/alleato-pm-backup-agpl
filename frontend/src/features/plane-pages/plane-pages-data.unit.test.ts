import {
  createProjectPage,
  type ProjectPage,
  updateProjectPage,
} from "./plane-pages-data";

const mockCreateClient = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => mockCreateClient(),
}));

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

describe("Plane Pages mutation scope", () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
  });

  it("creates an authenticated page inside the requested project", async () => {
    const single = jest.fn().mockResolvedValue({ data: page, error: null });
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));
    const from = jest.fn(() => ({ insert }));
    const getUser = jest.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser },
      from,
    });

    await expect(createProjectPage(31)).resolves.toEqual(page);

    expect(from).toHaveBeenCalledWith("notes");
    expect(insert).toHaveBeenCalledWith({
      project_id: 31,
      title: "Untitled",
      body: "",
      archived: false,
      created_by: "user-1",
    });
  });

  it("scopes every page update by project and page identity", async () => {
    const single = jest.fn().mockResolvedValue({ data: page, error: null });
    const builder = {
      update: jest.fn(),
      eq: jest.fn(),
      select: jest.fn(),
      single,
    };
    builder.update.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    const from = jest.fn(() => builder);
    mockCreateClient.mockReturnValue({ from });

    await expect(
      updateProjectPage(31, 21, {
        title: "Updated turnover plan",
        archived: true,
      }),
    ).resolves.toEqual(page);

    expect(from).toHaveBeenCalledWith("notes");
    expect(builder.eq.mock.calls).toEqual([
      ["project_id", 31],
      ["id", 21],
    ]);
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Updated turnover plan",
        archived: true,
        updated_at: expect.any(String),
      }),
    );
  });
});
