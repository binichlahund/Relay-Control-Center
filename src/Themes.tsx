import { useState } from "react";
import { Check, Palette as PaletteIcon, RotateCcw, Save } from "lucide-react";
import { Button, ColorField, Modal, Row, Slider } from "./components";
import { presets, type Config, type Palette } from "./model";
export function Themes({
  config,
  update,
}: {
  config: Config;
  update: (c: Config) => void;
}) {
  const [naming, name] = useState(false),
    [title, setTitle] = useState("");
  const theme = config.theme;
  function apply(t: Palette) {
    update({ ...config, theme: t });
  }
  function tweak(p: Partial<Palette>) {
    apply({ ...theme, ...p, name: "Custom" });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Themes</h1>
          <p>Color and contrast across your workspace.</p>
        </div>
        <Button onClick={() => apply({ ...presets[0] })}>
          <RotateCcw />
          Reset palette
        </Button>
      </div>
      <div className="theme-layout">
        <div>
          <h2 className="group-title">Preset library</h2>
          <div className="swatches">
            {[...presets, ...config.presets].map((p, i) => (
              <button
                key={i}
                className={"swatch " + (theme.name === p.name ? "chosen" : "")}
                aria-pressed={theme.name === p.name}
                onClick={() => apply(p)}
              >
                <div
                  className="swatch-art"
                  style={{
                    background: `linear-gradient(${p.angle}deg,${p.start},${p.end})`,
                    color: p.accent,
                  }}
                >
                  <Wave />
                </div>
                <span>
                  {p.name}
                  {theme.name === p.name && <Check size={14} />}
                </span>
              </button>
            ))}
          </div>
        </div>
        <section className="panel palette">
          <header>
            <div className="section-name">
              <PaletteIcon />
              Palette editor
            </div>
          </header>
          <div
            className="preview-art"
            style={{
              background: `linear-gradient(${theme.angle}deg,${theme.start},${theme.end})`,
              color: theme.accent,
            }}
          >
            <Wave />
            <strong>{theme.name}</strong>
          </div>
          {(
            [
              ["accent", "Primary accent"],
              ["secondary", "Secondary accent"],
              ["start", "Gradient start"],
              ["end", "Gradient end"],
            ] as const
          ).map(([key, text]) => (
            <Row key={key} name={text}>
              <ColorField
                label={text}
                color={theme[key]}
                change={(v) => tweak({ [key]: v })}
              />
            </Row>
          ))}
          <Row name="Direction">
            <Slider
              label="Gradient direction"
              value={theme.angle}
              min={0}
              max={360}
              unit="°"
              change={(angle) => tweak({ angle })}
            />
          </Row>
          <div className="palette-actions">
            <Button
              onClick={() => {
                setTitle("");
                name(true);
              }}
            >
              <Save />
              Save as preset
            </Button>
          </div>
        </section>
      </div>
      {naming && (
        <Modal title="Save theme preset" close={() => name(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = title.trim();
              if (!n || presets.some((p) => p.name === n)) return;
              const t = { ...theme, name: n };
              update({
                ...config,
                theme: t,
                presets: [...config.presets.filter((p) => p.name !== n), t],
              });
              name(false);
            }}
          >
            <label>
              Preset name
              <input
                required
                maxLength={100}
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <Button
              className="primary"
              disabled={
                !title.trim() ||
                presets.some((p) => p.name === title.trim()) ||
                config.presets.length >= 50
              }
            >
              Save preset
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Wave() {
  return (
    <svg viewBox="0 0 200 65" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: 17 }, (_, i) => (
        <path
          key={i}
          d={`M -15 ${50 + i * 2} C 38 ${-20 + i}, 58 ${100 - i}, 105 ${38 + i * 0.7} S 167 ${-4 + i}, 212 ${12 + i * 2}`}
          stroke="currentColor"
          fill="none"
          opacity={0.22 + i * 0.014}
          strokeWidth=".8"
        />
      ))}
    </svg>
  );
}
