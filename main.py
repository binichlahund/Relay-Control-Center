import sys

from PySide6.QtWidgets import QApplication

from ui.window import Window
from utils.config import ConfigManager


def main():
    app = QApplication(sys.argv)
    app.setOrganizationName("Relay")
    app.setApplicationName("Control Center")
    app.setStyle("Fusion")
    window = Window(ConfigManager())
    window.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())

