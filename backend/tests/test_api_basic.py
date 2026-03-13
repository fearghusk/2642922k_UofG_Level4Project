from io import BytesIO


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.get_json() == {"ok": True}


def test_ping(client):
    resp = client.post("/ping")
    assert resp.status_code == 200
    assert resp.get_json() == {"ok": True}


def test_upload_missing_file(client):
    resp = client.post("/upload", data={})
    assert resp.status_code == 400
    payload = resp.get_json()
    assert payload["success"] is False
    assert "No file field" in payload["error"]


def test_upload_bad_extension(client):
    data = {"file": (BytesIO(b"abc"), "bad.txt")}
    resp = client.post("/upload", data=data, content_type="multipart/form-data")
    assert resp.status_code == 400
    payload = resp.get_json()
    assert payload["success"] is False
    assert "Unsupported file type" in payload["error"]


def test_omr_status_unknown_job(client):
    resp = client.get("/omr_status/unknownjob")
    assert resp.status_code == 404
    payload = resp.get_json()
    assert payload["success"] is False
    assert payload["error"] == "Unknown job_id"


def test_render_audio_missing_job_id(client):
    resp = client.post("/render_audio", json={})
    assert resp.status_code == 400
    payload = resp.get_json()
    assert payload["success"] is False
    assert payload["error"] == "Missing job_id"


def test_render_group_audio_invalid_range(client):
    resp = client.post(
        "/render_group_audio",
        json={"job_id": "job123", "start_bar": 3, "end_bar": 1},
    )
    assert resp.status_code == 400
    payload = resp.get_json()
    assert payload["success"] is False
    assert "Invalid bar range" in payload["error"]


def test_render_group_audio_requires_integer_bar_args(client):
    resp = client.post(
        "/render_group_audio",
        json={"job_id": "job123", "start_bar": "one", "end_bar": "two"},
    )
    assert resp.status_code == 400
    payload = resp.get_json()
    assert payload["success"] is False
    assert "must be integers" in payload["error"]
