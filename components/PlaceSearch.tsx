"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { postJSON } from "@/lib/client/api";

export type Place = { lat: number; lon: number; label: string; presetId?: string };

const DEBOUNCE_MS = 280;
const MIN_CHARS = 3;

/**
 * Where-to-start search. Suggestions appear as you type (debounced, stale
 * requests cancelled, answers cached for the session); Enter or the button
 * runs a full search for anything the suggestions missed. A WAI-ARIA
 * combobox: arrows move through the list, Enter picks, Escape closes.
 */
export function PlaceSearch({
  onPick,
  onError,
}: {
  onPick: (p: Place) => void;
  onError: (message: string | null) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const cache = useRef(new Map<string, Place[]>());
  const ctl = useRef<AbortController | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // Picking a suggestion fills the box; that must not search again.
  const picked = useRef<string | null>(null);

  const ask = async (text: string, mode: "suggest" | "search") => {
    const key = `${mode}:${text.toLowerCase()}`;
    const hit = cache.current.get(key);
    if (hit) return hit;
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    const r = await postJSON<{ results: Place[] }>("/api/geocode", { q: text, mode }, c.signal);
    cache.current.set(key, r.results);
    return r.results;
  };

  // As you type.
  useEffect(() => {
    const text = q.trim();
    if (picked.current === q) return;
    setSearched(false);
    if (text.length < MIN_CHARS) {
      ctl.current?.abort();
      setItems([]);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await ask(text, "suggest");
        if (!live) return;
        setItems(res);
        setActive(-1);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError" && live) setItems([]);
      } finally {
        if (live) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [q]);

  // Close when focus or a tap goes elsewhere.
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, []);
  useEffect(() => () => ctl.current?.abort(), []);

  const pick = (p: Place) => {
    picked.current = p.label;
    setQ(p.label);
    setOpen(false);
    setItems([]);
    onError(null);
    onPick(p);
  };

  const fullSearch = async () => {
    const text = q.trim();
    if (text.length < 2) return;
    onError(null);
    setLoading(true);
    try {
      const res = await ask(text, "search");
      setItems(res);
      setActive(res.length ? 0 : -1);
      setOpen(true);
      setSearched(true);
    } catch (e) {
      if ((e as Error).name !== "AbortError") onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!items.length) return;
      e.preventDefault();
      setOpen(true);
      // -1 is the text box itself; past either end wraps round through it.
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => {
        const n = i + d;
        return n >= items.length ? -1 : n < -1 ? items.length - 1 : n;
      });
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    } else if (e.key === "Enter" && open && active >= 0 && items[active]) {
      e.preventDefault();
      pick(items[active]!);
    }
  };

  const text = q.trim();
  const showList = open && text.length >= 2 && (items.length > 0 || (!loading && searched));
  const optionId = (i: number) => `${id}-opt-${i}`;

  return (
    <div ref={box} className="relative mt-3">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void fullSearch();
        }}
        className="relative"
      >
        <label htmlFor={`${id}-q`} className="sr-only">
          Search for a street or place
        </label>
        <Search
          size={17}
          strokeWidth={1.6}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3"
        />
        <input
          id={`${id}-q`}
          className="field !pl-11 !pr-28"
          placeholder="A street, a park or a neighbourhood"
          value={q}
          onChange={(e) => {
            picked.current = null;
            setQ(e.target.value);
          }}
          onFocus={() => items.length && setOpen(true)}
          onKeyDown={onKey}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {loading && (
          <Loader2
            size={16}
            className="absolute right-[6.4rem] top-1/2 -translate-y-1/2 animate-spin text-ink-3"
            aria-hidden
          />
        )}
        <button
          className="btn btn-ink btn-sm absolute right-1.5 top-1/2 -translate-y-1/2"
          type="submit"
        >
          Search
        </button>
      </form>
      <p className="sr-only" aria-live="polite">
        {showList
          ? items.length
            ? `${items.length} suggestion${items.length === 1 ? "" : "s"}. Use the arrow keys to choose.`
            : "Nothing found."
          : ""}
      </p>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Places"
          className="absolute inset-x-0 top-full z-30 mt-2 max-h-[min(22rem,50svh)] overflow-y-auto overscroll-contain rounded-2xl bg-sheet shadow-[0_0_0_1px_var(--color-line-2),0_18px_40px_-24px_rgb(21_20_18/0.4)]"
        >
          {items.length ? (
            items.map((r, i) => (
              <li
                key={`${r.lat},${r.lon},${r.label}`}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                // Keep focus in the box so the list doesn't close before the tap lands.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(r)}
                onPointerEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-3 text-left text-[0.95rem] transition-colors ${
                  i === active ? "bg-bone text-ink" : "text-ink-2"
                }`}
              >
                <MapPin size={15} strokeWidth={1.6} className="shrink-0 text-riso" />
                <Highlight text={r.label} query={text} />
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-[0.95rem] text-ink-3">
              Nothing found. Try a street and city, or pick on the map.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Bold the typed words inside a suggestion. */
function Highlight({ text, query }: { text: string; query: string }) {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${words.join("|")})`, "gi"));
  return (
    <span className="min-w-0 truncate">
      {parts.map((p, i) =>
        i % 2 ? (
          <strong key={i} className="font-semibold text-ink">
            {p}
          </strong>
        ) : (
          p
        ),
      )}
    </span>
  );
}
