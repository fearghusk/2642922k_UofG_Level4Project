from pathlib import Path


def test_safe_float_valid(backend_module):
    assert backend_module.safe_float("3.5") == 3.5


def test_safe_float_invalid_returns_default(backend_module):
    assert backend_module.safe_float("not-a-number") == 1.0


def test_ts_string(backend_module):
    class DummyTS:
        ratioString = "3/4"

    assert backend_module._ts_string(DummyTS()) == "3/4"


def test_key_string_key_object(backend_module):
    from music21 import key

    k = key.Key("C")
    result = backend_module._key_string(k)

    assert "C" in result


def test_duration_text_common_values(backend_module):
    class DummyDuration:
        def __init__(self, ql):
            self.quarterLength = ql

    class DummyNote:
        def __init__(self, ql):
            self.duration = DummyDuration(ql)

    assert backend_module._duration_text(DummyNote(1.0)) == "quarter"
    assert backend_module._duration_text(DummyNote(0.5)) == "eighth"
    assert backend_module._duration_text(DummyNote(2.0)) == "half"


def test_score_slice_measures_fallback(backend_module):
    class DummyScore:
        def measures(self, start, end):
            return "slice"

    result = backend_module.score_slice_measures(DummyScore(), 1, 2)
    assert result == "slice"