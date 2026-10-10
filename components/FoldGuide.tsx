/** How to fold an 8-page mini zine with one cut — six little animated SVG steps. */
const ink = "#151412";
const pink = "#2B3DD8";

function Sheet({ children }: { children?: React.ReactNode }) {
  return (
    <svg viewBox="0 0 120 80" className="h-auto w-full" aria-hidden>
      <rect
        x="10"
        y="10"
        width="100"
        height="60"
        fill="#FFFDF8"
        stroke={ink}
        strokeWidth="1.6"
        rx="1"
      />
      {children}
    </svg>
  );
}

const STEPS: { title: string; svg: React.ReactNode }[] = [
  {
    title: "Fold in half, long way. Unfold.",
    svg: (
      <Sheet>
        <line
          x1="10"
          y1="40"
          x2="110"
          y2="40"
          stroke={pink}
          strokeWidth="1.4"
          strokeDasharray="3 2"
        />
        <rect
          className="anim-fold"
          x="10"
          y="10"
          width="100"
          height="30"
          fill="#E8E3D7"
          stroke={ink}
          strokeWidth="1"
          style={{ transformOrigin: "50% 100%" }}
        />
      </Sheet>
    ),
  },
  {
    title: "Fold in half, short way. Unfold.",
    svg: (
      <Sheet>
        <line
          x1="60"
          y1="10"
          x2="60"
          y2="70"
          stroke={pink}
          strokeWidth="1.4"
          strokeDasharray="3 2"
        />
      </Sheet>
    ),
  },
  {
    title: "Fold each end to the middle.",
    svg: (
      <Sheet>
        {[35, 60, 85].map((x) => (
          <line
            key={x}
            x1={x}
            y1="10"
            x2={x}
            y2="70"
            stroke={ink}
            strokeWidth="0.8"
            strokeDasharray="2 2"
            opacity="0.5"
          />
        ))}
        <line
          x1="35"
          y1="10"
          x2="35"
          y2="70"
          stroke={pink}
          strokeWidth="1.4"
          strokeDasharray="3 2"
        />
        <line
          x1="85"
          y1="10"
          x2="85"
          y2="70"
          stroke={pink}
          strokeWidth="1.4"
          strokeDasharray="3 2"
        />
      </Sheet>
    ),
  },
  {
    title: "Fold in half again. Cut the dashed line, middle only.",
    svg: (
      <svg viewBox="0 0 120 80" className="h-auto w-full" aria-hidden>
        <rect x="10" y="25" width="100" height="30" fill="#FFFDF8" stroke={ink} strokeWidth="1.6" />
        <line x1="10" y1="25" x2="110" y2="25" stroke={ink} strokeWidth="2.4" />
        <line
          x1="35"
          y1="25"
          x2="85"
          y2="25"
          stroke={pink}
          strokeWidth="1.6"
          strokeDasharray="3 2"
        />
        <g className="anim-cut">
          <circle cx="32" cy="20" r="3" fill="none" stroke={ink} strokeWidth="1.2" />
          <circle cx="32" cy="30" r="3" fill="none" stroke={ink} strokeWidth="1.2" />
          <path d="M34 22 L46 26 M34 28 L46 24" stroke={ink} strokeWidth="1.2" />
        </g>
      </svg>
    ),
  },
  {
    title: "Open, then push the ends together so the cut opens into a diamond.",
    svg: (
      <svg viewBox="0 0 120 80" className="h-auto w-full" aria-hidden>
        <path d="M20 40 L60 22 L100 40 L60 58 Z" fill="#FFFDF8" stroke={ink} strokeWidth="1.6" />
        <path d="M44 40 L60 30 L76 40 L60 50 Z" fill="#E8E3D7" stroke={pink} strokeWidth="1.2" />
        <path
          d="M8 40 h10 l-4 -4 m4 4 l-4 4 M112 40 h-10 l4 -4 m-4 4 l4 4"
          stroke={ink}
          strokeWidth="1.2"
          fill="none"
        />
      </svg>
    ),
  },
  {
    title: "Flatten into a booklet with the cover (page 1) on the front.",
    svg: (
      <svg viewBox="0 0 120 80" className="h-auto w-full" aria-hidden>
        <rect x="42" y="12" width="36" height="56" fill="#FFFDF8" stroke={ink} strokeWidth="1.6" />
        <rect x="45" y="15" width="30" height="50" fill="none" stroke={pink} strokeWidth="1" />
        <text
          x="60"
          y="44"
          textAnchor="middle"
          fontSize="16"
          fontFamily="Instrument Serif"
          fontWeight="400"
          fill={ink}
        >
          1
        </text>
      </svg>
    ),
  },
];

export function FoldGuide() {
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {STEPS.map((s, i) => (
        <li
          key={i}
          className="fold-step card flex flex-col p-4 transition-transform duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1"
        >
          <p className="flex items-baseline justify-between">
            <span className="font-serif text-2xl italic text-riso">{i + 1}.</span>
            <span className="label !text-[0.62rem]">step</span>
          </p>
          <div className="mt-2 rounded-xl bg-bone/70">{s.svg}</div>
          <p className="mt-3 text-[0.86rem] leading-snug text-ink-2">{s.title}</p>
        </li>
      ))}
    </ol>
  );
}
