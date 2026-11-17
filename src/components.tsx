import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { Search, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
export function Button({
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={"btn " + (rest.className ?? "")}>
      {children}
    </button>
  );
}
export function IconButton({
  title,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { title: string }) {
  return (
    <button
      {...rest}
      className={"icon-btn " + (rest.className ?? "")}
      aria-label={title}
      title={title}
    >
      {children}
    </button>
  );
}
export function SearchBox({
  value,
  change,
  placeholder,
  focus = false,
}: {
  value: string;
  change: (v: string) => void;
  placeholder: string;
  focus?: boolean;
}) {
  return (
    <label className="search">
      <Search size={14} />
      <input
        aria-label={placeholder}
        autoFocus={focus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => change(e.target.value)}
      />
      {value && (
        <IconButton title="Clear search" onClick={() => change("")}>
          <X size={12} />
        </IconButton>
      )}
    </label>
  );
}
export function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="dialog-inner"
      >
        <header>
          <h2 id={id}>{title}</h2>
          <IconButton title="Close dialog" onClick={close}>
            <X size={16} />
          </IconButton>
        </header>
        {children}
      </motion.div>
    </dialog>
  );
}
export function Row({
  name,
  detail,
  children,
}: {
  name: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <strong>{name}</strong>
        {detail && <small>{detail}</small>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  );
}
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  change,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  change: (n: number) => void;
}) {
  return (
    <>
      <input
        className="range"
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => change(+e.target.value)}
        style={{
          background: `linear-gradient(to right,var(--accent) ${((value - min) / (max - min)) * 100}%,var(--edge) 0)`,
        }}
      />
      <output>
        {value}
        {unit}
      </output>
    </>
  );
}
export function Toggle({
  label,
  value,
  change,
}: {
  label: string;
  value: boolean;
  change: (b: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={value}
      className={"switch " + (value ? "on" : "")}
      onClick={() => change(!value)}
    >
      <i />
    </button>
  );
}
export function Select({
  label,
  value,
  options,
  change,
}: {
  label: string;
  value: string;
  options: [string, string][];
  change: (v: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => change(e.target.value)}
    >
      {options.map(([v, n]) => (
        <option key={v} value={v}>
          {n}
        </option>
      ))}
    </select>
  );
}
export function ColorField({
  label,
  color,
  change,
}: {
  label: string;
  color: string;
  change: (v: string) => void;
}) {
  return (
    <label className="color-field">
      <input
        type="color"
        aria-label={label}
        value={color}
        onChange={(e) => change(e.target.value)}
      />
      {color.toUpperCase()}
    </label>
  );
}
export function Mark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M3 23 13 6h9L12 23H3Zm11 3L24 9h6L20 26h-6Z"
        fill="currentColor"
      />
    </svg>
  );
}
export function Fade({
  children,
  page,
}: {
  children: ReactNode;
  page: string;
}) {
  const reduced =
    useReducedMotion() || document.documentElement.dataset.motion === "off";
  return (
    <motion.div
      key={page}
      className="page"
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduced
          ? 0
          : 0.18 * Number(document.documentElement.dataset.duration || 1),
      }}
    >
      {children}
    </motion.div>
  );
}
