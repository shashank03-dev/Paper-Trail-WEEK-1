/**
 * The hero's two layouts. "Stacked" (paper above, copy and captions below) is
 * for portrait and square screens of any width, phones and portrait tablets
 * alike; landscape screens, from a phone on its side to an ultrawide, get
 * "side" (copy and captions left, paper right). Width alone can't decide it:
 * a 1080 × 1750 portrait tablet is "wide" but has no room beside the copy.
 *
 * Mirrored in CSS as the `stacked:` variant (app/globals.css); a test keeps
 * the two in step.
 */
export const STACKED_QUERY = "(max-aspect-ratio: 11/10)";
