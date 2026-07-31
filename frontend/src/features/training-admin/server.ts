import "server-only";

import { randomUUID } from "crypto";

import type { Database } from "@/types/database.types";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createServiceClient } from "@/lib/supabase/service";

import { parseTrainingAdminPayload } from "./schemas";
import type {
  TrainingAdminListResponse,
  TrainingAdminRecord,
  TrainingAdminReferenceOptions,
  TrainingAdminTableKey,
} from "./types";

type Tables = Database["public"]["Tables"];
type Service = ReturnType<typeof createServiceClient>;

function fail(
  where: string,
  operation: string,
  tableKey: TrainingAdminTableKey,
  error: { message: string; code?: string } | null,
): never {
  const conflict = error?.code === "23505";
  const dependency = error?.code === "23503";
  throw new GuardrailError({
    code: conflict || dependency ? "INVALID_PAYLOAD" : "UPSTREAM_FAILURE",
    where,
    status: conflict ? 409 : dependency ? 422 : 500,
    message: conflict
      ? `${operation} failed because that ${tableKey} record already exists.`
      : dependency
        ? `${operation} failed because ${tableKey} still has a required relationship or references a missing record.`
        : `${operation} failed for ${tableKey}.`,
    details: error?.message ?? "No database error details were returned.",
  });
}

function rowKey(tableKey: TrainingAdminTableKey, row: Record<string, unknown>) {
  if (tableKey === "training_resource_role") {
    return `${String(row.resource_id)}~${String(row.role_id)}`;
  }
  return String(row.id);
}

function mapRows(
  tableKey: TrainingAdminTableKey,
  rows: Record<string, unknown>[],
): TrainingAdminRecord[] {
  return rows.map((row) => ({ ...row, _rowKey: rowKey(tableKey, row) }));
}

function parseLinkKey(recordId: string) {
  const [resourceId, roleId, ...rest] = recordId.split("~");
  if (!resourceId || !roleId || rest.length > 0) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "training-data#parseLinkKey",
      status: 400,
      message: "Resource-role link identifier is invalid. Refresh the table.",
    });
  }
  return { resourceId, roleId };
}

async function loadReferences(
  service: Service,
): Promise<TrainingAdminReferenceOptions> {
  const [roles, topics, resources, docs, assets, users] = await Promise.all([
    service.from("training_role").select("id,name").order("name"),
    service.from("training_topic").select("id,name").order("name"),
    service.from("training_resource").select("id,title").order("title"),
    service.from("training_docs").select("id,title").order("title"),
    service
      .from("training_doc_assets")
      .select("id,file_name")
      .order("file_name"),
    service
      .from("user_profiles")
      .select("id,full_name,email")
      .order("full_name"),
  ]);

  const failed = [roles, topics, resources, docs, assets, users].find(
    (result) => result.error,
  );
  if (failed?.error) {
    fail(
      "training-data#references",
      "Loading reference options",
      "training_resource",
      failed.error,
    );
  }

  return {
    roles: (roles.data ?? []).map((row) => ({
      value: row.id,
      label: row.name,
    })),
    topics: (topics.data ?? []).map((row) => ({
      value: row.id,
      label: row.name,
    })),
    resources: (resources.data ?? []).map((row) => ({
      value: row.id,
      label: row.title,
    })),
    docs: (docs.data ?? []).map((row) => ({
      value: row.id,
      label: row.title,
    })),
    assets: (assets.data ?? []).map((row) => ({
      value: row.id,
      label: row.file_name,
    })),
    users: (users.data ?? []).map((row) => ({
      value: row.id,
      label: row.full_name?.trim() || row.email || row.id,
    })),
  };
}

