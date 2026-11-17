import math
from collections import deque

from PySide6.QtCore import Qt, QPointF, QVariantAnimation, QEasingCurve
from PySide6.QtGui import QColor, QPainter, QPainterPath, QLinearGradient, QPen, QFont
from PySide6.QtWidgets import (QApplication, QFrame, QHBoxLayout, QLabel, QPushButton,
                               QVBoxLayout, QWidget, QSizePolicy)
from ui.icons import icon
from themes.manager import mix


def px(value):
    return round(value * (QApplication.instance().property("scale") or 100) / 100)


def label(text, delta=0, bold=False, role=None, mono=False):
    item = QLabel(text)
    item.setTextFormat(Qt.TextFormat.PlainText)
    font = QFont(QApplication.font())
    if mono:
        font.setFamily("Consolas")
    font.setPointSizeF(max(7, font.pointSizeF() + delta * px(100)/100))
    font.setWeight(QFont.Weight.DemiBold if bold else QFont.Weight.Normal)
    item.setFont(font)
    if role:
        item.setProperty("role", role)
    return item


def card():
    box = QFrame()
    box.setObjectName("card")
    lay = QVBoxLayout(box)
    lay.setContentsMargins(*[px(18)]*4)
    lay.setSpacing(px(9))
    return box, lay


def glyph(key, tint, size=20):
    view = QLabel()
    view.setPixmap(icon(key, tint, px(size)).pixmap(px(size), px(size)))
    return view


def row(*widgets):
    layout = QHBoxLayout()
    for w in widgets:
        if w is None:
            layout.addStretch()
        else:
            layout.addWidget(w)
    return layout


class NavButton(QPushButton):
    def __init__(self, title, key, colors):
        super().__init__("   " + title)
        self.key, self.colors = key, colors
        self.setCheckable(True)
        self.setMinimumHeight(px(43))
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.anim = QVariantAnimation(self, duration=160)
        self.anim.setEasingCurve(QEasingCurve.Type.OutCubic)
        self.anim.valueChanged.connect(self.paint_tint)
        self.toggled.connect(lambda _: self.paint_tint(0))
        self.paint_tint(0)

    def paint_tint(self, amount):
        a, start, end = self.colors
        active = self.isChecked()
        bg = mix(start if active else "#16151d", a if active else start, float(amount)*.18)
        edge = mix(start, a, .25) if active else bg
        self.setStyleSheet(f"QPushButton {{text-align:left;padding-left:{px(12)}px;background:{bg};color:{'#f4efff' if active else '#bcb8c8'};border:1px solid {edge};border-radius:8px;}}")
        self.setIcon(icon(self.key, a if active else "#9692a4", px(19)))

    def hover(self, target):
        start = self.anim.currentValue() or 0.
        self.anim.stop()
        self.anim.setStartValue(float(start))
        self.anim.setEndValue(target)
        self.anim.start()

    def enterEvent(self, event):
        self.hover(1.)
        super().enterEvent(event)

    def leaveEvent(self, event):
        self.hover(0.)
        super().leaveEvent(event)


class Banner(QWidget):
    def __init__(self, colors):
        super().__init__()
        self.colors = colors
        self.setMinimumHeight(px(143))
        layout = QVBoxLayout(self)
        layout.setContentsMargins(px(24),px(16),px(20),px(16))
        layout.addWidget(label("SYSTEM TELEMETRY", -1, True, "accent", True))
        layout.addWidget(label("System overview", 15, True))
        self.details = label("Connecting to local hardware…", 0, False, "muted")
        layout.addWidget(self.details)
        layout.addStretch()

    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        w,h = self.width(), self.height()
        path = QPainterPath()
        path.addRoundedRect(1,1,w-2,h-2,px(16),px(16))
        p.setClipPath(path)
        accent, start, end = self.colors
        grad = QLinearGradient(0,h,w,0)
        grad.setColorAt(0,QColor(end))
        grad.setColorAt(.65,QColor(start))
        grad.setColorAt(1,QColor(end))
        p.fillPath(path,grad)
        def point(t, v):
            x = w*(.39 + .69*t)
            y = h*(.56 + .34*math.sin(7*t+v*1.35) - .21*math.sin(3*t)
                   + v*(.21+.13*math.sin(8*t)))
            return QPointF(x,y)
        for j in range(33):
            v = j/16-1
            line = QPainterPath(point(0,v))
            for i in range(1,101):
                line.lineTo(point(i/100,v))
            ink = QLinearGradient(w*.39,0,w,0)
            for at, alpha in [(0,0),(.24,38),(.62,150),(1,65)]:
                c = QColor(accent).lighter(115)
                c.setAlpha(alpha)
                ink.setColorAt(at,c)
            p.setPen(QPen(ink,1))
            p.drawPath(line)
        for i in range(18,101,2):
            line = QPainterPath(point(i/100,-1))
            for j in range(1,17):
                line.lineTo(point(i/100,j/8-1))
            c = QColor(accent)
            c.setAlpha(32)
            p.setPen(QPen(c,1))
            p.drawPath(line)
        p.setPen(QPen(QColor(mix(start,accent,.38)),1))
        p.drawPath(path)


class Chart(QWidget):
    def __init__(self, colors, height=40, grid=False):
        super().__init__()
        self.colors = colors
        self.series = [deque(maxlen=60) for _ in colors]
        self.grid = grid
        self.setMinimumHeight(px(height))
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)

    def add(self, *values):
        for points, v in zip(self.series, values):
            points.append(v)
        self.update()

    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        w,h = self.width(), self.height()-3
        if self.grid:
            p.setPen(QPen(QColor("#33303d"),1,Qt.PenStyle.DotLine))
            for i in range(1,5):
                p.drawLine(0, h*i//4,w,h*i//4)
        peak = max([1]+[v for seq in self.series for v in seq if v is not None]) if self.grid else 100
        for color, points in zip(self.colors,self.series):
            pts = []
            for i, v in enumerate(points):
                if v is None:
                    self.draw_series(p,pts,color,h)
                    pts = []
                else:
                    pts.append(QPointF(w*(60-len(points)+i)/59, h-2-v/peak*(h-5)))
            self.draw_series(p,pts,color,h)

    @staticmethod
    def draw_series(p, pts, color, h):
        if not pts:
            return
        path = QPainterPath(pts[0])
        for pt in pts[1:]:
            path.lineTo(pt)
        fill = QPainterPath(path)
        fill.lineTo(pts[-1].x(), h)
        fill.lineTo(pts[0].x(), h)
        fill.closeSubpath()
        grad = QLinearGradient(0,0,0,h)
        c = QColor(color)
        c.setAlpha(70)
        grad.setColorAt(0,c)
        c.setAlpha(0)
        grad.setColorAt(1,c)
        p.fillPath(fill,grad)
        p.setPen(QPen(QColor(color),1.8))
        p.drawPath(path)
        p.drawPoint(pts[-1])

