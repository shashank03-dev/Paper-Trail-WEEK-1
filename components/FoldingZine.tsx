/**
 * The landing hero: an 8-panel sheet that folds into a booklet and back, in
 * pure CSS 3D. Faces are little hand-drawn page thumbnails (all SVG, no images).
 */
function Mini({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="pg">
      <div className="display text-[clamp(7px,1.05vw,13px)] leading-none">{title}</div>
      <div className="mt-[6%] h-[70%]">{children}</div>
      <div className="mono absolute bottom-[4%] left-0 right-0 text-center text-[clamp(5px,0.6vw,8px)] text-muted">
        · {n} ·
      </div>
    </div>
  );
}

const Lines = ({ n = 4, w = [100, 86, 92, 60] }: { n?: number; w?: number[] }) => (
  <svg viewBox="0 0 100 60" className="h-full w-full" aria-hidden>
    {Array.from({ length: n }, (_, i) => (
      <path
        key={i}
        d={`M2 ${8 + i * 13} q ${(w[i % w.length] ?? 80) / 2} -2 ${w[i % w.length] ?? 80} 1`}
        stroke="#1b1b1b"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        opacity={0.75}
      />
    ))}
  </svg>
);

const MapDoodle = () => (
  <svg viewBox="0 0 100 80" className="h-full w-full" aria-hidden>
    <rect x="2" y="2" width="96" height="76" fill="none" stroke="#1b1b1b" strokeWidth="2" />
    <path
      d="M30 10 L40 70 M5 40 L95 34 M60 5 L72 75"
      stroke="#1b1b1b"
      strokeWidth="1.6"
      fill="none"
    />
    <path d="M45 12 L80 18 L76 50 L48 46 Z" fill="none" stroke="#1F8A8A" strokeWidth="1.2" />
    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
      <line
        key={i}
        x1={48 + i * 4}
        y1={46}
        x2={50 + i * 4.5}
        y2={14}
        stroke="#1F8A8A"
        strokeWidth="0.9"
      />
    ))}
    <path
      d="M38 52 C 50 64, 70 60, 66 36 S 44 20, 38 52"
      stroke="#FF5C8A"
      strokeWidth="2.6"
      strokeDasharray="5 3"
      fill="none"
    />
    <path d="M38 46 l2 5 5 0 -4 3 2 5 -5 -3 -5 3 2 -5 -4 -3 5 0z" fill="#FF5C8A" />
  </svg>
);

const Boxes = () => (
  <svg viewBox="0 0 100 80" className="h-full w-full" aria-hidden>
    {[0, 1, 2, 3, 4].map((i) => (
      <g key={i}>
        <rect
          x="3"
          y={4 + i * 15}
          width="11"
          height="11"
          rx="1.5"
          fill="none"
          stroke="#1b1b1b"
          strokeWidth="2"
        />
        {i % 2 === 0 && (
          <path d={`M5 ${10 + i * 15} l3 3 6 -8`} stroke="#1b1b1b" strokeWidth="2.4" fill="none" />
        )}
        <path
          d={`M20 ${10 + i * 15} h ${48 + (i % 3) * 8}`}
          stroke="#1b1b1b"
          strokeWidth="2.2"
          opacity={0.7}
        />
        <text
          x="97"
          y={13 + i * 15}
          textAnchor="end"
          fontSize="9"
          fill="#FF5C8A"
          fontFamily="IBM Plex Mono"
        >
          {[15, 10, 25, 5, 20][i]}
        </text>
      </g>
    ))}
  </svg>
);

const Frame = () => (
  <svg viewBox="0 0 100 80" className="h-full w-full" aria-hidden>
    <rect x="4" y="4" width="92" height="72" fill="none" stroke="#1b1b1b" strokeWidth="2" />
    <path
      d="M50 66 L50 38 M50 46 L38 30 M50 42 L62 28 M50 52 L64 46"
      stroke="#1b1b1b"
      strokeWidth="2.2"
      fill="none"
      strokeLinecap="round"
    />
    <circle cx="78" cy="18" r="6" fill="none" stroke="#FF5C8A" strokeWidth="2" />
  </svg>
);

const Qr = () => (
  <svg viewBox="0 0 100 80" className="h-full w-full" aria-hidden>
    <Lines n={2} />
    {Array.from({ length: 49 }, (_, i) =>
      (i * 7919) % 3 === 0 ? (
        <rect
          key={i}
          x={32 + (i % 7) * 5}
          y={30 + Math.floor(i / 7) * 5}
          width="5"
          height="5"
          fill="#1b1b1b"
        />
      ) : null,
    )}
    <rect x="32" y="30" width="12" height="12" fill="none" stroke="#1b1b1b" strokeWidth="2.5" />
    <rect x="55" y="30" width="12" height="12" fill="none" stroke="#1b1b1b" strokeWidth="2.5" />
  </svg>
);

function Cover() {
  return (
    <div className="pg" style={{ outline: "2px solid #FF5C8A", outlineOffset: "-5px" }}>
      <div className="mono text-[clamp(4px,0.55vw,7px)]">No. 007</div>
      <div className="display mt-[8%] text-[clamp(7px,1.15vw,14px)] leading-[0.95]">
        The Secret Life of Alder Street
      </div>
      <div className="stamp mt-[14%] inline-block rotate-[-8deg] px-[6%] py-[3%] text-[clamp(4px,0.6vw,8px)]">
        Phone stays home
      </div>
    </div>
  );
}

export function FoldingZine() {
  return (
    <div className="zine3d mx-auto w-full max-w-[560px] select-none" aria-hidden>
      <div className="sheet3d">
        <div className="shadow" />
        <div className="half left">
          <div className="quarter top">
            <div className="face front">
              <Mini n={5} title="Listen">
                <Lines />
              </Mini>
              <Mini n={4} title="I-Spy">
                <Boxes />
              </Mini>
            </div>
            <div className="face back" style={{ background: "#f7f1e5" }} />
          </div>
          <div className="quarter bottom">
            <div className="face front">
              <Mini n={6} title="The Riddle">
                <Lines n={5} />
              </Mini>
              <Mini n={7} title="Sketch">
                <Frame />
              </Mini>
            </div>
            <div className="face back">
              <Cover />
              <Mini n={8} title="Bring me home">
                <Qr />
              </Mini>
            </div>
          </div>
        </div>
        <div className="half right">
          <div className="quarter top">
            <div className="face front">
              <Mini n={3} title="The Route">
                <Lines n={5} w={[90, 70, 95, 80]} />
              </Mini>
              <Mini n={2} title="The Map">
                <MapDoodle />
              </Mini>
            </div>
            <div className="face back" style={{ background: "#f7f1e5" }} />
          </div>
          <div className="quarter bottom">
            <div className="face front">
              <Mini n={8} title="Bring me home">
                <Qr />
              </Mini>
              <Cover />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
