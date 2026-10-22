import { useEffect, useMemo, useState } from "react";

// The OpenStreetMap embed renders its marker from the URL, so changing the URL
// reloads the whole iframe. GPS reports 6 decimal places (~0.11 m) and receiver
// noise is several metres, so anchoring the URL to the live reading rebuilt the
// map on every 2 s poll -- constant flicker and a full tile fetch each time.
//
// Instead the anchor only moves once the miner has travelled far enough to
// matter. Standing still never reloads; walking reloads roughly every 18 s.
// The marker stays OSM's own, so it is always drawn exactly where the anchor
// coordinates say -- at most RECENTRE_METRES behind the live position, which
// callers show precisely as text alongside the map.

const HALF_SPAN_DEG = 0.003; // ~333 m north-south either side of the anchor
const RECENTRE_METRES = 25;
const METRES_PER_DEG_LAT = 111320;

function metresBetween(a, b) {
  const dLat = (a.lat - b.lat) * METRES_PER_DEG_LAT;
  const dLng =
    (a.lng - b.lng) * METRES_PER_DEG_LAT * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

export default function useStableMapUrl(lat, lng) {
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const [anchor, setAnchor] = useState(null);

  useEffect(() => {
    if (!hasCoords) {
      setAnchor(null);
      return;
    }

    // Returning prev unchanged means React bails out and nothing re-renders.
    setAnchor((prev) =>
      prev && metresBetween(prev, { lat, lng }) < RECENTRE_METRES
        ? prev
        : { lat, lng }
    );
  }, [hasCoords, lat, lng]);

  return useMemo(() => {
    if (!anchor) return null;

    const left = anchor.lng - HALF_SPAN_DEG;
    const right = anchor.lng + HALF_SPAN_DEG;
    const top = anchor.lat + HALF_SPAN_DEG;
    const bottom = anchor.lat - HALF_SPAN_DEG;

    return (
      "https://www.openstreetmap.org/export/embed.html" +
      `?bbox=${left}%2C${bottom}%2C${right}%2C${top}` +
      `&layer=mapnik&marker=${anchor.lat}%2C${anchor.lng}`
    );
  }, [anchor]);
}
