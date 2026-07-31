import { z } from 'zod';

// Everything in here shows up as an editable form in Remotion Studio's sidebar,
// so captions/intro/frame can be tweaked visually with live preview.
export const captionSchema = z.object({
  text: z.string(),
  fromSec: z.number(),      // seconds into the footage
  durationSec: z.number(),
});

export const walkthroughSchema = z.object({
  footage: z.string(),                 // file in public/
  title: z.object({
    title: z.string(),
    subtitle: z.string(),
    holdSec: z.number(),
  }),
  captions: z.array(captionSchema),
  frame: z.object({
    padPx: z.number(),                 // gap around the footage
    radiusPx: z.number(),              // rounded-corner radius
    color0: z.string(),                // backdrop gradient start
    color1: z.string(),
  }),
});

export type WalkthroughProps = z.infer<typeof walkthroughSchema>;
