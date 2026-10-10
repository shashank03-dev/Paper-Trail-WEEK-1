import type { Expected } from "@/lib/schemas";

export const READER_SYSTEM = `You are the reader of Paper Trail. You look at photos of a printed paper zine page that someone carried on a walk and filled in with a pencil. Transcribe exactly what is handwritten. If unreadable, return null. Don't guess words that aren't there. Never mock anyone's drawing or handwriting. Reply with JSON only.`;

export function readIspyPrompt(e: Expected): string {
  return `TASK: read-ispy
This is the I-Spy page. Each printed row has a square checkbox on the left. A box counts as ticked if it has any pencil mark inside (✓, ✗, a dot, or filled in).
The printed rows, top to bottom:
${e.ispy.map((it, i) => `${i + 1}. ${it.label}`).join("\n")}
Return items: one per row, index = row number - 1, ticked = true/false, confidence 0..1.`;
}

export function readListenPrompt(_e: Expected): string {
  return `TASK: read-listen
This is the "Listen" page. Under each printed prompt there are two ruled lines for handwriting:
- "The loudest sound:" → loudest
- "The quietest sound:" → quietest
- "A sound you've never noticed:" → newSound
Transcribe exactly what is handwritten for each (null if blank or unreadable). Ignore the printed text.`;
}

export function readRiddlePrompt(e: Expected): string {
  return `TASK: read-riddle
This is the riddle page. The printed riddle:
"${e.riddle.text.replace(/\n/g, " / ")}"
The intended answer: "${e.riddle.answer}" (also fine: ${e.riddle.acceptable.map((a) => `"${a}"`).join(", ") || "none"}).
Transcribe what is handwritten in the answer box (null if blank). Then judge it kindly: "correct" if it means the answer (synonyms and misspellings count), "close" if it's nearly there, "incorrect" if not, "blank" if nothing is written. note: one kind sentence explaining the verdict.`;
}

export function readSketchPrompt(e: Expected): string {
  return `TASK: read-sketch
This is the sketch page. The printed prompt was: "${e.sketchPrompt}".
Describe what is drawn inside the big frame, warmly and specifically, in one or two sentences (like "a tree with three branches, like it's waving at you"). Never mock it. If the frame is empty, isBlank = true and describe it as an empty frame waiting for next time.`;
}

export function letterPrompt(
  e: Expected,
  found: { spotted: string[]; listen: string[]; riddle: string; sketch: string },
): string {
  return `TASK: letter
You are "The Trail Office", writing back to a walker who mailed in their filled-in zine${e.walkerName ? ` (their name: ${e.walkerName})` : ""}${e.title ? `, "${e.title}"` : ""}.
What they did:
- Spotted: ${found.spotted.join(", ") || "nothing ticked"}
- Wrote on the Listen page: ${found.listen.join(" / ") || "nothing"}
- Riddle: ${found.riddle}
- Sketch: ${found.sketch}
Write a warm 3-4 sentence note that references what they actually wrote and drew. No emoji. Sign off as "— The Trail Office".`;
}

export function extractIspyPrompt(): string {
  return `TASK: extract-ispy
This is an I-Spy page from a printed zine. Read the printed item labels next to the checkboxes, top to bottom. Return labels in order.`;
}

export function wholeSheetPrompt(e: Expected): string {
  return `TASK: read-sheet
This is a photo of a whole unfolded 8-page zine sheet (the top row is upside down). Read the pencil marks on:
- the I-Spy page (rows: ${e.ispy.map((it, i) => `${i + 1}. ${it.label}`).join("; ")}) → ispy: [{index, ticked, confidence}]
- the Listen page → loudest, quietest, newSound (null if blank)
- the Riddle answer box → riddleWritten (null if blank)
- the Sketch frame → sketchDescription, sketchBlank
Transcribe exactly; null if unreadable.`;
}
