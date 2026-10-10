import { z } from "zod";

export const ReadIspySchema = z.object({
  items: z
    .array(
      z.object({
        index: z.number().int().min(0).max(11),
        ticked: z.boolean(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(12),
});
export const ReadListenSchema = z.object({
  loudest: z.string().max(120).nullable(),
  quietest: z.string().max(120).nullable(),
  newSound: z.string().max(120).nullable(),
});
export const ReadRiddleSchema = z.object({
  written: z.string().max(80).nullable(),
  verdict: z.enum(["correct", "close", "incorrect", "blank"]),
  note: z.string().max(200),
});
export const ReadSketchSchema = z.object({
  description: z.string().max(300),
  isBlank: z.boolean(),
});
export const LetterSchema = z.object({ letter: z.string().max(700) });
export const ExtractIspySchema = z.object({ labels: z.array(z.string().max(60)).max(10) });
export const WholeSheetSchema = z.object({
  ispy: ReadIspySchema.shape.items,
  loudest: z.string().max(120).nullable(),
  quietest: z.string().max(120).nullable(),
  newSound: z.string().max(120).nullable(),
  riddleWritten: z.string().max(80).nullable(),
  sketchDescription: z.string().max(300),
  sketchBlank: z.boolean(),
});
