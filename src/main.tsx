import React, { useEffect, useState, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  AnimatePresence,
  motion,
  MotionConfig,
  MotionGlobalConfig,
  useReducedMotion,
} from "motion/react";
import {
  Activity,
  AppWindow,
  Palette,
  Settings2,
  Monitor,
  Command,
  Minus,
  Square,
  X,
  Check,
  PanelLeft,
  ChevronRight,
  Keyboard,
} from "lucide-react";
import { listen, emit } from "@tauri-apps/api/event";
import { Config, decode, defaults } from "./model";
import { native, overlay, call, load, save, win } from "./native";
import { Mark, Fade, IconButton } from "./components";
import { Stats } from "./Stats";
import { Shortcuts } from "./Shortcuts";
import { Settings } from "./Settings";
import { Themes } from "./Themes";
import "./style.css";
const pages = [
  ["Computer stats", Activity],
  ["Shortcuts", AppWindow],
  ["Themes", Palette],
  ["Settings", Settings2],
] as const;
function App() {
  const [config, setConfig] = useState<Config>(defaults),
    [current, nav] = useState(0),
    [host, identify] = useState("Local workstation"),
    [saved, status] = useState(""),
    [ready, setReady] = useState(false),
    [msg, message] = useState(""),
    [show, setShow] = useState(true),
    [mini, setMini] = useState(false);
  const systemReduce = useReducedMotion(),
    reduce = systemReduce || !config.animations;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const notify = useCallback((m: string) => {
    clearTimeout(toastTimer.current);
    message(m);
    toastTimer.current = setTimeout(() => message(""), 4500);
  }, []);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);
  const persist = useCallback(
    (data: Config) => {
      const rev = ++revision.current;
      status("Saving…");
      pending.current = pending.current
        .catch(() => {})
        .then(async () => {
          if (rev !== revision.current) return;
          await save(data);
          if (rev === revision.current) {
            status("Saved");
            if (native) await emit("relay-settings", data);
          }
        });
      pending.current.catch((e) => {
        status("Save failed");
        notify(String(e));
      });
    },
    [notify],
  );
  const update = useCallback(
    (c: Config) => {
      try {
        const next = decode(c);
        setConfig(next);
        persist(next);
      } catch {
        notify("Invalid preference. Check the value and try again.");
      }
    },
    [persist, notify],
  );
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const raw = await load();
        const c = raw ? decode(raw) : defaults();
        if (!live) return;
        setConfig(c);
        if (!overlay && (!raw || (raw as Config).version !== 2)) persist(c);
      } catch {
        if (live)
          notify(
            "Saved configuration could not be loaded. Import a backup in Settings.",
          );
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!ready || !native || overlay) return;
    call("set_interval", { ms: config.interval }).catch((e) =>
      notify(String(e)),
    );
  }, [ready, config.interval]);
  useEffect(() => {
    if (!ready || !native || overlay) return;
    call("set_hotkey", { key: config.hotkey }).catch((e) => {
      notify(String(e));
      if (config.hotkey) update({ ...config, hotkey: "" });
    });
  }, [ready, config.hotkey]);
  useEffect(() => {
    if (!native) return;
    const off = overlay
      ? [
          listen<Config>("relay-settings", (e) => setConfig(e.payload)),
          listen("launcher-open", () => setShow(true)),
        ]
      : [
          win().onCloseRequested(async (e) => {
            e.preventDefault();
            try {
              await pending.current;
              await win().destroy();
            } catch (err) {
              notify(String(err));
            }
          }),
        ];
    return () => {
      off.forEach((p) => p.then((f) => f()));
    };
  }, []);
  useEffect(() => {
    MotionGlobalConfig.skipAnimations = !!reduce;
    const r = document.documentElement,
      t = config.theme;
    for (const [k, v] of Object.entries(t))
      r.style.setProperty("--" + k, k === "angle" ? v + "deg" : String(v));
    r.style.setProperty("--text-size", config.font * 1.3 + "px");
    r.style.setProperty("--scale", String(config.scale / 100));
    r.style.setProperty("--surface-opacity", String(config.opacity / 100));
    r.style.setProperty(
      "--duration",
      reduce ? "0ms" : 150 / config.speed + "ms",
    );
    r.dataset.motion = reduce ? "off" : "on";
    r.dataset.duration = String(1 / config.speed);
  }, [config, reduce]);
  const quick = useCallback(() => {
    if (native) call("open_overlay").catch((e) => notify(String(e)));
    else {
      nav(1);
    }
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !overlay) {
        e.preventDefault();
        quick();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quick]);
  function dismiss() {
    setShow(false);
    setTimeout(
      () =>
        win()
          .hide()
          .catch((e) => notify(String(e))),
      reduce ? 0 : 135,
    );
  }
  const shortcutProps = {
    config,
    update,
    notify,
    flush: () => pending.current,
  };
  const toast = (
    <AnimatePresence>
      {msg && (
        <motion.div
          role="status"
          className="toast"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {msg}
          <IconButton title="Dismiss message" onClick={() => message("")}>
            <X />
          </IconButton>
        </motion.div>
      )}
    </AnimatePresence>
  );
  return (
    <MotionConfig
      reducedMotion={reduce ? "always" : "user"}
      transition={{ duration: reduce ? 0 : 0.18 / config.speed }}
    >
      {overlay ? (
        <div className="overlay-shell">
          <AnimatePresence>
            {show && (
              <motion.div
                className="overlay-body"
                initial={reduce ? false : { opacity: 0, scale: 0.985, y: 5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.99, y: 3 }}
              >
                <Shortcuts {...shortcutProps} compact close={dismiss} />
              </motion.div>
            )}
          </AnimatePresence>
          {toast}
        </div>
      ) : (
        <div className={"shell " + (mini ? "mini" : "")}>
          <aside>
            <div className="brand" data-tauri-drag-region>
              <Mark />
              <b>Relay</b>
            </div>
            <small className="nav-label">Workspace</small>
            <nav>
              {pages.map(([name, Icon], i) => (
                <button
                  key={name}
                  title={name}
                  aria-current={current === i ? "page" : undefined}
                  onClick={() => nav(i)}
                >
                  {current === i && (
                    <motion.span
                      layoutId="nav-active"
                      className="nav-active"
                      transition={{
                        type: "spring",
                        stiffness: 460,
                        damping: 39,
                      }}
                    />
                  )}
                  <Icon />
                  <span>{name}</span>
                </button>
              ))}
            </nav>
            <div className="side-bottom">
              <button className="quick" onClick={quick}>
                <Keyboard />
                <span>Quick launcher</span>
                <kbd>Ctrl K</kbd>
              </button>
              <div className="workstation">
                <span className="device-glyph">
                  <Monitor />
                </span>
                <div>
                  <b title={host}>{host}</b>
                  <small>Local workstation</small>
                </div>
              </div>
            </div>
          </aside>
          <div className="workspace">
            <div
              className="titlebar"
              data-tauri-drag-region
              onDoubleClick={(e) => {
                if (e.target === e.currentTarget && native)
                  win().toggleMaximize();
              }}
            >
              <IconButton title="Toggle sidebar" onClick={() => setMini(!mini)}>
                <PanelLeft />
              </IconButton>
              <span data-tauri-drag-region>Workspace</span>
              <ChevronRight size={11} />
              <b data-tauri-drag-region>{pages[current][0]}</b>
              <div className="window-controls">
                {[
                  ["Minimize", Minus, () => win().minimize()],
                  ["Maximize or restore", Square, () => win().toggleMaximize()],
                  ["Close", X, () => win().close()],
                ].map(([name, Icon, action]) => {
                  const I = Icon as typeof X;
                  return (
                    <button
                      key={String(name)}
                      aria-label={String(name)}
                      title={String(name)}
                      onClick={() =>
                        native &&
                        (action as () => Promise<void>)().catch((e) =>
                          notify(String(e)),
                        )
                      }
                    >
                      <I size={13} />
                    </button>
                  );
                })}
              </div>
            </div>
            <main>
              <Fade page={String(current)}>
                {current === 0 ? (
                  <Stats interval={config.interval} identify={identify} />
                ) : current === 1 ? (
                  <Shortcuts {...shortcutProps} />
                ) : current === 2 ? (
                  <Themes config={config} update={update} />
                ) : (
                  <Settings config={config} update={update} notify={notify} />
                )}
              </Fade>
            </main>
            <div className="statusbar">
              <span>
                <i />
                Local session
              </span>
              <span aria-live="polite">
                {saved && (
                  <>
                    <Check size={11} />
                    {saved}
                  </>
                )}
              </span>
              <span>Relay 2.0</span>
            </div>
          </div>
          {toast}
        </div>
      )}
    </MotionConfig>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
