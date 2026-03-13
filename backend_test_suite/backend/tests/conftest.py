import sys
from pathlib import Path

import pytest

# Ensure backend/ is importable as a top-level module path
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as backend_app


@pytest.fixture
def client(monkeypatch, tmp_path):
    test_upload_dir = tmp_path / "uploads"
    test_upload_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(backend_app, "UPLOAD_DIR", test_upload_dir)
    monkeypatch.setattr(backend_app, "PUBLIC_URL", "http://test-server")
    backend_app.OMR_JOBS.clear()

    backend_app.app.config["TESTING"] = True
    with backend_app.app.test_client() as client:
        yield client


@pytest.fixture
def backend_module():
    return backend_app
