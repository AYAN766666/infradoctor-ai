import sys, os
sys.path.insert(0, os.path.dirname(__file__))
os.environ["PYTHONIOENCODING"] = "utf-8"
import uvicorn
uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)
