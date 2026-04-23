"""
Tiny JSON-file persistence layer. Not meant for real production scale,
but keeps the existing on-disk format and adds a users table.
"""
import json
import os
import threading
from typing import Any, Dict

DATA_FILE = "data.json"

_lock = threading.Lock()


def _default_data() -> Dict[str, Any]:
    return {
        "users": [],       
        "questions": [],  
    }


def load_data() -> Dict[str, Any]:
    with _lock:
        if not os.path.exists(DATA_FILE):
            data = _default_data()
            _write(data)
            return data
        with open(DATA_FILE, "r") as f:
            data = json.load(f)
        changed = False
        if "users" not in data:
            data["users"] = []
            changed = True
        if "questions" not in data:
            data["questions"] = []
            changed = True
        if changed:
            _write(data)
        return data


def save_data(data: Dict[str, Any]) -> None:
    with _lock:
        _write(data)


def _write(data: Dict[str, Any]) -> None:
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, DATA_FILE)
