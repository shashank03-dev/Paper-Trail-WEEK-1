import { sheetGeometry, type PageNo } from "./layout";
import { makeRough, hashSeed } from "./rough";
import { inks, type ZineData } from "./primitives";
import { Folio, PANEL_COMPONENTS } from "./panels";

/** One page, upright, as its own SVG (for the folded-booklet preview). */
export function PageSvg({
  data,
  page,
  className,
}: {
  data: ZineData;
  page: PageNo;
  className?: string;
}) {
  const g = sheetGeometry(data.paper);
  const k = inks(data.color);
  const featureById = new Map(data.features.map((f) => [f.id, f]));
  const rc = makeRough(hashSeed(data.id) + page * 104729);
  const Panel = PANEL_COMPONENTS[page];
  return (
    <svg
      viewBox={`0 0 ${g.panelW} ${g.panelH}`}
      className={className}
      role="img"
      aria-label={`Page ${page}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={g.panelW} height={g.panelH} fill="#FFFDF8" />
      <Panel d={data} g={g} rc={rc} k={k} featureById={featureById} />
      <Folio p={{ d: data, g, rc, k, featureById }} n={page} />
    </svg>
  );
}
