import { useState } from "react";
import {
  Download,
  Upload,
  RotateCcw,
  SlidersHorizontal,
  Keyboard,
  Gauge,
  FolderCog,
} from "lucide-react";
import {
  Button,
  Row,
  SearchBox,
  Select,
  Slider,
  Toggle,
  Modal,
} from "./components";
import { decode, defaults, type Config } from "./model";
import { call } from "./native";
export function Settings({
  config: c,
  update,
  notify,
}: {
  config: Config;
  update: (c: Config) => void;
  notify: (m: string) => void;
}) {
  const [q, setQ] = useState(""),
    [reset, ask] = useState(false);
  const set = <K extends keyof Config>(key: K, v: Config[K]) =>
    update({ ...c, [key]: v });
  const groups = [
    {
      name: "Appearance",
      icon: SlidersHorizontal,
      rows: [
        [
          "Font size",
          "Text size throughout the interface.",
          <Slider
            label="Font size"
            value={c.font}
            min={9}
            max={14}
            unit=" pt"
            change={(v) => set("font", v)}
          />,
        ],
        [
          "Interface scale",
          "Adjust the density of the entire window.",
          <Slider
            label="Interface scale"
            value={c.scale}
            min={85}
            max={125}
            unit="%"
            change={(v) => set("scale", v)}
          />,
        ],
        [
          "Window opacity",
          "Let the desktop show through the workspace.",
          <Slider
            label="Window opacity"
            value={c.opacity}
            min={75}
            max={100}
            unit="%"
            change={(v) => set("opacity", v)}
          />,
        ],
      ],
    },
    {
      name: "Behavior",
      icon: Keyboard,
      rows: [
        [
          "Interface animations",
          "Windows reduced-motion preferences take precedence.",
          <Toggle
            label="Interface animations"
            value={c.animations}
            change={(v) => set("animations", v)}
          />,
        ],
        [
          "Animation speed",
          "Adjust the pace of transitions.",
          <Slider
            label="Animation speed"
            value={c.speed}
            min={0.5}
            max={1.5}
            step={0.1}
            unit="×"
            change={(v) => set("speed", v)}
          />,
        ],
        [
          "Global launcher hotkey",
          "Open the quick launcher from another application.",
          <Select
            label="Global launcher hotkey"
            value={c.hotkey}
            options={[
              ["", "Disabled"],
              ["Alt+Space", "Alt + Space"],
              ["Ctrl+Shift+Space", "Ctrl + Shift + Space"],
              ["Ctrl+Alt+K", "Ctrl + Alt + K"],
            ]}
            change={async (v) => {
              try {
                await call("set_hotkey", { key: v });
                set("hotkey", v as Config["hotkey"]);
              } catch (e) {
                notify(String(e));
              }
            }}
          />,
        ],
      ],
    },
    {
      name: "Performance",
      icon: Gauge,
      rows: [
        [
          "Sampling interval",
          "Time between hardware and process readings.",
          <Select
            label="Sampling interval"
            value={String(c.interval)}
            options={[
              ["1000", "1 second"],
              ["2000", "2 seconds"],
              ["5000", "5 seconds"],
            ]}
            change={(v) => set("interval", +v as Config["interval"])}
          />,
        ],
      ],
    },
    {
      name: "Data",
      icon: FolderCog,
      rows: [
        [
          "Configuration",
          "Back up or restore themes, settings and shortcuts.",
          <>
            <Button
              onClick={async () => {
                try {
                  if (await call("export_config", { data: c }))
                    notify("Configuration exported");
                } catch (e) {
                  notify(String(e));
                }
              }}
            >
              <Download />
              Export
            </Button>
            <Button
              onClick={async () => {
                try {
                  const raw = await call("import_config");
                  if (raw) {
                    update(decode(raw));
                    notify("Configuration imported");
                  }
                } catch {
                  notify(
                    "Import failed. Choose a valid Relay configuration JSON file.",
                  );
                }
              }}
            >
              <Upload />
              Import
            </Button>
          </>,
        ],
        [
          "Restore defaults",
          "Restore the starter shortcuts, appearance and behavior.",
          <Button onClick={() => ask(true)}>
            <RotateCcw />
            Reset
          </Button>,
        ],
      ],
    },
  ];
  const sections = groups
    .map((g) => ({
      ...g,
      rows: g.rows.filter(([n, d]) =>
        (g.name + " " + n + " " + d).toLowerCase().includes(q.toLowerCase()),
      ),
    }))
    .filter((g) => g.rows.length);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Settings</h1>
          <p>Workspace preferences and configuration.</p>
        </div>
        <SearchBox value={q} change={setQ} placeholder="Find a setting" />
      </div>
      <div className="settings-list">
        {sections.map((g) => (
          <section key={g.name}>
            <h2 className="group-title">
              <g.icon />
              {g.name}
            </h2>
            <div className="panel">
              {g.rows.map(([n, d, control]) => (
                <Row key={String(n)} name={String(n)} detail={String(d)}>
                  {control}
                </Row>
              ))}
            </div>
          </section>
        ))}
        {!sections.length && <p className="empty">No matching settings.</p>}
      </div>
      {reset && (
        <Modal title="Restore defaults?" close={() => ask(false)}>
          <p>
            This replaces your saved themes, shortcuts and interface
            preferences.
          </p>
          <footer>
            <Button onClick={() => ask(false)}>Cancel</Button>
            <Button
              className="primary"
              onClick={() => {
                update(defaults());
                ask(false);
                notify("Default settings restored");
              }}
            >
              Restore defaults
            </Button>
          </footer>
        </Modal>
      )}
    </>
  );
}