async function listRows(service: Service, tableKey: TrainingAdminTableKey) {
  switch (tableKey) {
    case "training_resource":
      return service.from("training_resource").select("*").order("updated_at", { ascending: false });
    case "training_role":
      return service.from("training_role").select("*").order("sort_order");
    case "training_topic":
      return service.from("training_topic").select("*").order("sort_order");
    case "training_resource_role":
      return service.from("training_resource_role").select("*").order("created_at", { ascending: false });
    case "training_role_skill":
      return service.from("training_role_skill").select("*").order("sort_order");
    case "training_skill_checkin":
      return service.from("training_skill_checkin").select("*").order("checkin_date", { ascending: false });
    case "training_docs":
      return service.from("training_docs").select("*").order("updated_at", { ascending: false });
    case "training_doc_assets":
      return service.from("training_doc_assets").select("*").order("updated_at", { ascending: false });
    case "training_doc_steps":
      return service.from("training_doc_steps").select("*").order("step_order");
    case "training_doc_relations":
      return service.from("training_doc_relations").select("*").order("sort_order");
  }
}

export async function listTrainingAdminRecords(
  tableKey: TrainingAdminTableKey,
): Promise<TrainingAdminListResponse> {
  const service = createServiceClient();
  const [rows, references] = await Promise.all([
    listRows(service, tableKey),
    loadReferences(service),
  ]);
  if (rows.error) {
    fail(
      `training-data/${tableKey}#GET`,
      "Loading records",
      tableKey,
      rows.error,
    );
  }
  return {
    records: mapRows(
      tableKey,
      (rows.data ?? []) as unknown as Record<string, unknown>[],
    ),
    references,
  };
}

function resourceAudit(
  payload: Record<string, unknown>,
  userId: string,
  existingStatus?: string,
) {
  const status = payload.status;
  const now = new Date().toISOString();
  if (status === "published" && existingStatus !== "published") {
    return {
      reviewed_by: userId,
      reviewed_at: now,
      published_by: userId,
      published_at: now,
    };
  }
  if (status === "archived") {
    return { published_by: null, published_at: null };
  }
  return {};
}

export async function createTrainingAdminRecord(
  tableKey: TrainingAdminTableKey,
  payload: unknown,
  userId: string,
) {
  const body = parseTrainingAdminPayload(tableKey, payload, "create");
  const service = createServiceClient();

  switch (tableKey) {
    case "training_resource": {
      const insert = {
        ...(body as Tables["training_resource"]["Insert"]),
        cost: "free",
        created_by: userId,
        updated_by: userId,
        ...resourceAudit(body, userId),
      };
      const result = await service.from("training_resource").insert(insert).select("*").single();
      if (result.error) fail("training-data/training_resource#POST", "Creating record", tableKey, result.error);
      return result.data;
    }
    case "training_role": {
      const result = await service.from("training_role").insert(body as Tables["training_role"]["Insert"]).select("*").single();
      if (result.error) fail("training-data/training_role#POST", "Creating record", tableKey, result.error);
      return result.data;
    }
    case "training_topic": {
      const result = await service.from("training_topic").insert(body as Tables["training_topic"]["Insert"]).select("*").single();
      if (result.error) fail("training-data/training_topic#POST", "Creating record", tableKey, result.error);
      return result.data;
    }
    case "training_resource_role": {
      const result = await service.from("training_resource_role").insert({
        ...(body as Tables["training_resource_role"]["Insert"]),
        created_by: userId,
      }).select("*").single();
      if (result.error) fail("training-data/training_resource_role#POST", "Creating record", tableKey, result.error);
      return result.data;
    }
    case "training_role_skill": {
      const result = await service.from("training_role_skill").insert(body as Tables["training_role_skill"]["Insert"]).select("*").single();
      if (result.error) fail("training-data/training_role_skill#POST", "Creating record", tableKey, result.error);
      return result.data;
    }
    case "training_skill_checkin": {
      const result = await service.from("training_skill_checkin").insert(body as Tables["training_skill_checkin"]["Insert"]).select("*").single();
      if (result.error) fail("training-data/training_skill_checkin#POST", "Creating record", tableKey, result.error);
      return result.data;
    }
    case "training_docs": {
      const result = await service.from("training_docs").insert({
        ...(body as Tables["training_docs"]["Insert"]),
        created_by: userId,
        updated_by: userId,
      }).select("*").single();
      if (result.error) fail("training-data/training_docs#POST", "Creating record", tableKey, result.error);
      return result.data;
    }
    case "training_doc_assets": {
      const result = await service.from("training_doc_assets").insert({
        ...(body as Tables["training_doc_assets"]["Insert"]),
        created_by: userId,
      }).select("*").single();
      if (result.error) fail("training-data/training_doc_assets#POST", "Creating record", tableKey, result.error);
      return result.data;
    }
    case "training_doc_steps": {
      const result = await service.from("training_doc_steps").insert({
        ...(body as Tables["training_doc_steps"]["Insert"]),
        created_by: userId,
      }).select("*").single();
      if (result.error) fail("training-data/training_doc_steps#POST", "Creating record", tableKey, result.error);
      return result.data;
    }
    case "training_doc_relations": {
      const result = await service.from("training_doc_relations").insert({
        ...(body as Tables["training_doc_relations"]["Insert"]),
        created_by: userId,
      }).select("*").single();
      if (result.error) fail("training-data/training_doc_relations#POST", "Creating record", tableKey, result.error);
      return result.data;
    }
  }
}

