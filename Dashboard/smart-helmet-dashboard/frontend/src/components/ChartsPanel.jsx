import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Legend,
  Tooltip
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Legend, Tooltip);

function chartData(labels, data, label, color) {
  return {
    labels,
    datasets: [
      {
        label,
        data,
        borderColor: color,
        backgroundColor: color,
        tension: 0.3,
        pointRadius: 1.5,
        pointHoverRadius: 3
      }
    ]
  };
}

function quantize(value, step) {
  if (!Number.isFinite(value)) return null;
  if (!Number.isFinite(step) || step <= 0) return value;
  return Math.round(value / step) * step;
}

function finiteValues(values) {
  return values.filter((v) => Number.isFinite(v));
}

function computeBounds(values, { minSpan, padRatio, step = 1, floor = null }) {
  const nums = finiteValues(values);
  if (!nums.length) {
    return { min: 0, max: minSpan };
  }

  let min = Math.min(...nums);
  let max = Math.max(...nums);

  if (min === max) {
    min -= minSpan / 2;
    max += minSpan / 2;
  }

  let span = max - min;
  if (span < minSpan) {
    const mid = (min + max) / 2;
    min = mid - minSpan / 2;
    max = mid + minSpan / 2;
    span = max - min;
  }

  const pad = Math.max(span * padRatio, step);
  min -= pad;
  max += pad;

  if (Number.isFinite(floor)) {
    min = Math.max(min, floor);
  }

  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;

  if (max <= min) {
    max = min + step;
  }

  return { min, max };
}

function buildOptions({ min, max, tickFormatter, tooltipFormatter }) {
  return {
    responsive: true,
    // Without this Chart.js holds a 2:1 aspect ratio and derives its own height
    // from the container width, which makes the chart impossible to fit into a
    // flex row. Turning it off lets the wrapper's height govern instead.
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      // The panel heading already names the series, so the legend is duplicate
      // information costing ~30px of vertical space per chart.
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => tooltipFormatter(ctx.raw)
        }
      }
    },
    scales: {
      x: { ticks: { color: "#64748b" }, grid: { color: "#e2e8f0" } },
      y: {
        min,
        max,
        ticks: {
          color: "#64748b",
          callback: (value) => tickFormatter(value)
        },
        grid: { color: "#e2e8f0" }
      }
    }
  };
}

export default function ChartsPanel({ history }) {
  const oxygenSeries = history.oxygen.map((v) => quantize(v, 0.1));
  const co2Series = history.co2.map((v) => quantize(v, 10));
  const coSeries = history.co;

  const oxygenBounds = computeBounds(oxygenSeries, {
    minSpan: 1.5,
    padRatio: 0.2,
    step: 0.1,
    floor: 0
  });
  const co2Bounds = computeBounds(co2Series, {
    minSpan: 500,
    padRatio: 0.15,
    step: 50,
    floor: 0
  });
  const coBounds = computeBounds(coSeries, {
    minSpan: 5,
    padRatio: 0.08,
    step: 1,
    floor: 0
  });

  const oxygenOptions = buildOptions({
    ...oxygenBounds,
    tickFormatter: (v) => Number(v).toFixed(1),
    tooltipFormatter: (v) => `O2: ${Number(v).toFixed(1)} %`
  });
  const co2Options = buildOptions({
    ...co2Bounds,
    tickFormatter: (v) => `${Math.round(Number(v))}`,
    tooltipFormatter: (v) => `CO2: ${Math.round(Number(v))} ppm`
  });
  const coOptions = buildOptions({
    ...coBounds,
    tickFormatter: (v) => `${Number(v).toFixed(0)}`,
    tooltipFormatter: (v) => `CO: ${Number(v).toFixed(1)} ppm`
  });

  const panels = [
    { title: "CO2 (ppm)", data: chartData(history.labels, co2Series, "CO2", "#ef4444"), options: co2Options },
    { title: "Oxygen (%)", data: chartData(history.labels, oxygenSeries, "O2", "#22c55e"), options: oxygenOptions },
    { title: "CO (ppm)", data: chartData(history.labels, coSeries, "CO", "#f59e0b"), options: coOptions }
  ];

  return (
    // h-full is what makes this fill its flex-1 parent. Without it the grid
    // sizes to its own content and leaves the remaining height empty below.
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 min-h-0 h-full">
      {panels.map((p) => (
        <div
          key={p.title}
          className="bg-panel rounded-xl p-4 border border-slate-800 flex flex-col min-h-0 overflow-hidden"
        >
          <h3 className="mb-3 font-medium shrink-0">{p.title}</h3>
          {/* min-h-0 is required: a flex child defaults to min-height:auto and
              would refuse to shrink below the canvas's natural size. */}
          <div className="flex-1 min-h-0 relative">
            <Line data={p.data} options={p.options} />
          </div>
        </div>
      ))}
    </div>
  );
}
