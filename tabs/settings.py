from PySide6.QtCore import Qt
from PySide6.QtWidgets import (QWidget,QVBoxLayout,QSlider,QPushButton,QFileDialog,QMessageBox)
from utils.config import ConfigManager, defaults, write_json
from ui.widgets import card, label, px, row


class SettingsTab(QWidget):
    def __init__(self, config, commit):
        super().__init__()
        self.config,self.commit = config,commit
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0,0,0,0)
        lay.setSpacing(px(15))
        lay.addWidget(label("Settings",14,True))
        box,v = card()
        lay.addWidget(box)
        v.addWidget(label("Interface",4,True))
        self.sliders = {}
        for key,title,lo,hi,unit in [("font","Font size",9,14," pt"),("scale","Interface scale",85,125,"%"),("opacity","Window opacity",75,100,"%")]:
            value = label(str(config[key])+unit,role="accent",mono=True)
            s = QSlider(Qt.Orientation.Horizontal)
            s.setAccessibleName(title)
            s.setRange(lo,hi)
            s.setValue(config[key])
            s.valueChanged.connect(lambda n, w=value, u=unit: w.setText(str(n)+u))
            v.addLayout(row(label(title),None,value))
            v.addWidget(s)
            self.sliders[key]=s
        apply = QPushButton("Apply settings")
        apply.setObjectName("apply")
        apply.clicked.connect(lambda: commit({**config,**{k:s.value() for k,s in self.sliders.items()}}))
        v.addLayout(row(None,apply))
        box,v = card()
        lay.addWidget(box)
        v.addWidget(label("Configuration",4,True))
        v.addWidget(label("Back up or restore your appearance settings and app shortcuts.", role="muted"))
        buttons = []
        for name,action in [("Export JSON",self.export),("Import JSON",self.restore),("Reset defaults",self.reset)]:
            b = QPushButton(name)
            b.clicked.connect(action)
            buttons.append(b)
        v.addLayout(row(*buttons,None))
        lay.addStretch()

    def export(self):
        path,_ = QFileDialog.getSaveFileName(self,"Export configuration","relay-settings.json","JSON (*.json)")
        if path:
            try:
                write_json(path,self.config)
            except OSError as e:
                QMessageBox.warning(self,"Export failed",str(e))

    def restore(self):
        path,_ = QFileDialog.getOpenFileName(self,"Import configuration","","JSON (*.json)")
        if path:
            try:
                self.commit(ConfigManager.read(path))
            except (OSError,ValueError,TypeError) as e:
                QMessageBox.warning(self,"Import failed",str(e))

    def reset(self):
        if QMessageBox.question(self,"Reset settings","Restore the default theme, interface settings and shortcuts?") == QMessageBox.StandardButton.Yes:
            self.commit(defaults())

