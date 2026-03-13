from pathlib import Path


def test_build_talking_score_json_music21_schema(backend_module):
    sample = Path(__file__).parent / "data" / "sample.musicxml"
    doc = backend_module.build_talking_score_json_music21(str(sample))

    assert "basic_information" in doc
    assert "music_segments" in doc
    assert "audio" in doc
    assert isinstance(doc["music_segments"], list)
    assert doc["audio"] == {"whole": {}, "groups": {}}

    basic = doc["basic_information"]
    assert basic["title"] == "Sample Score"
    assert basic["composer"] == "OpenAI Test"
    assert basic["time_signature"] == "4/4"
    assert basic["key_signature"].lower().startswith("c")
    assert "tempo" in basic

    first_segment = doc["music_segments"][0]
    assert first_segment["start_bar"] == 1
    assert first_segment["end_bar"] >= 1
    assert "instruments" in first_segment

    first_instrument = first_segment["instruments"][0]
    assert "parts" in first_instrument

    first_part = first_instrument["parts"][0]
    assert "bars" in first_part
    assert len(first_part["bars"]) >= 1

    first_bar = first_part["bars"][0]
    assert "bar" in first_bar
    assert "beats" in first_bar
    assert "time_and_keys" in first_bar
    assert isinstance(first_bar["beats"], list)
    assert len(first_bar["beats"]) >= 1

    first_beat = first_bar["beats"][0]
    assert "beat" in first_beat
    assert "text" in first_beat
    assert first_beat["text"].startswith("Beat")


def test_build_talking_score_json_music21_contains_note_text(backend_module):
    sample = Path(__file__).parent / "data" / "sample.musicxml"
    doc = backend_module.build_talking_score_json_music21(str(sample))

    bars = doc["music_segments"][0]["instruments"][0]["parts"][0]["bars"]
    beat_texts = " ".join(beat["text"] for bar in bars for beat in bar["beats"])

    # The sample score contains C4, D4, E4, F4 quarter notes
    assert "C4 quarter" in beat_texts
    assert "D4 quarter" in beat_texts
    assert "E4 quarter" in beat_texts
    assert "F4 quarter" in beat_texts
