class DummyScore:
    def __init__(self):
        self.parts = []


def test_render_group_audio_success(monkeypatch, client, backend_module):
    job_id = "job123"
    job_dir = backend_module.UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    (job_dir / "score.musicxml").write_text("<xml></xml>", encoding="utf-8")

    monkeypatch.setattr(backend_module.converter, "parse", lambda path: DummyScore())
    monkeypatch.setattr(backend_module, "apply_instrument_to_score", lambda score, instrument: None)
    monkeypatch.setattr(backend_module, "score_slice_measures", lambda score, s, e: DummyScore())

    def fake_render(score, midi_out, wav_out):
        midi_out.parent.mkdir(parents=True, exist_ok=True)
        midi_out.write_bytes(b"mid")
        wav_out.write_bytes(b"wav")

    monkeypatch.setattr(backend_module, "render_score_to_midi_and_wav", fake_render)

    resp = client.post(
        "/render_group_audio",
        json={"job_id": job_id, "instrument": "piano", "start_bar": 1, "end_bar": 2},
    )

    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload["success"] is True
    assert payload["group_key"] == "1-2"
    assert payload["wav_url"].endswith("/file/job123/audio/piano/group_1_2.wav")


def test_render_audio_success(monkeypatch, client, backend_module):
    job_id = "job123"
    job_dir = backend_module.UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    (job_dir / "score.musicxml").write_text("<xml></xml>", encoding="utf-8")

    monkeypatch.setattr(backend_module.converter, "parse", lambda path: DummyScore())
    monkeypatch.setattr(backend_module, "apply_instrument_to_score", lambda score, instrument: None)

    def fake_render(score, midi_out, wav_out):
        midi_out.parent.mkdir(parents=True, exist_ok=True)
        midi_out.write_bytes(b"mid")
        wav_out.write_bytes(b"wav")

    monkeypatch.setattr(backend_module, "render_score_to_midi_and_wav", fake_render)

    resp = client.post("/render_audio", json={"job_id": job_id, "instrument": "piano"})

    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload["success"] is True
    assert payload["audio"]["whole"]["wav_url"].endswith("/file/job123/audio/piano/whole.wav")
