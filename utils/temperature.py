import os
import subprocess
import time


class WindowsCpuTemperature:
    """Poll an installed hardware-monitor WMI provider without blocking sampling."""
    QUERY = r"""
    foreach ($provider in 'LibreHardwareMonitor', 'OpenHardwareMonitor') {
        $sensors = Get-CimInstance -Namespace "root\$provider" -ClassName Sensor -Filter "SensorType = 'Temperature'" -ErrorAction SilentlyContinue
        $cpu = $sensors | Where-Object { $_.Identifier -match 'cpu' -and $null -ne $_.Value }
        $package = $cpu | Where-Object { $_.Name -match 'Package|Tctl|Tdie' } | Select-Object -First 1
        if (!$package) { $package = $cpu | Sort-Object Value -Descending | Select-Object -First 1 }
        if ($package) { [Console]::WriteLine($package.Value.ToString([cultureinfo]::InvariantCulture)); break }
    }
    """

    def __init__(self):
        self.process = None
        self.next_probe = self.started = 0
        self.value = None

    def read(self):
        if os.name != "nt":
            return None
        now = time.monotonic()
        if self.process:
            if self.process.poll() is not None:
                out, _ = self.process.communicate()
                self.process = None
                try:
                    self.value = float(out.strip())
                except ValueError:
                    self.value = None
                self.next_probe = now + (8 if self.value is not None else 90)
            elif now-self.started > 6:
                self.close()
                self.value = None
                self.next_probe = now+90
        elif now >= self.next_probe:
            try:
                self.process = subprocess.Popen(
                    ["powershell.exe","-NoProfile","-NonInteractive","-Command",self.QUERY],
                    stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
                self.started = now
            except OSError:
                self.value = None
                self.next_probe = now+90
        return self.value

    def close(self):
        if self.process:
            self.process.kill()
            self.process.communicate()
            self.process = None

