import os
import shutil
from pathlib import Path
from urllib.parse import urlparse

from PySide6.QtCore import Qt, QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (QWidget,QVBoxLayout,QGridLayout,QLineEdit,QPushButton,
                               QFileDialog,QMessageBox,QFileIconProvider)
from PySide6.QtCore import QFileInfo
from ui.widgets import card, glyph, label, px, row


def executable(target):
    candidate = Path(os.path.expandvars(target))
    if candidate.is_file():
        return candidate.resolve()
    if candidate.name == target:
        found = shutil.which(target)
        if found:
            return Path(found)
    if candidate.name.lower() == "brave.exe":
        for var in ("LOCALAPPDATA", "ProgramFiles(x86)"):
            if os.getenv(var):
                alt = Path(os.environ[var]) / "BraveSoftware/Brave-Browser/Application/brave.exe"
                if alt.is_file():
                    return alt
    return None


class ShortcutsTab(QWidget):
    def __init__(self, config, commit):
        super().__init__()
        self.config, self.commit = config, commit
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0,0,0,0)
        layout.setSpacing(px(16))
        layout.addWidget(label("App shortcuts",14,True))
        self.search = QLineEdit(placeholderText="Search apps…")
        add = QPushButton("+  Add app")
        add.clicked.connect(self.add_app)
        layout.addLayout(row(self.search,add))
        self.grid = QGridLayout()
        self.grid.setSpacing(px(14))
        layout.addLayout(self.grid)
        self.empty = label("No matching apps.", role="muted")
        layout.addWidget(self.empty)
        layout.addStretch()
        self.cards = []
        for entry in config["shortcuts"]:
            box, v = card()
            mark = glyph(entry["icon"],entry["color"],30)
            path = executable(entry["target"])
            if path:
                mark.setPixmap(QFileIconProvider().icon(QFileInfo(str(path))).pixmap(px(30),px(30)))
            go = QPushButton("Launch  ↗")
            go.setAccessibleName("Launch "+entry["name"])
            go.clicked.connect(lambda _, e=entry: self.launch(e))
            v.addLayout(row(mark,None,go))
            v.addWidget(label(entry["name"],4,True))
            v.addWidget(label(entry["category"],-1,role="muted"))
            self.cards.append((entry,box))
        self.search.textChanged.connect(self.filter)
        self.filter("")

    def filter(self, text):
        index = 0
        for e,box in self.cards:
            self.grid.removeWidget(box)
            show = text.casefold() in (e["name"]+" "+e["category"]).casefold()
            box.setVisible(show)
            if show:
                self.grid.addWidget(box,index//2,index%2)
                index += 1
        self.empty.setVisible(index == 0)
        for col in (0,1):
            self.grid.setColumnStretch(col,1)

    def launch(self,e):
        target = e["target"]
        path = executable(target)
        try:
            if path and path.suffix.lower() in (".exe",".lnk"):
                os.startfile(str(path))
            elif urlparse(target).scheme in ("https","http","steam","discord","battlenet"):
                if not QDesktopServices.openUrl(QUrl(target)):
                    raise OSError("No handler was found for this link.")
            else:
                raise OSError("The application was not found at its configured location.")
        except OSError as exc:
            QMessageBox.information(self,"Shortcut unavailable",f'{e["name"]}\n{exc}\n\nUse Add app to choose an installed executable.')

    def add_app(self):
        path,_ = QFileDialog.getOpenFileName(self,"Choose an application","","Applications (*.exe *.lnk)")
        if path:
            entry = dict(name=Path(path).stem,category="Application",target=path,icon="shortcuts",color=self.config["colors"][0])
            self.commit({**self.config,"shortcuts":[*self.config["shortcuts"],entry]})

