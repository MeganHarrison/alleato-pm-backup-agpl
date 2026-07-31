"use client";

import * as React from "react";
import { Bot } from "lucide-react";

import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
import type { PublishedTrainingDoc } from "@/lib/training-docs/docs-site";
import {
  APP_KNOWLEDGE_TOOL_CATEGORIES,
  getAppKnowledgeToolHref,
  getTrainingDocToolCategory,
} from "./app-knowledge";
import {
  AppKnowledgeToolNav,
  getAppToolIcon,
} from "./app-knowledge-tool-nav";
import {
  KnowledgeBrowsePage,
  type KnowledgeCategoryConfig,
  type KnowledgeSourceItem,
} from "./knowledge-base-page";

export function AppTrainingDocsPage({
  activeCategorySlug,
  trainingDocs,
}: {
  activeCategorySlug?: string;
  trainingDocs?: PublishedTrainingDoc[];
}) {
  const { profile } = useCurrentUserProfile();
  const isAdmin = profile?.isAdmin === true;

  const categories = React.useMemo<KnowledgeCategoryConfig[]>(
    () =>
      APP_KNOWLEDGE_TOOL_CATEGORIES.map((category) => ({
        id: category.slug,
        label: category.title,
        description: category.description,
        href: getAppKnowledgeToolHref(category),
        icon: getAppToolIcon(category.slug),
      })),
    [],
  );

  const items = React.useMemo<KnowledgeSourceItem[]>(
    () =>
      (trainingDocs ?? []).flatMap((doc) => {
        const category = getTrainingDocToolCategory(doc);
        if (!category) return [];
        // Link to the in-app training doc, never the external docs site.
        return {
          id: doc.slug,
          categoryId: category.slug,
          title: doc.title,
          description:
            doc.summary?.trim() ||
            "Training doc published from the Alleato review workflow.",
          meta: [
            doc.sourceRoute,
            doc.lastPublishedAt ? formatDate(doc.lastPublishedAt) : null,
          ]
            .filter(Boolean)
            .join(" · "),
          href: `/knowledge/app/${category.slug}/${doc.slug}`,
        };
      }),
    [trainingDocs],
  );

  return (
    <KnowledgeBrowsePage
      actionHref={isAdmin ? "/training-docs" : null}
      actionIcon={<Bot className="h-4 w-4" />}
      actionLabel="Create"
      activeCategoryId={activeCategorySlug}
      categories={categories}
      emptyDescription="Published training docs will appear here after review."
      emptyTitle="No training docs yet"
      eyebrow="App"
      isAdmin={isAdmin}
      isLoading={false}
      items={items}
      modeLabel="App"
      navLabel="All tools"
      overviewDescription="Step-by-step app documentation organized by tool."
      searchPlaceholder="Search training docs..."
      showCategoriesWhenEmpty
      sideNavSlot={<AppKnowledgeToolNav activeSlug={activeCategorySlug ?? null} />}
      sourceListNoun="training docs"
      title="Training Docs"
      topBarLabel="Knowledge"
      withShell={false}
    />
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

