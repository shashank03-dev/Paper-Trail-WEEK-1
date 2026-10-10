"use client";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

/**
 * The order so far, as a printed ticket: a stub with the essentials above a
 * perforation, the action below. It leans gently toward the pointer.
 */
export function TrailTicket({
  where,
  duration,
  company,
  name,
  children,
}: {
  where: string | null;
  duration: number;
  company: string;
  name: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [4, -4]), { stiffness: 160, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-5, 5]), { stiffness: 160, damping: 20 });
  return (
    <div
      className="[perspective:1200px]"
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      <motion.div style={{ rotateX: rx, rotateY: ry }} className="relative">
        <div className="relative rounded-[22px] bg-sheet shadow-[0_0_0_1px_rgb(21_20_18/0.07),0_2px_3px_rgb(21_20_18/0.06),0_30px_60px_-30px_rgb(21_20_18/0.5)]">
          <div className="p-7">
            <div className="flex items-start justify-between">
              <p className="label">Trail ticket</p>
              <p className="mono text-[0.72rem] text-ink-3">ADMIT ONE WALKER</p>
            </div>
            <p className="title mt-6 min-h-[2.4em] text-[1.9rem] leading-[1.1]" aria-live="polite">
              {where ?? <span className="text-ink-3">Somewhere near you</span>}
            </p>
            <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-dashed border-line-2 pt-5">
              <div>
                <dt className="label !text-[0.64rem]">Length</dt>
                <dd className="mt-1 font-serif text-[1.45rem] leading-none">{duration} min</dd>
              </div>
              <div className="col-span-2">
                <dt className="label !text-[0.64rem]">Company</dt>
                <dd className="mt-1 font-serif text-[1.45rem] leading-none">{company}</dd>
              </div>
              <div className="col-span-3">
                <dt className="label !text-[0.64rem]">On the cover</dt>
                <dd className="hand mt-1 text-[1.5rem] leading-none text-ink-2">
                  {name ? `A field guide for ${name}` : "A field guide"}
                </dd>
              </div>
            </dl>
          </div>
          {/* The perforation, with a notch bitten out of each edge. */}
          <div className="relative h-0" aria-hidden>
            <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-bone shadow-[inset_-1px_0_0_rgb(21_20_18/0.07)]" />
            <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-bone shadow-[inset_1px_0_0_rgb(21_20_18/0.07)]" />
            <span className="perforation absolute inset-x-5 top-0" />
          </div>
          <div className="p-7 pt-8">{children}</div>
        </div>
      </motion.div>
    </div>
  );
}
