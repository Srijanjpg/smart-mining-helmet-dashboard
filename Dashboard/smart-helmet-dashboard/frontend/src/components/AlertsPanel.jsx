export default function AlertsPanel({ alerts, history }) {
  const classBy = {
    warning: "border-warn/40 bg-warn/10 text-warn",
    danger: "border-danger/40 bg-danger/10 text-danger"
  };

  return (
    <div className="bg-panel rounded-xl p-4 border border-slate-800 flex flex-col min-h-0 overflow-hidden">
      <h3 className="font-medium mb-3 shrink-0">Alerts</h3>
      <div className="space-y-2 shrink-0">
        {alerts?.length ? (
          alerts.map((a, idx) => (
            <div key={idx} className={`px-2 py-1.5 rounded border text-sm ${classBy[a.level] || "border-slate-700 text-textMain"}`}>
              {a.message}
            </div>
          ))
        ) : (
          <p className="text-textSoft text-sm">No active alerts</p>
        )}
      </div>

      <h4 className="mt-4 mb-2 text-sm text-textSoft shrink-0">Alert History</h4>
      {/* The only scrollable region left in the app: this list is unbounded, so
          it takes whatever height the panel has left rather than pushing the
          page taller. */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin space-y-1.5 pr-1">
        {history?.length ? (
          history.map((h) => (
            <div key={h.id} className="text-xs text-textSoft border-b border-slate-800 pb-1">
              <span className="uppercase mr-2">{h.level}</span>
              {h.message} - {new Date(h.timestamp).toLocaleTimeString()}
            </div>
          ))
        ) : (
          <p className="text-xs text-textSoft">No history yet.</p>
        )}
      </div>
    </div>
  );
}
