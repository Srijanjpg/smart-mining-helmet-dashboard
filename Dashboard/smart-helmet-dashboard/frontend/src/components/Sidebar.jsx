const items = [
  { label: "Overview", id: "overview" },
  { label: "Rescue", id: "rescue" }
];

export default function Sidebar({ activeSection, onNavigate }) {
  return (
    <aside className="w-full md:w-52 shrink-0 bg-panel border-b md:border-b-0 md:border-r border-slate-800 p-3 md:p-4 flex flex-col md:h-full overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-lg font-bold tracking-wide">Smart Helmet</h1>
        <p className="text-textSoft text-xs mt-0.5">Admin Dashboard</p>
      </div>

      <nav className="mt-4 flex flex-row md:flex-col gap-2 shrink-0">
        {items.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={[
                "flex-1 md:flex-none text-left px-3 py-2 rounded-lg text-sm transition",
                isActive
                  ? "bg-panelSoft text-textMain border border-slate-700"
                  : "text-textSoft hover:bg-panelSoft hover:text-textMain"
              ].join(" ")}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