async function currentResourceStatus(service: Service, recordId: string) {
  const result = await service
    .from("training_resource")
    .select("status")
    .eq("id", recordId)
    .maybeSingle();
  if (result.error) {
    fail(
      "training-data/training_resource#status",
      "Loading current record",
      "training_resource",
      result.error,
    );
  }
  if (!result.data) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: "training-data/training_resource#status",
      status: 404,
      message: "Training resource no longer exists. Refresh the table.",
    });
  }
  return result.data.status;
}

export async function updateTrainingAdminRecord(
  tableKey: TrainingAdminTableKey,
  recordId: string,
  payload: unknown,
  userId: string,
) {
  const body = parseTrainingAdminPayload(tableKey, payload, "update");
  const service = createServiceClient();

  if (tableKey === "training_resource_role") {
    const { resourceId, roleId } = parseLinkKey(recordId);
    const result = await service
      .from("training_resource_role")
      .update(body as Tables["training_resource_role"]["Update"])
      .eq("resource_id", resourceId)
      .eq("role_id", roleId)
      .select("*")
      .maybeSingle();
    if (result.error) fail("training-data/training_resource_role#PATCH", "Updating record", tableKey, result.error);
    if (!result.data) throwNotFound(tableKey);
    return result.data;
  }

  switch (tableKey) {
    case "training_resource": {
      const status = await currentResourceStatus(service, recordId);
      const result = await service.from("training_resource").update({
        ...(body as Tables["training_resource"]["Update"]),
        updated_by: userId,
        ...resourceAudit(body, userId, status),
      }).eq("id", recordId).select("*").maybeSingle();
      if (result.error) fail("training-data/training_resource#PATCH", "Updating record", tableKey, result.error);
      if (!result.data) throwNotFound(tableKey);
      return result.data;
    }
    case "training_role": {
      const result = await service.from("training_role").update(body as Tables["training_role"]["Update"]).eq("id", recordId).select("*").maybeSingle();
      if (result.error) fail("training-data/training_role#PATCH", "Updating record", tableKey, result.error);
      if (!result.data) throwNotFound(tableKey);
      return result.data;
    }
    case "training_topic": {
      const result = await service.from("training_topic").update(body as Tables["training_topic"]["Update"]).eq("id", recordId).select("*").maybeSingle();
      if (result.error) fail("training-data/training_topic#PATCH", "Updating record", tableKey, result.error);
      if (!result.data) throwNotFound(tableKey);
      return result.data;
    }
    case "training_role_skill": {
      const result = await service.from("training_role_skill").update(body as Tables["training_role_skill"]["Update"]).eq("id", recordId).select("*").maybeSingle();
      if (result.error) fail("training-data/training_role_skill#PATCH", "Updating record", tableKey, result.error);
      if (!result.data) throwNotFound(tableKey);
      return result.data;
    }
    case "training_skill_checkin": {
      const update = { ...body };
      delete update.user_id;
      const result = await service.from("training_skill_checkin").update(update as Tables["training_skill_checkin"]["Update"]).eq("id", recordId).select("*").maybeSingle();
      if (result.error) fail("training-data/training_skill_checkin#PATCH", "Updating record", tableKey, result.error);
      if (!result.data) throwNotFound(tableKey);
      return result.data;
    }
    case "training_docs": {
      const result = await service.from("training_docs").update({
        ...(body as Tables["training_docs"]["Update"]),
        updated_by: userId,
      }).eq("id", recordId).select("*").maybeSingle();
      if (result.error) fail("training-data/training_docs#PATCH", "Updating record", tableKey, result.error);
      if (!result.data) throwNotFound(tableKey);
      return result.data;
    }
    case "training_doc_assets": {
      const result = await service.from("training_doc_assets").update(body as Tables["training_doc_assets"]["Update"]).eq("id", recordId).select("*").maybeSingle();
      if (result.error) fail("training-data/training_doc_assets#PATCH", "Updating record", tableKey, result.error);
      if (!result.data) throwNotFound(tableKey);
      return result.data;
    }
    case "training_doc_steps": {
      const result = await service.from("training_doc_steps").update(body as Tables["training_doc_steps"]["Update"]).eq("id", recordId).select("*").maybeSingle();
      if (result.error) fail("training-data/training_doc_steps#PATCH", "Updating record", tableKey, result.error);
      if (!result.data) throwNotFound(tableKey);
      return result.data;
    }
    case "training_doc_relations": {
      const result = await service.from("training_doc_relations").update(body as Tables["training_doc_relations"]["Update"]).eq("id", recordId).select("*").maybeSingle();
      if (result.error) fail("training-data/training_doc_relations#PATCH", "Updating record", tableKey, result.error);
      if (!result.data) throwNotFound(tableKey);
      return result.data;
    }
  }
}

