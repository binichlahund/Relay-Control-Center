from PySide6.QtGui import QColor
from PySide6.QtWidgets import QWidget,QVBoxLayout,QGridLayout,QPushButton,QColorDialog
from themes.manager import PRESETS
from ui.widgets import Banner, card, label, row, px


class ThemesTab(QWidget):
    def __init__(self, config, commit):
        super().__init__()
        self.config,self.commit = config,commit
        self.name,self.colors = config["theme"],list(config["colors"])
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0,0,0,0)
        lay.setSpacing(px(13))
        lay.addWidget(label("Themes",14,True))
        self.preview = Banner(self.colors)
        self.preview.details.setText("Theme preview")
        lay.addWidget(self.preview)
        lay.addWidget(label("Built-in themes",3,True))
        grid = QGridLayout()
        self.options = {}
        for i,(name,colors) in enumerate(PRESETS.items()):
            button = QPushButton(name)
            button.setMinimumHeight(px(48))
            button.setCheckable(True)
            button.setStyleSheet(f"QPushButton {{background:qlineargradient(x1:0,y1:0,x2:1,y2:1,stop:0 {colors[1]},stop:1 {colors[2]});border:1px solid {colors[1]};}} QPushButton:checked,QPushButton:hover {{border:2px solid {colors[0]};}}")
            button.clicked.connect(lambda _, n=name: self.choose(n))
            grid.addWidget(button,i//3,i%3)
            self.options[name] = button
        lay.addLayout(grid)
        box,v = card()
        v.addWidget(label("Custom palette",3,True))
        self.pickers = []
        buttons = []
        for i,name in enumerate(("Accent","Gradient start","Gradient end")):
            b = QPushButton()
            b.clicked.connect(lambda _, index=i: self.pick(index))
            self.pickers.append((b,name))
            buttons.append(b)
        v.addLayout(row(*buttons))
        lay.addWidget(box)
        self.status = label("",role="muted")
        apply = QPushButton("Apply theme")
        apply.setObjectName("apply")
        apply.clicked.connect(lambda: commit({**config,"theme":self.name,"colors":list(self.colors)}))
        lay.addLayout(row(self.status,None,apply))
        lay.addStretch()
        self.refresh()

    def choose(self,name):
        self.name,self.colors = name,list(PRESETS[name])
        self.refresh()

    def pick(self,index):
        color = QColorDialog.getColor(QColor(self.colors[index]),self,"Choose a color")
        if color.isValid():
            self.name = "Custom"
            self.colors[index] = color.name()
            self.refresh()

    def refresh(self):
        self.preview.colors = self.colors
        self.preview.update()
        self.preview.layout().itemAt(0).widget().setStyleSheet(f"color:{self.colors[0]}")
        for name,b in self.options.items():
            b.setChecked(name == self.name)
        for i,(b,name) in enumerate(self.pickers):
            b.setText(name+"   "+self.colors[i].upper())
            b.setStyleSheet(f"border-bottom:3px solid {self.colors[i]}")
        self.status.setText(f"Previewing {self.name}   ·   Saved theme: {self.config['theme']}")

