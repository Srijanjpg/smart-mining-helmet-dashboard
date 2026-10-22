export default function SystemStatus({ connected, timestamp }) {
  return (
    <div className="bg-panel rounded-xl p-4 border border-slate-800 flex flex-col min-h-0 overflow-hidden">
      <h3 className="font-medium mb-3 shrink-0">System Status</h3>
      <div className="flex-1 min-h-0 flex flex-col justify-center gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-textSoft">ESP32</span>
          <span className={connected ? "text-safe" : "text-danger"}>
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-textSoft">Last update</span>
          <span className="text-textMain">{new Date(timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
