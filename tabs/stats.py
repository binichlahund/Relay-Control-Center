from PySide6.QtCore import Qt
from PySide6.QtWidgets import (QWidget,QVBoxLayout,QHBoxLayout,QGridLayout,QTableWidget,
                               QTableWidgetItem,QHeaderView,QAbstractItemView,QPushButton)
from ui.widgets import Banner, Chart, card, glyph, label, px, row


def speed(n):
    if n is None:
        return "—"
    for unit in ("B/s","KB/s","MB/s","GB/s"):
        if n < 1024 or unit == "GB/s":
            return f"{n:.1f} {unit}" if unit != "B/s" else f"{n:.0f} {unit}"
        n /= 1024


def capacity(pair):
    return f"{pair[0]/2**30:.1f} / {pair[1]/2**30:.1f} GiB"


class StatsTab(QWidget):
    def __init__(self, colors):
        super().__init__()
        self.setObjectName("page")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0,0,0,0)
        layout.setSpacing(px(15))
        self.banner = Banner(colors)
        layout.addWidget(self.banner)
        layout.addLayout(row(label("Resource monitor",3,True), None, label("60-second history", -1,role="muted")))
        grid = QGridLayout()
        grid.setSpacing(px(11))
        layout.addLayout(grid)
        self.metrics = {}
        for i,(key,name,tint) in enumerate([("cpu","CPU",colors[0]),("gpu","GPU","#7baaff"),
                ("ram","Memory","#63d6bd"),("disk","Storage","#ecae78")]):
            box, v = card()
            v.addLayout(row(glyph(key,tint,18),label(name,0,True),None))
            value = label("—",12,True)
            detail = label("Waiting for sensor", -1, role="muted")
            chart = Chart([tint],26)
            v.addWidget(value)
            v.addWidget(detail)
            v.addWidget(chart)
            grid.addWidget(box,0,i)
            grid.setColumnStretch(i,1)
            self.metrics[key] = value, detail, chart
        box,v = card()
        layout.addWidget(box)
        self.down = label("↓  —",0,True)
        self.up = label("↑  —",0,True)
        self.down.setStyleSheet(f"color:{colors[0]}")
        self.up.setStyleSheet("color:#65d9c0")
        v.addLayout(row(glyph("network",colors[0]),label("Network activity",2,True),None,self.down,self.up))
        self.net = Chart([colors[0],"#65d9c0"],65,True)
        self.net.setToolTip("Download and upload traffic across network interfaces")
        v.addWidget(self.net)
        v.addLayout(row(label("60s ago",-2,role="muted",mono=True),None,label("Now",-2,role="muted",mono=True)))
        box,v = card()
        layout.addWidget(box)
        self.count = label("",-1,role="muted")
        self.collapse = QPushButton("Hide")
        self.collapse.clicked.connect(self.toggle)
        v.addLayout(row(glyph("process",colors[0]),label("Running processes",2,True),self.count,None,self.collapse))
        self.table = QTableWidget(0,4)
        self.table.setHorizontalHeaderLabels(["Process","PID","CPU","Memory ↓"])
        self.table.verticalHeader().hide()
        self.table.verticalHeader().setDefaultSectionSize(px(29))
        self.table.horizontalHeader().setDefaultAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
        self.table.horizontalHeader().setSectionResizeMode(0,QHeaderView.ResizeMode.Stretch)
        for col in (1,2,3):
            self.table.setColumnWidth(col,px(90))
        self.table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setShowGrid(False)
        self.table.setFixedHeight(px(166))
        v.addWidget(self.table)
        layout.addStretch()

    def toggle(self):
        hidden = not self.table.isHidden()
        self.table.setHidden(hidden)
        self.collapse.setText("Show" if hidden else "Hide")

    def update_sample(self, s):
        hrs = s["uptime"]//3600
        self.banner.details.setText(f'{s["host"]}   ·   {s["cores"]} logical cores   ·   Uptime {hrs//24}d {hrs%24}h')
        for key,(value, detail, chart) in self.metrics.items():
            val = s[key]
            value.setText(f"{val:.0f}%" if val is not None else "—")
            if key in ("ram","disk"):
                detail.setText(capacity(s["memory" if key=="ram" else "storage"]))
            else:
                temp = s[key+"_temp"]
                detail.setText(f"{temp:.0f} °C" if temp is not None else "Temp unavailable")
                if key == "gpu":
                    value.setToolTip(str(s["gpu_name"]))
            chart.add(val)
        self.down.setText("↓  "+speed(s["down"]))
        self.up.setText("↑  "+speed(s["up"]))
        self.net.add(s["down"],s["up"])
        rows = s["processes"]
        self.count.setText(str(len(rows)))
        if self.table.isHidden():
            return
        self.table.setRowCount(len(rows))
        for i,(name,pid,cpu,mem) in enumerate(rows):
            for j,txt in enumerate((name,str(pid),f"{cpu:.1f}%" if cpu is not None else "—",f"{mem/2**20:.0f} MiB")):
                item = self.table.item(i,j)
                if item is None:
                    self.table.setItem(i,j,QTableWidgetItem(txt))
                elif item.text() != txt:
                    item.setText(txt)

