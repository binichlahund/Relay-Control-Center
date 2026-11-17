use nvml_wrapper::{enum_wrappers::device::TemperatureSensor, Nvml};
use serde_json::{json, Value};
use std::{
    collections::VecDeque,
    os::windows::process::CommandExt,
    process::Command,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use sysinfo::{Disks, Networks, ProcessesToUpdate, System};

pub struct Monitor {
    snapshot: Arc<Mutex<Value>>,
    interval: Arc<AtomicU64>,
}

impl Monitor {
    pub fn start() -> Self {
        let snapshot = Arc::new(Mutex::new(Value::Null));
        let interval = Arc::new(AtomicU64::new(1000));
        let state = Self {
            snapshot: snapshot.clone(),
            interval: interval.clone(),
        };
        let temp = Arc::new(Mutex::new(None::<f64>));
        let cpu_temp = temp.clone();
        thread::spawn(move || loop {
            let script = r#"foreach ($p in 'LibreHardwareMonitor','OpenHardwareMonitor') {
                $cpu=Get-CimInstance -Namespace "root\$p" -Class Sensor -Filter "SensorType='Temperature'" -OperationTimeoutSec 3 -ErrorAction SilentlyContinue | Where-Object {$_.Identifier -match 'cpu' -and $null -ne $_.Value}
                $pkg=$cpu | Where-Object {$_.Name -match 'Package|Tctl|Tdie'} | Select-Object -First 1
                if (!$pkg) {$pkg=$cpu | Sort-Object Value -Descending | Select-Object -First 1}
                if ($pkg) {[Console]::WriteLine($pkg.Value.ToString([cultureinfo]::InvariantCulture));break}
            }"#;
            let result = Command::new("powershell.exe")
                .args(["-NoProfile", "-NonInteractive", "-Command", script])
                .creation_flags(0x08000000)
                .output()
                .ok()
                .and_then(|r| {
                    String::from_utf8_lossy(&r.stdout)
                        .trim()
                        .parse::<f64>()
                        .ok()
                });
            *cpu_temp.lock().unwrap() = result;
            thread::sleep(Duration::from_secs(if result.is_some() { 10 } else { 90 }));
        });
        thread::spawn(move || {
            let mut sys = System::new_all();
            let mut net = Networks::new_with_refreshed_list();
            let mut disks = Disks::new_with_refreshed_list();
            let gpu = Nvml::init().ok();
            let system_drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into());
            let mut history = VecDeque::new();
            let mut prev = Instant::now();
            let os = System::long_os_version().unwrap_or_else(|| "Windows".into());
            let host = System::host_name().unwrap_or_else(|| "Local workstation".into());
            loop {
                thread::sleep(Duration::from_millis(interval.load(Ordering::Relaxed)));
                let elapsed = prev.elapsed().as_secs_f64().max(0.01);
                prev = Instant::now();
                sys.refresh_cpu_usage();
                sys.refresh_memory();
                sys.refresh_processes(ProcessesToUpdate::All, true);
                net.refresh(true);
                disks.refresh(true);
                let (mut down, mut up) = (0u64, 0u64);
                for (_, adapter) in &net {
                    down += adapter.received();
                    up += adapter.transmitted();
                }
                let cores = sys.cpus().len().max(1);
                let mut procs:Vec<Value>=sys.processes().iter().filter(|(pid,_)|pid.as_u32()!=0).map(|(pid,p)|json!({
                    "pid":pid.as_u32(),"name":p.name().to_string_lossy(),"cpu":(p.cpu_usage()/cores as f32).clamp(0.,100.),"memory":p.memory()
                })).collect();
                procs.sort_by_key(|p| std::cmp::Reverse(p["memory"].as_u64()));
                let device = gpu.as_ref().and_then(|n| n.device_by_index(0).ok());
                let gpu_usage = device
                    .as_ref()
                    .and_then(|d| d.utilization_rates().ok())
                    .map(|u| u.gpu);
                let disk = disks.iter().find(|d| {
                    d.mount_point()
                        .to_string_lossy()
                        .to_uppercase()
                        .starts_with(&system_drive.to_uppercase())
                });
                let stamp = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs_f64();
                let sample = json!({"time":stamp,"cpu":sys.global_cpu_usage(),"gpu":gpu_usage,"ram":100.0*sys.used_memory() as f64/sys.total_memory().max(1) as f64,"down":down as f64/elapsed,"up":up as f64/elapsed});
                history.push_back(sample.clone());
                while history
                    .front()
                    .is_some_and(|s| stamp - s["time"].as_f64().unwrap_or(stamp) > 120.)
                {
                    history.pop_front();
                }
                let next = json!({"current":sample,"history":history,"cpuName":sys.cpus().first().map(|c|c.brand()),"cores":cores,
                    "gpuName":device.as_ref().and_then(|d|d.name().ok()),"gpuTemp":device.as_ref().and_then(|d|d.temperature(TemperatureSensor::Gpu).ok()),
                    "cpuTemp":*temp.lock().unwrap(),"used":sys.used_memory(),"total":sys.total_memory(),
                    "diskTotal":disk.map(|d|d.total_space()),"diskUsed":disk.map(|d|d.total_space()-d.available_space()),
                    "uptime":System::uptime(),"host":host,"os":os,"processes":procs});
                *snapshot.lock().unwrap() = next;
            }
        });
        state
    }
}
#[tauri::command]
pub fn telemetry(state: tauri::State<Monitor>) -> Value {
    state.snapshot.lock().unwrap().clone()
}
#[tauri::command]
pub fn set_interval(state: tauri::State<Monitor>, ms: u64) -> Result<(), String> {
    if ![1000, 2000, 5000].contains(&ms) {
        return Err("Unsupported sampling interval".into());
    }
    state.interval.store(ms, Ordering::Relaxed);
    Ok(())
}
