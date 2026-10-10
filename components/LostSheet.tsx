/** A sheet with its corner turned down and a dotted trail that runs off the edge: drawn, not imported. */
export function LostSheet({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 240" className={className} aria-hidden fill="none">
      <defs>
        <filter id="lost-shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#151412" floodOpacity=".18" />
        </filter>
      </defs>
      <g transform="rotate(-6 160 120)" filter="url(#lost-shadow)">
        <path d="M60 40h200v120l-40 40H60z" fill="#FFFDF8" />
        <path d="M260 160l-40 40v-40z" fill="#E8E3D7" />
        <path d="M220 160h40l-40 40z" fill="#151412" fillOpacity=".06" />
        {[110, 160, 210].map((x) => (
          <path
            key={x}
            d={`M${x} 40v160`}
            stroke="#151412"
            strokeOpacity=".1"
            strokeDasharray="3 4"
          />
        ))}
        <path d="M60 120h200" stroke="#151412" strokeOpacity=".1" strokeDasharray="3 4" />
        <path
          d="M84 176c18-30 30-70 62-78 30-8 34 26 62 16 20-7 28-40 52-48 22-7 38 2 56-6"
          stroke="#2B3DD8"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="1 9"
        />
        <circle cx="84" cy="176" r="6" fill="#2B3DD8" stroke="#FFFDF8" strokeWidth="2" />
      </g>
      <text
        x="292"
        y="62"
        fontFamily="Instrument Serif, Georgia, serif"
        fontSize="44"
        fill="#2B3DD8"
      >
        ?
      </text>
    </svg>
  );
}