function throwNotFound(tableKey: TrainingAdminTableKey): never {
  throw new GuardrailError({
    code: "NOT_FOUND",
    where: `training-data/${tableKey}#record`,
    status: 404,
    message: `${tableKey} record no longer exists. Refresh the table.`,
  });
}

type AssetStorageReference = {
  storage_bucket: string;
  storage_path: string;
  file_name: string;
};

type StagedAsset = AssetStorageReference & {
  staged_path: string;
};

async function restoreStagedAssets(
  service: Service,
  stagedAssets: StagedAsset[],
) {
  const failures: string[] = [];
  for (const asset of [...stagedAssets].reverse()) {
    const result = await service.storage
      .from(asset.storage_bucket)
      .move(asset.staged_path, asset.storage_path);
    if (result.error) failures.push(`${asset.file_name}: ${result.error.message}`);
  }
  if (failures.length > 0) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "training-data#restoreStagedAssets",
      status: 500,
      message:
        "The database record was preserved, but one or more staged files could not be restored. Stop retrying and recover the named storage paths.",
      details: failures,
    });
  }
}

async function stageAssetsForDeletion(
  service: Service,
  assets: AssetStorageReference[],
) {
  const staged: StagedAsset[] = [];
  for (const asset of assets) {
    const stagedAsset = {
      ...asset,
      staged_path: `${asset.storage_path}.pending-delete-${randomUUID()}`,
    };
    const result = await service.storage
      .from(asset.storage_bucket)
      .move(asset.storage_path, stagedAsset.staged_path);
    if (result.error) {
      await restoreStagedAssets(service, staged);
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "training-data#stageAssetsForDeletion",
        status: 500,
        message: `Storage file ${asset.file_name} could not be staged for deletion; database records were preserved.`,
        details: result.error.message,
      });
    }
    staged.push(stagedAsset);
  }
  return staged;
}

