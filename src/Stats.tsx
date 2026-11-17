import { useEffect, useMemo, useState, memo, useId } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowUpDown,
  ChevronDown,
  Cpu,
  Gpu,
  MemoryStick,
  HardDrive,
  Network,
  ListTree,
  Clock3,
  Monitor,
  Radio,
  Pause,
  Play,
} from "lucide-react";
import { call, native } from "./native";
import {
  gib,
  percent,
  rate,
  type Snapshot,
  type Point,
  type Proc,
} from "./model";
import { IconButton, SearchBox } from "./components";
type Key = "cpu" | "gpu" | "ram" | "down" | "up";
type Trace = [Key, string];
const colors = {
  cpu: "var(--accent)",
  gpu: "var(--secondary)",
  ram: "#aa9af2",
  down: "var(--secondary)",
  up: "var(--accent)",
};
const performance: Trace[] = [
  ["cpu", colors.cpu],
  ["gpu", colors.gpu],
  ["ram", colors.ram],
];
export const Graph = memo(function Graph({
  history,
  series,
  span = 60,
  net = false,
}: {
  history: Point[];
  series: Trace[];
  span?: number;
  net?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const end = history.at(-1)?.time ?? 0;
  const points = history.filter((p) => p.time >= end - span);
  const peak = net
    ? Math.max(
        1,
        ...points.flatMap((p) => series.map(([key]) => p[key] ?? 0)),
      ) * 1.12
    : 100;
  return (
    <svg
      className="plot"
      viewBox="0 0 600 130"
      preserveAspectRatio="none"
      role="img"
      aria-label={
        net ? "Upload and download history" : "Resource usage over time"
      }
    >
      <defs>
        {series.map(([k, c]) => (
          <linearGradient
            key={k}
            id={id + k}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
            gradientUnits="objectBoundingBox"
          >
            <stop stopColor={c} stopOpacity=".17" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1="0"
          x2="600"
          y1={4 + 30 * i}
          y2={4 + 30 * i}
          className="gridline"
        />
      ))}
      {[1, 2, 3, 4, 5].map((i) => (
        <line
          key={i}
          x1={i * 100}
          x2={i * 100}
          y1="0"
          y2="126"
          className="gridline vertical"
        />
      ))}
      {series.map(([key, c]) => {
        const runs: number[][][] = [];
        let group: number[][] = [];
        for (const p of points) {
          const n = p[key];
          if (n == null) {
            if (group.length) runs.push(group);
            group = [];
          } else
            group.push([
              600 * (1 - (end - p.time) / span),
              124 - (120 * n) / peak,
            ]);
        }
        if (group.length) runs.push(group);
        return (
          <g key={key}>
            {runs.map((r, i) => {
              const d = r
                .map(
                  ([x, y], j) =>
                    (j ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2),
                )
                .join(" ");
              const last = r[r.length - 1];
              return (
                <g key={i}>
                  <path
                    fill={`url(#${id + key})`}
                    d={d + " L" + last[0] + " 126 L" + r[0][0] + " 126 Z"}
                  />
                  <path
                    d={d}
                    stroke={c}
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                    strokeWidth="1.65"
                    strokeLinejoin="round"
                  />
                  <circle cx={last[0]} cy={last[1]} r="2.6" fill={c} />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
});
const uptime = (seconds: number) =>
  Math.floor(seconds / 86400) +
  "d " +
  Math.floor((seconds % 86400) / 3600) +
  "h " +
  Math.floor((seconds % 3600) / 60) +
  "m";
function Resource({
  icon: Icon,
  name,
  detail,
  val,
  color,
}: {
  icon: typeof Cpu;
  name: string;
  detail: string;
  val: number | null | undefined;
  color: string;
}) {
  return (
    <div className="resource">
      <span className="resource-icon" style={{ color }}>
        <Icon size={16} />
      </span>
      <div>
        <div className="resource-head">
          <strong>{name}</strong>
          <b>{percent(val)}</b>
        </div>
        <div className="meter">
          <i style={{ width: (val ?? 0) + "%", background: color }} />
        </div>
        <small title={detail}>{detail}</small>
      </div>
    </div>
  );
}
export function Stats({
  interval,
  identify,
}: {
  interval: number;
  identify: (host: string) => void;
}) {
  const [s, setS] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [paused, pause] = useState(false),
    [range, rangeTo] = useState(60),
    [query, search] = useState(""),
    [collapsed, collapse] = useState(false);
  const [sort, setSort] = useState<{ key: keyof Proc; desc: boolean }>({
    key: "memory",
    desc: true,
  });
  const demo =
    import.meta.env.DEV &&
    !native &&
    new URLSearchParams(location.search).has("demo");
  useEffect(() => {
    if (demo) {
      import("./demo").then((m) => setS(m.demoSnapshot()));
      return;
    }
    if (paused || !native) return;
    let live = true,
      timer: ReturnType<typeof setTimeout>;
    async function tick() {
      try {
        const snap = await call<Snapshot | null>("telemetry");
        if (live && snap) {
          setS(snap);
          identify(snap.host);
          setError("");
        }
      } catch (e) {
        if (live) setError(String(e));
      } finally {
        if (live) timer = setTimeout(tick, interval);
      }
    }
    tick();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [interval, paused, identify]);
  const rows = useMemo(
    () =>
      [...(s?.processes ?? [])]
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            String(p.pid).includes(query),
        )
        .sort((a, b) => {
          const k = sort.key;
          const d = k === "name" ? a.name.localeCompare(b.name) : a[k] - b[k];
          return sort.desc ? -d : d;
        }),
    [s, query, sort],
  );
  const pick = (key: keyof Proc) =>
    setSort({ key, desc: sort.key === key ? !sort.desc : key !== "name" });
  const cur = s?.current,
    h = s?.history ?? [];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>System overview</h1>
          <p>
            {s?.os ?? "Windows workstation"}
            <span className="sep">/</span>
            {s?.host ?? "Local device"}
          </p>
        </div>
        <div className="live">
          <i />
          {paused
            ? "Paused"
            : error
              ? "Retrying"
              : demo
                ? "Sample data"
                : s
                  ? "Live telemetry"
                  : "Connecting"}
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="dash-grid">
        <section className="panel perf">
          <header>
            <div className="section-name">
              <Activity />
              Performance
            </div>
            <div className="flex items-center gap-2">
              <div className="segment">
                {[30, 60, 120].map((n) => (
                  <button
                    key={n}
                    aria-pressed={range === n}
                    onClick={() => rangeTo(n)}
                  >
                    {n}s
                  </button>
                ))}
              </div>
              <IconButton
                title={paused ? "Resume display" : "Pause display"}
                onClick={() => pause(!paused)}
              >
                {paused ? <Play /> : <Pause />}
              </IconButton>
            </div>
          </header>
          <div className="metrics">
            {performance.map(([k, c], i) => (
              <div key={k}>
                <small>
                  <i style={{ background: c }} />
                  {["CPU usage", "GPU usage", "Memory"][i]}
                </small>
                <strong className={cur?.[k] == null ? "unavailable" : ""}>
                  {cur?.[k] == null ? "Unavailable" : Math.round(cur[k]!)}
                  {cur?.[k] != null && <em>%</em>}
                </strong>
              </div>
            ))}
          </div>
          <div className="chart-wrap">
            <div className="axis">
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>
            <Graph history={h} series={performance} span={range} />
          </div>
          <div className="time-axis">
            <span>−{range}s</span>
            <span>−{range / 2}s</span>
            <span>Now</span>
          </div>
        </section>
        <section className="panel hardware">
          <header>
            <div className="section-name">
              <Cpu />
              Hardware
            </div>
          </header>
          <Resource
            icon={Cpu}
            name="Processor"
            detail={s?.cpuName ?? "Unavailable"}
            val={cur?.cpu}
            color={colors.cpu}
          />
          <Resource
            icon={Gpu}
            name="Graphics"
            detail={s?.gpuName ?? "Unavailable"}
            val={cur?.gpu}
            color={colors.gpu}
          />
          <Resource
            icon={MemoryStick}
            name="Memory"
            detail={s ? `${gib(s.used)} / ${gib(s.total)} GiB` : "Unavailable"}
            val={cur?.ram}
            color={colors.ram}
          />
          <Resource
            icon={HardDrive}
            name="Storage"
            detail={
              s?.diskTotal != null && s.diskUsed != null
                ? `${gib(s.diskUsed)} / ${gib(s.diskTotal)} GiB`
                : "Unavailable"
            }
            val={
              s?.diskTotal && s.diskUsed != null
                ? (s.diskUsed / s.diskTotal) * 100
                : null
            }
            color="#9caebc"
          />
        </section>
        <section className="panel processes">
          <header>
            <div className="section-name">
              <ListTree />
              Processes{" "}
              <span className="count">{s?.processes.length ?? "—"}</span>
            </div>
            <IconButton
              title={
                collapsed ? "Expand process list" : "Collapse process list"
              }
              aria-expanded={!collapsed}
              onClick={() => collapse(!collapsed)}
            >
              <ChevronDown
                style={{ transform: collapsed ? "rotate(-90deg)" : "" }}
              />
            </IconButton>
          </header>
          <div className={"process-body " + (collapsed ? "closed" : "")}>
            <div>
              <div className="process-search">
                <SearchBox
                  placeholder="Filter by process or PID"
                  value={query}
                  change={search}
                />
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {(["name", "pid", "cpu", "memory"] as const).map(
                        (k, i) => (
                          <th
                            key={k}
                            aria-sort={
                              sort.key === k
                                ? sort.desc
                                  ? "descending"
                                  : "ascending"
                                : "none"
                            }
                          >
                            <button onClick={() => pick(k)}>
                              {["Process name", "PID", "CPU", "Memory"][i]}
                              {sort.key === k && <ArrowUpDown size={10} />}
                            </button>
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr key={p.pid}>
                        <td title={p.name}>
                          <span className="proc-dot" />
                          {p.name}
                        </td>
                        <td>{p.pid}</td>
                        <td>{p.cpu.toFixed(1)}%</td>
                        <td>{(p.memory / 2 ** 20).toFixed(0)} MiB</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!rows.length && (
                  <p className="empty">
                    {query ? "No matching processes." : "Waiting for a sample…"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
        <div className="right-stack">
          <section className="panel network">
            <header>
              <div className="section-name">
                <Network />
                Network I/O
              </div>
            </header>
            <div className="network-readings">
              <div>
                <small>
                  <ArrowDownLeft />
                  Download
                </small>
                <b>{rate(cur?.down)}</b>
              </div>
              <div>
                <small>
                  <ArrowUpRight />
                  Upload
                </small>
                <b>{rate(cur?.up)}</b>
              </div>
            </div>
            <Graph
              history={h}
              series={[
                ["down", colors.down],
                ["up", colors.up],
              ]}
              span={range}
              net
            />
          </section>
          <section className="panel sensors">
            <header>
              <div className="section-name">
                <Radio />
                Sensors
              </div>
            </header>
            {[
              ["CPU temperature", s?.cpuTemp],
              ["GPU temperature", s?.gpuTemp],
            ].map(([n, v]) => (
              <div key={n}>
                <span>{n}</span>
                <b>{typeof v === "number" ? v + " °C" : "Unavailable"}</b>
              </div>
            ))}
          </section>
        </div>
      </div>
      <footer className="telemetry-foot">
        <span>
          <Monitor />
          {s?.cores ?? "—"} logical cores
        </span>
        <span>
          <Clock3 />
          Uptime {s ? uptime(s.uptime) : "—"}
        </span>
        <span>Refresh {interval / 1000}s</span>
      </footer>
    </>
  );
}
