"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/** Optional click-to-pick map (Leaflet + OSM tiles). Loaded only when opened. */
export default function LocationPicker({
  lat,
  lon,
  onPick,
}: {
  lat: number;
  lon: number;
  onPick: (lat: number, lon: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !el.current) return;
      map = L.map(el.current, { zoomControl: true }).setView([lat, lon], 15);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      const marker = L.circleMarker([lat, lon], {
        radius: 9,
        color: "#1B1B1B",
        weight: 3,
        fillColor: "#FF5C8A",
        fillOpacity: 1,
      }).addTo(map);
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        onPick(e.latlng.lat, e.latlng.lng);
      });
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={el}
      className="h-72 w-full overflow-hidden rounded-xl shadow-[inset_0_0_0_1px_var(--color-line-2)]"
      aria-label="Map: click to choose where the walk starts"
      role="application"
    />
  );
}
