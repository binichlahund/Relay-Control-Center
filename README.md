# Relay Control Center 2

Double-click **Relay Control Center.exe** in this folder. **Launch** opens the dashboard. **Install/Repair** restores the native app and verifies its files. The launcher is portable and contains the complete app. If Windows lacks WebView2, repair downloads Microsoft's signed Evergreen runtime installer. No Python or Node installation is needed to run the release.

To open the dashboard directly, run **desktop/Relay.exe** with **WebView2Loader.dll** next to it. The standalone launcher also appears in the parent project folder. This release targets Windows x64.

## Workspace

- **Computer stats** shows CPU, GPU, memory, system-drive capacity, network throughput, temperatures and per-process usage. The main graph offers 30-, 60- and 120-second windows. Pause freezes the display while sampling continues. Filter the process table by name or PID and click a column header to sort.
- **Shortcuts** opens applications, Windows shortcuts and supported links. Add an app through the file picker or enter its destination. The ellipsis on each tile opens the editor for renaming, moving, removing and choosing an icon. Built-in apps have brand marks. Local executables use their shell icon. Custom PNG icons travel with exported settings.
- **Quick launcher** opens from the sidebar or Ctrl+K. Search, use the arrow keys and press Enter to launch. Escape dismisses it. Enable a system-wide shortcut in Settings to open this window from another application while Relay is running.
- **Themes** applies palette changes immediately. Adjust primary and secondary accents, gradient colors and angle, then save a named preset.
- **Settings** has searchable appearance, behavior, sampling and data controls. Changes save automatically. Use Data to export, import, or restore defaults.

## Persistence and sensor support

On first run, Relay reads the earlier Qt configuration from the Relay/Control Center folder in local or roaming application data. Version-one exports can also be imported manually. Version-two settings use a separate, atomically replaced JSON file under the Tauri app's local data directory, normally `%LOCALAPPDATA%\com.relay.controlcenter\settings-v2.json`. Invalid imports leave the active configuration intact. For an isolated profile, set `RELAY_PROFILE_DIR` before starting Relay.

CPU and process percentages are normalized to total machine capacity. Network readings aggregate the interfaces visible to Windows. The history starts with actual samples and grows during the session. NVIDIA GPU usage and temperature require NVML support in the installed driver. CPU temperature uses the WMI sensor provider of a running LibreHardwareMonitor or OpenHardwareMonitor instance. Unsupported readings display **Unavailable**.

## Development

Install a current Node LTS release with npm, stable Rust and the Tauri Windows build prerequisites. Install the JavaScript packages from this directory and start the native development host.

```powershell
npm ci
npm run tauri -- dev
```

To preview the UI without native hardware, run `npm run dev` and open `http://localhost:1420/?demo=1`. This explicitly labeled sample mode is available only in development. Native operations such as file picking, app launching and hotkeys require the Tauri host.

```powershell
npm run build
npm run tauri -- build --no-bundle
python launcher/build.py
```

The final step uses x64 Windows Python and the .NET Framework C# compiler to package the three-button recovery launcher. It also places the direct-launch files in `desktop/`. The Rust dependencies and frontend packages are locked. For a standard NSIS installer, use `npm run tauri -- build`.

| Location | Responsibility |
| --- | --- |
| src/main.tsx, src/components.tsx, src/style.css | Shell, navigation, shared controls, typography, tokens and motion |
| src/Stats.tsx, src/Shortcuts.tsx, src/Themes.tsx, src/Settings.tsx | Four workspace pages and compact launcher |
| src/model.ts | Schema validation, palettes, defaults and migration |
| src-tauri/src/monitor.rs | Background telemetry sampling and bounded history |
| src-tauri/src/shortcuts.rs | Native app icons, launch by saved ID, dialogs, hotkeys and overlay |
| src-tauri/src/storage.rs | Config migration paths, bounded reads, atomic saves and native import/export |
| launcher/ | Standalone recovery launcher and release packaging |
| main.py, ui/, tabs/, utils/, themes/ | Previous Python implementation retained for reference |

The Tauri host performs monitoring directly. The frontend has no generic shell command or arbitrary-path file-write interface.

[Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/) · [Tauri global shortcuts](https://v2.tauri.app/plugin/global-shortcut/)