async function purgeStagedAssets(service: Service, staged: StagedAsset[]) {
  const failures: string[] = [];
  for (const asset of staged) {
    const result = await service.storage
      .from(asset.storage_bucket)
      .remove([asset.staged_path]);
    if (result.error) failures.push(`${asset.file_name}: ${result.error.message}`);
  }
  if (failures.length > 0) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "training-data#purgeStagedAssets",
      status: 500,
      message:
        "The database record was deleted, but staged storage cleanup failed. Remove the named pending-delete files before retrying.",
      details: failures,
    });
  }
}

export async function deleteTrainingAdminRecord(
  tableKey: TrainingAdminTableKey,
  recordId: string,
) {
  const service = createServiceClient();

  if (tableKey === "training_resource_role") {
    const { resourceId, roleId } = parseLinkKey(recordId);
    const result = await service
      .from("training_resource_role")
      .delete()
      .eq("resource_id", resourceId)
      .eq("role_id", roleId)
      .select("resource_id")
      .maybeSingle();
    if (result.error) fail("training-data/training_resource_role#DELETE", "Deleting record", tableKey, result.error);
    if (!result.data) throwNotFound(tableKey);
    return;
  }

  if (tableKey === "training_doc_assets") {
    const asset = await service
      .from("training_doc_assets")
      .select("storage_bucket,storage_path,file_name")
      .eq("id", recordId)
      .maybeSingle();
    if (asset.error) fail("training-data/training_doc_assets#DELETE", "Loading record", tableKey, asset.error);
    if (!asset.data) throwNotFound(tableKey);
    const staged = await stageAssetsForDeletion(service, [asset.data]);
    const deletion = await service
      .from("training_doc_assets")
      .delete()
      .eq("id", recordId)
      .select("id")
      .maybeSingle();
    if (deletion.error || !deletion.data) {
      await restoreStagedAssets(service, staged);
      if (deletion.error) {
        fail(
          "training-data/training_doc_assets#DELETE",
          "Deleting record",
          tableKey,
          deletion.error,
        );
      }
      throwNotFound(tableKey);
    }
    await purgeStagedAssets(service, staged);
    return;
  }

  if (tableKey === "training_docs") {
    const assets = await service
      .from("training_doc_assets")
      .select("storage_bucket,storage_path,file_name")
      .eq("training_doc_id", recordId);
    if (assets.error) fail("training-data/training_docs#DELETE", "Loading attached assets", tableKey, assets.error);
    const staged = await stageAssetsForDeletion(service, assets.data ?? []);
    const deletion = await service
      .from("training_docs")
      .delete()
      .eq("id", recordId)
      .select("id")
      .maybeSingle();
    if (deletion.error || !deletion.data) {
      await restoreStagedAssets(service, staged);
      if (deletion.error) {
        fail(
          "training-data/training_docs#DELETE",
          "Deleting record",
          tableKey,
          deletion.error,
        );
      }
      throwNotFound(tableKey);
    }
    await purgeStagedAssets(service, staged);
    return;
  }

  let result;
  switch (tableKey) {
    case "training_resource":
      result = await service.from("training_resource").delete().eq("id", recordId).select("id").maybeSingle();
      break;
    case "training_role":
      result = await service.from("training_role").delete().eq("id", recordId).select("id").maybeSingle();
      break;
    case "training_topic":
      result = await service.from("training_topic").delete().eq("id", recordId).select("id").maybeSingle();
      break;
    case "training_role_skill":
      result = await service.from("training_role_skill").delete().eq("id", recordId).select("id").maybeSingle();
      break;
    case "training_skill_checkin":
      result = await service.from("training_skill_checkin").delete().eq("id", recordId).select("id").maybeSingle();
      break;
    case "training_doc_steps":
      result = await service.from("training_doc_steps").delete().eq("id", recordId).select("id").maybeSingle();
      break;
    case "training_doc_relations":
      result = await service.from("training_doc_relations").delete().eq("id", recordId).select("id").maybeSingle();
      break;
  }
  if (result.error) fail(`training-data/${tableKey}#DELETE`, "Deleting record", tableKey, result.error);
  if (!result.data) throwNotFound(tableKey);
}
