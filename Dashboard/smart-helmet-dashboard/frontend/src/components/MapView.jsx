import useStableMapUrl from "../hooks/useStableMapUrl";

function toFinite(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export default function MapView({
  location,
  gpsOnline = false,
  gpsFixOnline = false,
  gpsMeta,
  zone = null,
  esp32Connected = false
}) {
  const lat = toFinite(location?.lat);
  const lng = toFinite(location?.lng);
  const hasCoords = lat !== null && lng !== null;
  const fixAgeMs = toFinite(gpsMeta?.fixAgeMs);
  const fixAgeSeconds = fixAgeMs !== null ? Math.round(fixAgeMs / 1000) : null;
  const hasKnownFix = gpsMeta?.hasFix === true || hasCoords;
  const hasFreshFix = gpsFixOnline || gpsMeta?.fixFresh === true;

  let statusMessage = "Location unavailable. Waiting for GPS coordinates.";
  if (!esp32Connected) {
    statusMessage = "ESP32 offline. Waiting for telemetry stream.";
  } else if (!gpsOnline) {
    statusMessage = "GPS module offline.";
  } else if (!hasKnownFix) {
    statusMessage = "GPS module online, waiting for coordinates.";
  } else if (!hasFreshFix) {
    statusMessage = "GPS connected. Live fix is stale; showing last known location.";
  }

  const mapEmbedUrl = useStableMapUrl(lat, lng);

  return (
    <div className="bg-panel rounded-xl p-4 border border-slate-800 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="font-medium">GPS Tracking</h3>
        <div className="flex items-center gap-2">
          {esp32Connected && gpsOnline ? (
            <span
              className={`text-xs px-2 py-1 rounded-full border ${
                hasFreshFix
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-300"
              }`}
            >
              {hasFreshFix ? "Live GPS fix" : "Fix pending"}
            </span>
          ) : null}

          {hasCoords ? (
            <a
              href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-textSoft hover:text-textMain"
            >
              Open full map
            </a>
          ) : null}
        </div>
      </div>

      {hasCoords && mapEmbedUrl ? (
        <iframe
          title="Miner current location"
          src={mapEmbedUrl}
          className="w-full flex-1 min-h-0 rounded-lg border border-slate-700"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div className="flex-1 min-h-0 rounded-lg border border-slate-700 bg-panelSoft grid place-items-center text-center px-4">
          {zone ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-textSoft">Zone</p>
              <p className="text-lg font-semibold text-textMain mt-1">{zone}</p>
              <p className="text-xs text-textSoft mt-2">{statusMessage}</p>
            </div>
          ) : (
            <p className="text-sm text-textSoft">{statusMessage}</p>
          )}
        </div>
      )}

      {zone ? (
        <p className="mt-3 text-sm shrink-0">
          Zone: <span className="text-textMain font-medium">{zone}</span>
        </p>
      ) : null}

      <p className="mt-2 text-sm shrink-0">
        Lat: <span className="text-textSoft">{lat !== null ? lat.toFixed(6) : "Unknown"}</span> | Lng:{" "}
        <span className="text-textSoft">{lng !== null ? lng.toFixed(6) : "Unknown"}</span>
      </p>

      {esp32Connected && gpsOnline && hasKnownFix && !hasFreshFix && fixAgeSeconds !== null ? (
        <p className="mt-1 text-xs text-amber-300 shrink-0">Last fix age: {fixAgeSeconds}s</p>
      ) : null}
    </div>
  );
}
