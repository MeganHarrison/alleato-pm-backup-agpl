"use client";

import { TrainingLibraryView } from "@/features/training/TrainingLibraryView";
import type {
  LearningLibraryItem,
  TrainingRoleOption,
} from "@/lib/learning/types";

export function TrainingPageClient({
  items,
  roles,
}: {
  items: LearningLibraryItem[];
  roles: TrainingRoleOption[];
}) {
  return <TrainingLibraryView items={items} roles={roles} />;
}
