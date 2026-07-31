import { z } from "zod";
import type { Database } from "@/types/database.types";

type DocumentMetadataRow = Database["public"]["Tables"]["document_metadata"]["Row"];

export const meetingSchema = z
  .object({
    id: z.string(),
    title: z.string().nullable().optional(),
    date: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    source: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    project: z.string().nullable().optional(),
    project_id: z.number().nullable().optional(),
    action_items: z.string().nullable().optional(),
    audio: z.string().nullable().optional(),
    bullet_points: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    duration_minutes: z.number().nullable().optional(),
    keywords: z.array(z.string()).nullable().optional(),
    overview: z.string().nullable().optional(),
    sentiment: z.custom<DocumentMetadataRow["sentiment"]>().nullable().optional(),
    content: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    participants: z.string().nullable().optional(),
    participants_array: z.array(z.string()).nullable().optional(),
    status: z.string().nullable().optional(),
    embedding_status: z.string().nullable().optional(),
    summary: z.string().nullable().optional(),
    summary_bullets: z.custom<DocumentMetadataRow["summary_bullets"]>().nullable().optional(),
    summary_embedding: z.unknown().nullable().optional(),
    fireflies_link: z.string().nullable().optional(),
    video: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    deleted_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

export const meetingsSchema = z.array(meetingSchema);

export type Meeting = z.infer<typeof meetingSchema>;
