from PySide6.QtCore import QByteArray, QSize, Qt
from PySide6.QtGui import QIcon, QPainter, QPixmap
from PySide6.QtSvg import QSvgRenderer

PATHS = {
    "logo": "M3 17 10 5h6l-7 12z M12 19l7-12h3l-7 12z",
    "stats": "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    "shortcuts": "m13 2-9 12h7l-1 8 10-13h-7z",
    "themes": "m12 3 9 5-9 5-9-5z M3 12l9 5 9-5 M3 16l9 5 9-5",
    "settings": "M4 6h6m4 0h6M4 12h10m4 0h2M4 18h2m4 0h10 M10 3v6m4 0V3 M14 9v6m4 0V9 M6 15v6m4 0v-6",
    "cpu": "M6 6h12v12H6z M9 9h6v6H9z M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3",
    "gpu": "M3 6h17v11H3z M6 17v3m3-3v3m3-3v3 M12 11a3 3 0 1 0 6 0 3 3 0 1 0-6 0 M5 10h4m-4 3h4",
    "ram": "M2 7h20v10H2z M5 10v4m4-4v4m5-4v4m4-4v4M5 17v3m4-3v3m5-3v3m4-3v3",
    "disk": "m6 4-3 10v5h18v-5L18 4z M3 14h18m-6 3h3",
    "network": "M3 17h3l3-10 4 14 3-11 2 5h4",
    "process": "M4 5h3v3H4z M10 6h10M4 11h3v3H4z M10 12h10M4 17h3v3H4z M10 18h10",
    "pc": "M3 4h18v13H3z M12 17v3m-5 1h10",
    "brave": "m12 2 8 4v8l-8 8-8-8V6z M8 9l4 2 4-2m-6 6h4",
    "chat": "M4 4h16v12H9l-5 4z M8 9h8",
    "discord": "m6 6 4-2 1 2h2l1-2 4 2 3 10-5 3-2-2h-4l-2 2-5-3z M8 11v2m8-2v2",
    "steam": "M3 14l6 3 3-1 4-6 M13 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0 M3 17l6 3 4-2",
    "game": "M8 7h8q4 0 5 9t-6-1H9q-7 9-6 1t5-9z M6 11h5m-2-2v5m6-3h1m2 2h1",
    "calc": "M5 3h14v18H5z M8 6h8v4H8z M8 14h2m3 0h2m-7 3h2m3 0h2",
    "arrow": "M5 12h14m-6-6 6 6-6 6",
}


def icon(key, color="#b092ff", size=24):
    path = PATHS.get(key, PATHS["shortcuts"])
    fill = color if key == "logo" else "none"
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="{path}" stroke="{color}" fill="{fill}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    pix = QPixmap(QSize(size*2, size*2))
    pix.fill(Qt.GlobalColor.transparent)
    painter = QPainter(pix)
    QSvgRenderer(QByteArray(svg.encode())).render(painter)
    painter.end()
    pix.setDevicePixelRatio(2)
    return QIcon(pix)

