import os
import platform
import time
from pathlib import Path

import psutil
from PySide6.QtCore import QThread, Signal
from utils.temperature import WindowsCpuTemperature


class GpuSensor:
    def __init__(self):
        self.api = self.device = None
        self.name = "No supported sensor"
        try:
            import pynvml as nv
        except (ImportError, OSError):
            return
        try:
            nv.nvmlInit()
            self.api = nv
            self.device = nv.nvmlDeviceGetHandleByIndex(0)
            self.name = nv.nvmlDeviceGetName(self.device)
        except (nv.NVMLError, OSError):
            pass

    def read(self, function):
        if self.device is not None:
            try:
                return function(self.api, self.device)
            except self.api.NVMLError:
                pass
        return None

    def close(self):
        if self.api:
            self.api.nvmlShutdown()


def cpu_temperature():
    read = getattr(psutil, "sensors_temperatures", None)
    if read:
        for key, sensors in read().items():
            if key.lower() in {"coretemp", "k10temp", "cpu_thermal", "zenpower"} and sensors:
                return max(s.current for s in sensors)
    return None


class Monitor(QThread):
    sample = Signal(dict)
    failed = Signal(str)

    def run(self):
        gpu = GpuSensor()
        windows_cpu = WindowsCpuTemperature()
        previous_net = None
        previous_cpu = {}
        cores = psutil.cpu_count() or 1
        previous_time = time.monotonic()
        psutil.cpu_percent()
        try:
            while not self.isInterruptionRequested():
                try:
                    now = time.monotonic()
                    elapsed = max(.001, now - previous_time)
                    net = psutil.net_io_counters()
                    down = up = None
                    if previous_net and net:
                        down = max(0, net.bytes_recv - previous_net.bytes_recv) / elapsed
                        up = max(0, net.bytes_sent - previous_net.bytes_sent) / elapsed
                    current_cpu, rows = {}, []
                    for proc in psutil.process_iter(["pid", "name", "cpu_times", "memory_info", "create_time"]):
                        i = proc.info
                        if not i["memory_info"] or i["pid"] == 0:
                            continue
                        key = (i["pid"], i["create_time"])
                        usage = None
                        if i["cpu_times"]:
                            total = i["cpu_times"].user + i["cpu_times"].system
                            current_cpu[key] = total
                            if key in previous_cpu:
                                usage = min(100, max(0, total-previous_cpu[key]) / elapsed / cores * 100)
                        rows.append((i["name"] or str(i["pid"]), i["pid"], usage, i["memory_info"].rss))
                    mem = psutil.virtual_memory()
                    disk = psutil.disk_usage(Path.home().anchor or "/")
                    self.sample.emit(dict(cpu=psutil.cpu_percent() if previous_cpu else None,
                        ram=mem.percent, memory=(mem.used, mem.total), disk=disk.percent,
                        storage=(disk.used, disk.total), gpu=gpu.read(lambda a,d: a.nvmlDeviceGetUtilizationRates(d).gpu),
                        gpu_temp=gpu.read(lambda a,d: a.nvmlDeviceGetTemperature(d, a.NVML_TEMPERATURE_GPU)),
                        gpu_name=gpu.name, cpu_temp=windows_cpu.read() if os.name == "nt" else cpu_temperature(),
                        down=down, up=up,
                        processes=sorted(rows, key=lambda r: r[3], reverse=True),
                        uptime=int(time.time()-psutil.boot_time()), cores=cores,
                        host=platform.node() or os.getenv("COMPUTERNAME", "Local machine")))
                    previous_time, previous_net, previous_cpu = now, net, current_cpu
                except (psutil.Error, OSError) as exc:
                    self.failed.emit(str(exc))
                for _ in range(10):
                    if self.isInterruptionRequested():
                        break
                    self.msleep(100)
        finally:
            windows_cpu.close()
            gpu.close()

