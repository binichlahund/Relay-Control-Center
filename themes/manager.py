from PySide6.QtGui import QColor

# Accent, gradient start and gradient end form a complete palette.
PRESETS = {
    "Purple Night": ("#b092ff", "#463574", "#211b39"),
    "Blue Neon": ("#78b4ff", "#284a78", "#152339"),
    "Emerald Glow": ("#62dfb2", "#235d51", "#152d2a"),
    "Crimson Dark": ("#ff889b", "#703342", "#351d2a"),
    "Frost / Ice": ("#99e2ef", "#38616f", "#1c2d3e"),
    "Minimal Gray": ("#c3c6d2", "#474b57", "#272933"),
}


def mix(a, b, ratio):
    x, y = QColor(a), QColor(b)
    return QColor.fromRgbF(*[u * (1-ratio) + v * ratio for u, v in
                             zip(x.getRgbF()[:3], y.getRgbF()[:3])]).name()


class ThemeManager:
    def apply(self, app, config):
        a, start, end = config["colors"]
        from PySide6.QtGui import QFont
        size = round(config["font"] * config["scale"] / 100)
        app.setFont(QFont("Segoe UI", size))
        app.setStyleSheet(f"""
        QWidget {{color:#efedf7;}} QMainWindow, QDialog, QMessageBox {{background:#101016;}}
        QScrollArea, QScrollArea > QWidget > QWidget, QWidget#page {{background:#101016;}}
        QWidget#rail {{background:#16151d; border-right:1px solid #2b2935;}}
        QFrame#card {{background:qlineargradient(x1:0,y1:0,x2:1,y2:1,stop:0 {mix('#191921',end,.24)},stop:1 #18181f);border:1px solid #33313e;border-radius:15px;}}
        QLabel {{background:transparent;border:0;}}
        QLabel[role="muted"] {{color:#a39fae;}} QLabel[role="accent"] {{color:{a};}}
        QPushButton,QLineEdit,QComboBox {{background:#211f2b;border:1px solid #383542;border-radius:8px;padding:7px 12px;}}
        QPushButton:hover,QComboBox:hover {{background:{mix('#25232c',start,.48)};border-color:{a};}}
        QPushButton:checked, QPushButton#apply {{background:{start};border-color:{mix(start,a,.45)};color:white;}}
        QToolTip,QComboBox QAbstractItemView {{background:#272530;color:white;selection-background-color:{start};}}
        QTableWidget {{background:transparent;gridline-color:#33313e;border:0;selection-background-color:{start};}}
        QHeaderView::section {{background:#201f28;color:#aaa6b8;border:0;padding:5px;text-align:left;}}
        QScrollBar:vertical {{background:transparent;width:8px;}} QScrollBar::handle:vertical {{background:#484451;border-radius:4px;min-height:30px;}}
        QScrollBar::add-line:vertical,QScrollBar::sub-line:vertical {{height:0;}}
        QSlider::groove:horizontal {{height:4px;background:#393641;border-radius:2px;}}
        QSlider::sub-page:horizontal {{background:{a};}} QSlider::handle:horizontal {{width:14px;margin:-5px 0;background:{a};border-radius:7px;}}
        """)

