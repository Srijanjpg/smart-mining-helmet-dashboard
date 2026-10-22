export default function AudioStatus({ audio }) {
  const rows = [
    { label: "Microphone", online: audio?.mic },
    { label: "Speaker", online: audio?.speaker }
  ];

  return (
    <div className="bg-panel rounded-xl p-4 border border-slate-800 flex flex-col min-h-0 overflow-hidden">
      <h3 className="font-medium mb-3 shrink-0">Audio / Communication</h3>
      {/* Centred in the leftover height so the card reads as deliberately
          sized rather than leaving a gap beneath its content. */}
      <div className="flex-1 min-h-0 flex flex-col justify-center gap-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <span className="text-textSoft">{r.label}</span>
            <span className={r.online ? "text-safe" : "text-danger"}>
              {r.online ? "Online" : "Offline"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
