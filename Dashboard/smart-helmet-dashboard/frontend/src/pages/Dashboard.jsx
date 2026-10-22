import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import SensorCard from "../components/SensorCard";
import ChartsPanel from "../components/ChartsPanel";
import AlertsPanel from "../components/AlertsPanel";
import MapView from "../components/MapView";
import SystemStatus from "../components/SystemStatus";
import AudioStatus from "../components/AudioStatus";
import useRealtimeData from "../hooks/useRealtimeData";
import { getOverallStatus, getSensorLevel } from "../utils/status";

export default function Dashboard({ onOpenRescue }) {
  const { data, history, loading, error, stale } = useRealtimeData();
  const [activeSection, setActiveSection] = useState("overview");

  if (loading && !data) {
    return <div className="h-full bg-bg text-textMain grid place-items-center">Loading dashboard...</div>;
  }

  const s = data.sensors;
  const sensorStatus = data.sensorStatus || {};
  const status = getOverallStatus(data);

  const cards = [
    { title: "Oxygen", value: s.oxygen, unit: "%", key: "oxygen" },
    { title: "CO2", value: s.co2, unit: "ppm", key: "co2" },
    { title: "CO", value: s.co, unit: "ppm", key: "co" },
    { title: "Methane (CH4)", value: s.ch4, unit: "%", key: "ch4" },
    { title: "H2S", value: s.h2s, unit: "", key: "h2s" },
    { title: "Temperature", value: s.temperature, unit: "C", key: "temperature" },
    { title: "Humidity", value: s.humidity, unit: "%", key: "humidity" }
  ];

  function handleSidebarNavigate(id) {
    if (id === "rescue") {
      onOpenRescue?.();
      return;
    }

    // Nothing scrolls any more, so this only tracks which nav item is lit.
    setActiveSection(id);
  }

  const banner = error
    ? { tone: "border-warn/40 bg-warn/10 text-warn", text: `Live data fetch issue: ${error}. Showing last known values.` }
    : stale
    ? { tone: "border-danger/40 bg-danger/10 text-danger", text: "Data stream appears stale. Check ESP32 network and backend service." }
    : null;

  return (
    <div className="md:h-full flex flex-col md:flex-row bg-bg overflow-hidden">
      <Sidebar activeSection={activeSection} onNavigate={handleSidebarNavigate} />

      <main className="flex-1 min-w-0 flex flex-col gap-3 p-3 md:p-4 md:overflow-hidden">
        <div className="shrink-0">
          <Topbar status={status} minerId={data.minerId} />
        </div>

        {/*
          Only one banner is rendered at a time. Showing both stacked could push
          the fixed-height layout over the viewport, and "stale" already implies
          the fetch problem the error banner describes.
        */}
        {banner ? (
          <div className={`shrink-0 rounded-xl border px-3 py-2 text-xs ${banner.tone}`}>
            {banner.text}
          </div>
        ) : null}

        <section className="shrink-0 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {cards.map((c) => (
            <SensorCard
              key={c.title}
              title={c.title}
              value={c.value}
              unit={c.unit}
              sensorKey={c.key}
              offline={!data.esp32Connected || sensorStatus[c.key] === false}
              level={data.esp32Connected ? getSensorLevel(c.key, c.value) : "unknown"}
            />
          ))}
        </section>

        {/*
          Everything above is fixed-height; this region absorbs whatever vertical
          space is left and splits it between the charts and the lower panels.
          min-h-0 on every level is what allows it to shrink rather than overflow.
        */}
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          {/* Charts take the larger share -- they carry the trend information,
              while the panels below are mostly short status readouts. */}
          <div className="flex-[1.4] min-h-0">
            <ChartsPanel history={history} />
          </div>

          <section className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-3 gap-3">
            <AlertsPanel alerts={data.alerts} history={data.alertHistory} />

            <MapView
              location={data.location}
              gpsOnline={sensorStatus.gps === true}
              gpsFixOnline={sensorStatus.gpsFix === true}
              gpsMeta={data.gpsMeta}
              zone={data.zone}
              esp32Connected={data.esp32Connected}
            />

            {/* Both children are flex-1 so they share the column height evenly.
                Without this the two cards sit at their natural height and leave
                ~170px empty below them. */}
            <div className="min-h-0 grid grid-rows-2 gap-3">
              <AudioStatus audio={data.audio} />
              <SystemStatus connected={data.esp32Connected} timestamp={data.timestamp} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
