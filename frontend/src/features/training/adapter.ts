import { resolveViewerRole } from "@/lib/training/role-resolution";
import type {
  TrainingResource as TrainingResourceDomain,
  TrainingRole,
  TrainingTopic,
} from "@/lib/training/types";

import { resolveTrainingEmbed } from "./embed-policy";
import type {
  TrainingResource,
  TrainingRoleOption,
  TrainingTopicOption,
} from "./types";

export type TrainingLibraryPageModel = {
  roles: TrainingRoleOption[];
  topics: TrainingTopicOption[];
  tracks: string[];
  resources: TrainingResource[];
  initialRoleId: string | null;
};

export function toTrainingResourceViewModel(
  resource: TrainingResourceDomain,
): TrainingResource {
  const trustedEmbed =
    resource.type === "video"
      ? resolveTrainingEmbed(resource.embedUrl) ??
        resolveTrainingEmbed(resource.url)
      : null;

  return {
    id: resource.id,
    title: resource.title,
    description: resource.description,
    url: resource.url,
    provider: resource.provider,
    topicId: resource.topicId,
    roleIds: resource.roles.map((role) => role.id),
    type: resource.type,
    level: resource.level,
    track: resource.track,
    status: resource.status,
    createdAt: resource.createdAt,
    embed: trustedEmbed
      ? {
          canEmbed: true,
          provider: trustedEmbed.provider,
          embedUrl: trustedEmbed.url,
        }
      : undefined,
  };
}

export function buildTrainingLibraryPageModel({
  resources,
  roles,
  topics,
  viewerTitle,
}: {
  resources: TrainingResourceDomain[];
  roles: TrainingRole[];
  topics: TrainingTopic[];
  viewerTitle: string | null | undefined;
}): TrainingLibraryPageModel {
  const viewerRoleSlug = resolveViewerRole(viewerTitle, roles);
  const initialRoleId =
    roles.find((role) => role.slug === viewerRoleSlug)?.id ?? null;

  return {
    roles: roles.map(({ id, name }) => ({ id, name })),
    topics: topics.map(({ id, name }) => ({ id, name })),
    tracks: [...new Set(resources.map((resource) => resource.track))].sort(
      (left, right) => left.localeCompare(right),
    ),
    resources: resources.map(toTrainingResourceViewModel),
    initialRoleId,
  };
}
