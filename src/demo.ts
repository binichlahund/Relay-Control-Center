// A development-only fixture for reviewing the layout without Windows sensors.
import type { Snapshot } from "./model";
export function demoSnapshot(): Snapshot {
  const now = Date.now() / 1000;
  const history = Array.from({ length: 121 }, (_, i) => ({
    time: now - 120 + i,
    cpu: 22 + Math.sin(i * 0.27) * 8 + Math.sin(i * 0.83) * 4,
    gpu: 15 + Math.sin(i * 0.18) * 4,
    ram: 48 + i * 0.008,
    down: 120000 + Math.sin(i * 0.6) * 32000,
    up: 27000 + Math.cos(i * 0.3) * 13000,
  }));
  return {
    current: history[120],
    history,
    host: "Preview workstation",
    os: "Windows · Sample data",
    cpuName: "Sample processor",
    gpuName: "Sample graphics adapter",
    cores: 8,
    cpuTemp: null,
    gpuTemp: 42,
    used: 8 * 2 ** 30,
    total: 16 * 2 ** 30,
    diskTotal: 500 * 2 ** 30,
    diskUsed: 180 * 2 ** 30,
    uptime: 18000,
    processes: ["Relay.exe", "explorer.exe", "dwm.exe"].map((name, i) => ({
      name,
      pid: 1024 + i * 12,
      cpu: 1.6 / (i + 1),
      memory: 100000000 / (i + 1),
    })),
  };
}
