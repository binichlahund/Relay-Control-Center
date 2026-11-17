import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  AppWindow,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  FolderOpen,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
  Calculator,
  Command,
} from "lucide-react";
import brave from "simple-icons/icons/brave.svg?raw";
import chat from "simple-icons/icons/openai.svg?raw";
import discord from "simple-icons/icons/discord.svg?raw";
import steam from "simple-icons/icons/steam.svg?raw";
import game from "simple-icons/icons/battledotnet.svg?raw";
import { call, native } from "./native";
import { Button, IconButton, Modal, SearchBox } from "./components";
import { shortcut, type Config, type Shortcut } from "./model";
const brands: Record<string, string> = { brave, chat, discord, steam, game };
const icons = new Map<string, Promise<string | null>>();
function AppIcon({ app }: { app: Shortcut }) {
  const [shell, setShell] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setShell(null);
    if (
      native &&
      !brands[app.icon] &&
      !app.icon.startsWith("data:") &&
      !app.target.includes("://")
    ) {
      if (!icons.has(app.target))
        icons.set(
          app.target,
          call<string | null>("app_icon", { target: app.target }).catch(
            () => null,
          ),
        );
      icons.get(app.target)!.then((v) => {
        if (live) setShell(v);
      });
    }
    return () => {
      live = false;
    };
  }, [app.target, app.icon]);
  const image = app.icon.startsWith("data:image/png;base64,")
    ? app.icon
    : shell;
  return (
    <span
      className="app-icon"
      style={{
        color: app.color,
        background: "color-mix(in srgb," + app.color + " 10%,var(--panel))",
      }}
    >
      {image ? (
        <img alt="" src={image} />
      ) : brands[app.icon] ? (
        <span
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: brands[app.icon] }}
        />
      ) : app.icon === "calc" ? (
        <Calculator />
      ) : (
        <AppWindow />
      )}
    </span>
  );
}
type Props = {
  config: Config;
  update: (c: Config) => void;
  notify: (msg: string) => void;
  flush: () => Promise<void>;
  compact?: boolean;
  close?: () => void;
};
export function Shortcuts({
  config,
  update,
  notify,
  flush,
  compact = false,
  close,
}: Props) {
  const [query, search] = useState(""),
    [editing, edit] = useState<Shortcut | null>(null),
    [selected, select] = useState(0),
    [opened, open] = useState(""),
    [invalid, setInvalid] = useState("");
  const [focused, focusApp] = useState("");
  const list = config.shortcuts.filter((s) =>
    (s.name + " " + s.category).toLowerCase().includes(query.toLowerCase()),
  );
  const active = list.find((s) => s.id === focused) ?? list[0];
  const setApps = (shortcuts: Shortcut[]) => update({ ...config, shortcuts });
  async function launch(app: Shortcut) {
    try {
      await flush();
      if (!native) throw Error("Open the desktop app to launch shortcuts.");
      await call("launch_shortcut", { id: app.id });
      open(app.id);
      notify("Opened " + app.name);
      window.setTimeout(() => open(""), 800);
      if (compact) close?.();
    } catch (e) {
      notify(String(e));
    }
  }
  useEffect(() => {
    if (!compact || editing) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        select((i) =>
          Math.max(
            0,
            Math.min(list.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)),
          ),
        );
      }
      if (
        e.key === "Enter" &&
        list[selected] &&
        !(e.target instanceof HTMLButtonElement)
      ) {
        e.preventDefault();
        void launch(list[selected]);
      }
      if (e.key === "Escape") close?.();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [compact, list, selected, editing]);
  function editor(app?: Shortcut) {
    setInvalid("");
    edit(
      app ?? {
        id: crypto.randomUUID(),
        name: "",
        category: "Application",
        target: "",
        color: config.theme.accent,
        icon: "auto",
      },
    );
  }
  async function browse() {
    try {
      const target = await call<string | null>("pick_app");
      if (target)
        edit(
          (e) =>
            e && {
              ...e,
              target,
              name:
                e.name ||
                target
                  .split(/[\\/]/)
                  .at(-1)!
                  .replace(/\.(exe|lnk)$/i, ""),
            },
        );
    } catch (e) {
      notify(String(e));
    }
  }
  function accept() {
    if (!editing) return;
    const parsed = shortcut.safeParse(editing);
    if (!parsed.success) {
      setInvalid("Enter an app name, category, and destination.");
      return;
    }
    if (
      !/^(https?:\/\/|steam:\/\/|discord:\/\/|battlenet:\/\/)/i.test(
        editing.target,
      ) &&
      !/\.(exe|lnk)$/i.test(editing.target)
    ) {
      setInvalid(
        "Choose an executable, Windows shortcut, or supported app link.",
      );
      return;
    }
    setApps(
      config.shortcuts.some((s) => s.id === editing.id)
        ? config.shortcuts.map((s) => (s.id === editing.id ? parsed.data : s))
        : [...config.shortcuts, parsed.data],
    );
    edit(null);
  }
  function move(id: string, by: number) {
    const a = [...config.shortcuts],
      i = a.findIndex((s) => s.id === id),
      j = i + by;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    setApps(a);
  }
  return (
    <>
      {!compact ? (
        <div className="page-heading">
          <div>
            <h1>App launcher</h1>
            <p>{config.shortcuts.length} shortcuts in your library</p>
          </div>
          <Button className="primary" onClick={() => editor()}>
            <Plus />
            Add shortcut
          </Button>
        </div>
      ) : (
        <header className="overlay-head">
          <span>
            <Command />
            Quick launcher
          </span>
          <IconButton title="Close launcher" onClick={close}>
            <X />
          </IconButton>
        </header>
      )}
      <div className="launcher-filter">
        <SearchBox
          focus={compact}
          value={query}
          change={(v) => {
            search(v);
            select(0);
          }}
          placeholder="Search applications…"
        />
        {!compact && (
          <Button
            onClick={() => call("open_overlay").catch((e) => notify(String(e)))}
          >
            <Command />
            Quick launcher
          </Button>
        )}
      </div>
      <div className={compact ? "quick-layout" : "library-layout"}>
        <div className={compact ? "quick-list" : "apps-grid"}>
          <AnimatePresence mode="popLayout" initial>
            {list.map((app, i) => (
              <motion.div
                layout
                key={app.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16, delay: Math.min(i, 5) * 0.016 }}
                className={
                  "app-card " + (compact && i === selected ? "selected" : "")
                }
              >
                <motion.button
                  className="app-launch"
                  onClick={() => launch(app)}
                  whileTap={{ scale: 0.98 }}
                  onFocus={() => focusApp(app.id)}
                  onMouseEnter={() => {
                    if (compact) select(i);
                    else focusApp(app.id);
                  }}
                >
                  <AppIcon app={app} />
                  <span>
                    <strong>{app.name}</strong>
                    <small>{app.category}</small>
                  </span>
                  {opened === app.id ? (
                    <Check className="launch-mark" />
                  ) : (
                    <ArrowUpRight className="launch-mark" />
                  )}
                </motion.button>
                {!compact && (
                  <div className="app-foot">
                    <small title={app.target}>{app.target}</small>
                    <IconButton
                      title={"Edit " + app.name}
                      onClick={() => editor(app)}
                    >
                      <MoreHorizontal />
                    </IconButton>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {!compact && active && (
          <section className="panel app-inspector">
            <header>
              <div className="section-name">
                <AppWindow />
                Shortcut details
              </div>
            </header>
            <div className="app-portrait" style={{ color: active.color }}>
              <svg
                viewBox="0 0 250 90"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {Array.from({ length: 13 }, (_, i) => (
                  <path
                    key={i}
                    d={`M -10 ${78 + i * 2} Q 50 ${10 + i * 3} 120 ${50 + i * 2} T 265 ${8 + i * 3}`}
                    stroke="currentColor"
                    fill="none"
                    opacity=".22"
                  />
                ))}
              </svg>
              <AppIcon app={active} />
            </div>
            <div className="inspector-body">
              <h2>{active.name}</h2>
              <small>{active.category}</small>
              <dl>
                <dt>Destination</dt>
                <dd>{active.target}</dd>
              </dl>
              <Button onClick={() => editor(active)}>Edit shortcut</Button>
              <Button className="primary" onClick={() => launch(active)}>
                Launch <ArrowUpRight />
              </Button>
            </div>
          </section>
        )}
      </div>
      {!list.length && (
        <p className="empty">
          <Search size={16} /> No matching shortcuts.
        </p>
      )}
      {editing && (
        <Modal
          title={
            config.shortcuts.some((s) => s.id === editing.id)
              ? "Edit shortcut"
              : "Add shortcut"
          }
          close={() => edit(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              accept();
            }}
          >
            <label>
              Name
              <input
                autoFocus
                required
                maxLength={100}
                value={editing.name}
                onChange={(e) => edit({ ...editing, name: e.target.value })}
              />
            </label>
            <label>
              Application or URL
              <div className="field-with-button">
                <input
                  required
                  value={editing.target}
                  onChange={(e) => edit({ ...editing, target: e.target.value })}
                  placeholder="Choose an app or enter a URL"
                />
                <IconButton
                  type="button"
                  title="Choose application"
                  onClick={browse}
                >
                  <FolderOpen />
                </IconButton>
              </div>
            </label>
            <label>
              Category
              <input
                required
                value={editing.category}
                onChange={(e) => edit({ ...editing, category: e.target.value })}
              />
            </label>
            <div className="editor-icon">
              <AppIcon app={editing} />
              <Button
                type="button"
                onClick={async () => {
                  try {
                    const icon = await call<string | null>("pick_icon");
                    if (icon) edit({ ...editing, icon });
                  } catch (e) {
                    notify(String(e));
                  }
                }}
              >
                Choose PNG
              </Button>
              <Button
                type="button"
                onClick={() => edit({ ...editing, icon: "auto" })}
              >
                Automatic
              </Button>
            </div>
            {invalid && <p role="alert">{invalid}</p>}
            <footer>
              {config.shortcuts.some((s) => s.id === editing.id) && (
                <>
                  <IconButton
                    type="button"
                    title="Remove shortcut"
                    onClick={() => {
                      setApps(
                        config.shortcuts.filter((s) => s.id !== editing.id),
                      );
                      edit(null);
                    }}
                  >
                    <Trash2 />
                  </IconButton>
                  <IconButton
                    type="button"
                    title="Move earlier"
                    disabled={config.shortcuts[0].id === editing.id}
                    onClick={() => move(editing.id, -1)}
                  >
                    <ArrowUp />
                  </IconButton>
                  <IconButton
                    type="button"
                    title="Move later"
                    disabled={config.shortcuts.at(-1)?.id === editing.id}
                    onClick={() => move(editing.id, 1)}
                  >
                    <ArrowDown />
                  </IconButton>
                </>
              )}
              <Button type="submit" className="primary ml-auto">
                Save shortcut
              </Button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
