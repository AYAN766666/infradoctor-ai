import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

os.environ["MONITORING_ENABLED"] = "0"

from app.main import app
