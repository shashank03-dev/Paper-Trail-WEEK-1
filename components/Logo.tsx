/**
 * The mark: the sheet as it comes off the printer — eight panels, one cut —
 * with the walk drawn across it as a single loop that starts at a riso dot.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden fill="none">
      <rect width="32" height="32" rx="9" fill="#151412" />
      <rect x="5" y="8.5" width="22" height="15" rx="1.4" fill="#FBFAF6" />
      <path
        d="M10.5 8.5v15M16 8.5v15M21.5 8.5v15M5 16h22"
        stroke="#151412"
        strokeOpacity=".16"
        strokeWidth=".8"
      />
      <path d="M10.5 16h11" stroke="#151412" strokeWidth="1.1" strokeDasharray="1.4 1.1" />
      <path
        d="M8.6 19.6c1.3-5.6 4.4-8.3 8.2-7.7 3.2.5 3.6 3.5 6.1 3.4 1.3 0 1.9-.9 2.1-1.8"
        stroke="#2B3DD8"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="8.6" cy="19.6" r="1.9" fill="#2B3DD8" stroke="#FBFAF6" strokeWidth=".9" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className="font-serif text-[1.42rem] leading-none tracking-[-0.02em]">
        Paper <span className="italic">Trail</span>
      </span>
    </span>
  );
}
