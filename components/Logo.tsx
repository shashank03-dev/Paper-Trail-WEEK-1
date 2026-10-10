/** The mark: a folded sheet with a dotted trail running over it. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden fill="none">
      <path d="M5 8.5 16 5l11 3.5v17L16 29 5 25.5z" fill="#EFEAE0" />
      <path d="M16 5v24" stroke="#0A0A08" strokeOpacity=".22" strokeWidth="1" />
      <path d="M16 5 27 8.5v17L16 29z" fill="#E1DBCD" />
      <path
        d="M8.5 21.5c2.2-1.4 3.6-4.6 6.4-5.2 2.9-.6 4.1 2.6 6.9 1.6 1.6-.6 2.4-2.3 3.2-3.6"
        stroke="#0A0A08"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="0.1 3"
      />
      <circle cx="25" cy="13.6" r="1.9" fill="#C9EE73" stroke="#0A0A08" strokeWidth="1" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[1.02rem] font-semibold tracking-[-0.02em]">Paper Trail</span>
    </span>
  );
}
