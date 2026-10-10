/** Fluent 3D emoji (MIT, self-hosted in public/icons/3d). UI chrome only — never on the printed zine. */
export type Icon3DName =
  | "seedling"
  | "leaf"
  | "pencil"
  | "tree"
  | "phone-off"
  | "scissors"
  | "postbox"
  | "camera"
  | "dog"
  | "footprints"
  | "magnifier"
  | "weather"
  | "map"
  | "ear"
  | "printer"
  | "book"
  | "herb"
  | "house"
  | "laptop"
  | "lock"
  | "palette"
  | "child"
  | "friends"
  | "walker"
  | "stopwatch"
  | "memo"
  | "maple"
  | "envelope"
  | "gear"
  | "sparkles"
  | "compass"
  | "mushroom";

export function Icon3D({
  name,
  size = 48,
  className = "",
  float = false,
  tilt,
  alt = "",
  style,
}: {
  name: Icon3DName;
  size?: number;
  className?: string;
  float?: boolean;
  tilt?: number;
  alt?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={`/icons/3d/${name}.png`}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      draggable={false}
      loading="lazy"
      decoding="async"
      className={`${float ? "float" : ""} ${className}`}
      style={{
        ...(tilt !== undefined ? ({ "--r": `${tilt}deg` } as React.CSSProperties) : {}),
        ...style,
      }}
    />
  );
}
