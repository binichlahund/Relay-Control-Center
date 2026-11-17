import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Config } from "./model";
export const native = isTauri();
export const overlay = new URLSearchParams(location.search).has("overlay");
export const call = <T>(name: string, args?: Record<string, unknown>) =>
  invoke<T>(name, args);
export async function load() {
  return native
    ? call<unknown>("load_config")
    : JSON.parse(localStorage.getItem("relay-preview") ?? "null");
}
export async function save(data: Config) {
  if (native) await call("save_config", { data });
  else localStorage.setItem("relay-preview", JSON.stringify(data));
}
export const win = () => getCurrentWindow();
