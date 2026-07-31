import type { Database } from "@/types/database.types";

export type ProjectPage = Database["public"]["Tables"]["notes"]["Row"];

export type ProjectPageUpdate = Pick<ProjectPage, "title" | "body"> & {
  archived?: boolean;
};

function pageError(action: string, message: string): Error {
  return new Error(`Could not ${action} page: ${message}`);
}

type PageApiError = {
  error?: string;
  error_message?: string;
  request_id?: string;
};

async function requestPageApi<T>(
  action: string,
  input: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as PageApiError;
    const detail =
      payload.error_message ||
      payload.error ||
      `request failed with status ${response.status}`;
    const requestId = payload.request_id
      ? ` Request ID: ${payload.request_id}.`
      : "";
    throw pageError(action, `${detail}${requestId}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function listProjectPages(
  projectId: number,
): Promise<ProjectPage[]> {
  const result = await requestPageApi<{ data: ProjectPage[] }>(
    "load",
    `/api/notes?project_id=${projectId}`,
  );
  return result.data;
}

export async function createProjectPage(
  projectId: number,
): Promise<ProjectPage> {
  const result = await requestPageApi<{ data: ProjectPage }>(
    "create",
    "/api/notes",
    {
      method: "POST",
      body: JSON.stringify({ projectId, title: "Untitled", body: "" }),
    },
  );
  return result.data;
}

export async function updateProjectPage(
  projectId: number,
  pageId: number,
  values: Partial<ProjectPageUpdate>,
): Promise<ProjectPage> {
  const result = await requestPageApi<{ data: ProjectPage }>(
    "save",
    "/api/notes",
    {
      method: "PATCH",
      body: JSON.stringify({ projectId, pageId, ...values }),
    },
  );
  return result.data;
}

export async function deleteProjectPage(
  projectId: number,
  pageId: number,
): Promise<void> {
  await requestPageApi<void>(
    "delete",
    `/api/notes?project_id=${projectId}&note_id=${pageId}`,
    { method: "DELETE" },
  );
}
