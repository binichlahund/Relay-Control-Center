import platform

from PySide6.QtCore import Qt, QTimer, QDateTime
from PySide6.QtWidgets import (QApplication,QMainWindow,QWidget,QVBoxLayout,QHBoxLayout,
                               QStackedWidget,QScrollArea,QMessageBox,QFrame)
from tabs.stats import StatsTab
from tabs.shortcuts import ShortcutsTab
from tabs.themes import ThemesTab
from tabs.settings import SettingsTab
from themes.manager import ThemeManager
from ui.icons import icon
from ui.widgets import NavButton, glyph, label, px, row
from utils.monitor import Monitor


# Add a page here to register its navigation entry and widget factory.
PAGES = [
    ("Computer stats","stats",lambda c,save: StatsTab(c["colors"])),
    ("Shortcuts","shortcuts",ShortcutsTab),
    ("Themes","themes",ThemesTab),
    ("Settings","settings",SettingsTab),
]


class Window(QMainWindow):
    def __init__(self, manager):
        super().__init__()
        self.manager = manager
        self.theme = ThemeManager()
        self.latest = None
        self.active = 0
        self.setWindowTitle("Relay · Control Center")
        self.resize(1190,850)
        self.build()
        self.clock = QTimer(self)
        self.clock.timeout.connect(self.tick)
        self.clock.start(1000)
        self.worker = Monitor(self)
        self.worker.sample.connect(self.receive)
        self.worker.failed.connect(self.report_sensor_error)
        self.worker.start()
        if manager.warning:
            QTimer.singleShot(0,lambda: QMessageBox.warning(self,"Configuration",manager.warning))

    def build(self):
        c = self.manager.data
        QApplication.instance().setProperty("scale",c["scale"])
        self.theme.apply(QApplication.instance(),c)
        self.setMinimumSize(px(895),px(580))
        self.setWindowOpacity(c["opacity"]/100)
        accent = c["colors"][0]
        self.setWindowIcon(icon("logo",accent,32))
        root = QWidget()
        outer = QHBoxLayout(root)
        outer.setContentsMargins(0,0,0,0)
        outer.setSpacing(0)
        rail = QWidget(objectName="rail")
        rail.setFixedWidth(px(202))
        side = QVBoxLayout(rail)
        side.setContentsMargins(px(16),px(24),px(16),px(20))
        side.setSpacing(px(6))
        brand = QVBoxLayout()
        brand.setSpacing(0)
        brand.addWidget(label("Relay",8,True))
        brand.addWidget(label("CONTROL CENTER",-2,True,"muted",True))
        logorow = row(glyph("logo",accent,35))
        logorow.addLayout(brand)
        logorow.addStretch()
        side.addLayout(logorow)
        side.addSpacing(px(38))
        side.addWidget(label("WORKSPACE",-2,True,"muted",True))
        side.addSpacing(px(5))
        self.nav = []
        self.stack = QStackedWidget()
        self.pages = []
        for i,(name,key,factory) in enumerate(PAGES):
            b = NavButton(name,key,c["colors"])
            b.clicked.connect(lambda _,index=i: self.navigate(index))
            side.addWidget(b)
            self.nav.append(b)
            scroll = QScrollArea()
            scroll.setWidgetResizable(True)
            scroll.setFrameShape(QFrame.Shape.NoFrame)
            page = factory(c,self.commit)
            scroll.setWidget(page)
            self.pages.append(page)
            self.stack.addWidget(scroll)
        side.addStretch()
        line = QFrame()
        line.setFixedHeight(1)
        line.setStyleSheet("background:#35323d")
        side.addWidget(line)
        side.addSpacing(px(9))
        device = QVBoxLayout()
        device.addWidget(label("Local workstation",0,True))
        device.addWidget(label(platform.system()+" "+platform.release(),-1,role="muted"))
        bottom = row(glyph("pc",accent))
        bottom.addLayout(device)
        bottom.addStretch()
        side.addLayout(bottom)
        outer.addWidget(rail)
        body = QVBoxLayout()
        body.setContentsMargins(px(26),px(18),px(26),px(15))
        body.setSpacing(px(16))
        self.crumb = label("",-1,True)
        self.time = label("",-1,role="muted",mono=True)
        self.status = label("●  Connecting",-1,True)
        header = row(label("Workspace   /",-1,role="muted"),self.crumb,None,self.status,self.time)
        header.setSpacing(px(12))
        body.addLayout(header)
        body.addWidget(self.stack)
        outer.addLayout(body,1)
        self.setCentralWidget(root)
        self.navigate(self.active)
        self.tick()
        if self.latest:
            self.receive(self.latest)

    def navigate(self,index):
        self.active = index
        self.stack.setCurrentIndex(index)
        self.crumb.setText(PAGES[index][0])
        for i,b in enumerate(self.nav):
            b.setChecked(i == index)

    def tick(self):
        self.time.setText(QDateTime.currentDateTime().toString("ddd, MMM d   HH:mm"))

    def report_sensor_error(self,message):
        self.status.setText("●  Retrying")
        self.status.setStyleSheet("color:#ecae78")
        self.status.setToolTip(message)

    def receive(self,s):
        self.latest = s
        self.pages[0].update_sample(s)
        self.status.setText("●  Live")
        self.status.setStyleSheet("color:#78dcb7")
        self.status.setToolTip("Local telemetry · sampled every second")

    def commit(self,data):
        try:
            self.manager.save(data)
        except (OSError,ValueError) as e:
            QMessageBox.warning(self,"Could not save configuration",str(e))
            return
        self.build()

    def closeEvent(self,event):
        self.worker.requestInterruption()
        self.worker.wait()
        super().closeEvent(event)

