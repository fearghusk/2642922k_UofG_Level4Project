from io import BytesIO


def test_upload_success(monkeypatch, client, backend_module):
    # Mock talking score builder
    def fake_builder(path):
        return {
            "basic_information": {},
            "music_segments": [],
            "audio": {"whole": {}, "groups": {}},
        }

    monkeypatch.setattr(
        backend_module,
        "build_talking_score_json_music21",
        fake_builder,
    )

    data = {
        "file": (BytesIO(b"<xml></xml>"), "score.musicxml")
    }

    resp = client.post("/upload", data=data, content_type="multipart/form-data")

    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload["success"] is True
    assert "job_id" in payload