import { z } from "zod";
import starter from "../config/shortcuts.json";
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const title = z.string().trim().min(1).max(100);
export const palette = z.object({
  name: title,
  accent: hex,
  secondary: hex,
  start: hex,
  end: hex,
  angle: z.number().int().min(0).max(360),
});
export type Palette = z.infer<typeof palette>;
export const presets: Palette[] = [
  ["Blue Neon", "#809dff", "#71d5fa", "#36478c", "#172941"],
  ["Purple Night", "#b298fc", "#e0a9f2", "#554477", "#29203b"],
  ["Emerald Glow", "#70d4ad", "#b8db89", "#28574b", "#1a3029"],
  ["Crimson Dark", "#f28c9f", "#f4ba94", "#643746", "#341e2c"],
  ["Frost / Ice", "#92d5ec", "#b3c0ff", "#3b596f", "#243343"],
  ["Minimal Gray", "#bbc2d0", "#e0e2e8", "#464c59", "#282b33"],
].map(([name, accent, secondary, start, end]) => ({
  name,
  accent,
  secondary,
  start,
  end,
  angle: 120,
}));
export const shortcut = z.object({
  id: title,
  name: title,
  target: z.string().trim().min(1).max(4096),
  category: title,
  icon: z.string().max(40000),
  color: hex,
});
export type Shortcut = z.infer<typeof shortcut>;
const schema = z
  .object({
    version: z.literal(2),
    theme: palette,
    presets: z.array(palette).max(50),
    font: z.number().int().min(9).max(14),
    scale: z.number().int().min(85).max(125),
    opacity: z.number().int().min(75).max(100),
    animations: z.boolean(),
    speed: z.number().min(0.5).max(1.5),
    interval: z.union([z.literal(1000), z.literal(2000), z.literal(5000)]),
    hotkey: z.enum(["", "Alt+Space", "Ctrl+Shift+Space", "Ctrl+Alt+K"]),
    shortcuts: z.array(shortcut).max(300),
  })
  .refine(
    (c) => new Set(c.shortcuts.map((s) => s.id)).size === c.shortcuts.length,
    "Duplicate shortcut IDs",
  );
export type Config = z.infer<typeof schema>;
export const defaults = (): Config => ({
  version: 2,
  theme: { ...presets[0] },
  presets: [],
  font: 10,
  scale: 100,
  opacity: 100,
  animations: true,
  speed: 1,
  interval: 1000,
  hotkey: "",
  shortcuts: starter.map((s, i) => ({ ...s, id: "app-" + i })),
});
export function decode(value: unknown): Config {
  if (
    value &&
    typeof value === "object" &&
    "version" in value &&
    value.version === 1
  ) {
    const old = z
      .object({
        theme: title,
        colors: z.tuple([hex, hex, hex]),
        font: schema.shape.font,
        scale: schema.shape.scale,
        opacity: schema.shape.opacity,
        shortcuts: z.array(shortcut.omit({ id: true })),
      })
      .parse(value);
    const [accent, start, end] = old.colors;
    return schema.parse({
      ...defaults(),
      font: old.font,
      scale: old.scale,
      opacity: old.opacity,
      theme: {
        ...(presets.find((p) => p.name === old.theme) ?? presets[0]),
        name: old.theme,
        accent,
        start,
        end,
      },
      shortcuts: old.shortcuts.map((s, i) => ({ ...s, id: "app-" + i })),
    });
  }
  return schema.parse(value);
}
export type Point = {
  time: number;
  cpu: number;
  gpu: number | null;
  ram: number;
  down: number;
  up: number;
};
export type Proc = { pid: number; name: string; cpu: number; memory: number };
export type Snapshot = {
  current: Point;
  history: Point[];
  cpuName: string | null;
  gpuName: string | null;
  cores: number;
  cpuTemp: number | null;
  gpuTemp: number | null;
  used: number;
  total: number;
  diskTotal: number | null;
  diskUsed: number | null;
  uptime: number;
  os: string;
  host: string;
  processes: Proc[];
};
export const gib = (v: number) => (v / 2 ** 30).toFixed(1);
export function rate(v: number | undefined) {
  if (v === undefined) return "—";
  return v >= 1048576
    ? (v / 1048576).toFixed(1) + " MB/s"
    : v >= 1024
      ? (v / 1024).toFixed(1) + " KB/s"
      : Math.round(v) + " B/s";
}
export const percent = (v: number | null | undefined) =>
  v == null ? "Unavailable" : Math.round(v) + "%";
