
import os
import uuid
import threading
import traceback
from pathlib import Path

from flask import Flask, request, jsonify, send_file, abort
from flask_cors import CORS

from music21 import (
    converter,
    instrument as m21instrument,
    stream,
    tempo,
    meter,
    key as m21key,
    dynamics as m21dyn,
    chord as m21chord,
    note as m21note,
)

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

PUBLIC_URL = os.environ.get("PUBLIC_URL", "").rstrip("/")

OMR_JOBS = {}
INSTRUMENT_MAP = {
    "piano": m21instrument.Piano,
    "guitar": m21instrument.Guitar,
    "violin": m21instrument.Violin,
    "cello": m21instrument.Violoncello,
    "flute": m21instrument.Flute,
    "clarinet": m21instrument.Clarinet,
}


def safe_float(x, default=1.0):
    try:
        f = float(x)
        return f if f == f and f not in (float("inf"), float("-inf")) else default
    except Exception:
        return default


def _score_title_and_composer(sc):
    title = ""
    composer = ""
    try:
        if sc.metadata:
            title = sc.metadata.title or ""
            composer = sc.metadata.composer or ""
    except Exception:
        pass
    return title, composer


def _first_tempo_text(sc):
    try:
        mm = sc.recurse().getElementsByClass(tempo.MetronomeMark).first()
        if mm:
            if mm.number:
                return f"{mm.number} bpm"
            if mm.text:
                return str(mm.text)
    except Exception:
        pass
    return ""


def _ts_string(ts):
    if not ts:
        return ""
    try:
        return ts.ratioString
    except Exception:
        return str(ts)


def _key_string(ks):
    if not ks:
        return ""
    try:
        if isinstance(ks, m21key.Key):
            return f"{ks.tonic.name} {ks.mode}"
        if isinstance(ks, m21key.KeySignature):
            inferred = ks.asKey("major")
            return f"{inferred.tonic.name} {inferred.mode}"
    except Exception:
        pass
    return str(ks)


def _event_pitch_text(n):
    p = n.pitch.nameWithOctave
    if n.tie is not None:
        return f"{p} tied"
    return p


def _chord_text(ch):
    pitches = []
    for p, tn in zip(ch.pitches, ch.notes):
        pitch_txt = p.nameWithOctave
        if tn.tie is not None:
            pitch_txt += " tied"
        pitches.append(pitch_txt)
    return "Chord " + " ".join(pitches)


def _duration_text(el):
    try:
        ql = float(el.duration.quarterLength)
        if abs(ql - 4.0) < 1e-6:
            return "whole"
        if abs(ql - 2.0) < 1e-6:
            return "half"
        if abs(ql - 1.0) < 1e-6:
            return "quarter"
        if abs(ql - 0.5) < 1e-6:
            return "eighth"
        if abs(ql - 0.25) < 1e-6:
            return "sixteenth"
        return f"{ql:g} quarters"
    except Exception:
        return ""


def _dynamic_marks_in_measure(meas):
    out = []
    try:
        for d in meas.recurse().getElementsByClass(m21dyn.Dynamic):
            b = getattr(d, "beat", None) or 1.0
            out.append((float(b), f"Dynamic {d.value}"))
    except Exception:
        pass

    try:
        for w in meas.recurse().getElementsByClass(m21dyn.Wedge):
            b = getattr(w, "beat", None) or 1.0
            kind = (
                "crescendo" if w.type == "crescendo"
                else "diminuendo" if w.type == "diminuendo"
                else "wedge"
            )
            out.append((float(b), kind))
    except Exception:
        pass
    return out


def _notes_in_measure(meas):
    events = []
    for el in meas.recurse().notesAndRests:
        try:
            b = float(getattr(el, "beat", 1.0) or 1.0)
        except Exception:
            b = 1.0

        if isinstance(el, m21note.Rest):
            dt = _duration_text(el)
            events.append((b, f"Rest {dt}".strip()))
        elif isinstance(el, m21chord.Chord):
            dt = _duration_text(el)
            events.append((b, f"{_chord_text(el)} {dt}".strip()))
        elif isinstance(el, m21note.Note):
            dt = _duration_text(el)
            events.append((b, f"{_event_pitch_text(el)} {dt}".strip()))

    events.extend(_dynamic_marks_in_measure(meas))
    events.sort(key=lambda x: (x[0], x[1]))
    return events


def build_talking_score_json_music21(xml_path: str):
    """Test-friendly MusicXML -> talking score JSON builder."""
    sc = converter.parse(xml_path)
    try:
        sc_perf = sc.expandRepeats()
    except Exception:
        sc_perf = sc

    title, composer = _score_title_and_composer(sc_perf)
    tempo_txt = _first_tempo_text(sc_perf)

    parts = list(sc_perf.parts) if hasattr(sc_perf, "parts") and len(sc_perf.parts) else [sc_perf]

    music_segments_out = [{
        "start_bar": 1,
        "end_bar": 0,
        "instruments": [{
            "instrument_index": 0,
            "instrument_name": "Score",
            "parts": []
        }]
    }]

    prev_ts = None
    prev_ks = None
    part_measures = []
    max_len = 0

    for p in parts:
        ms = list(p.getElementsByClass(stream.Measure))
        part_measures.append(ms)
        max_len = max(max_len, len(ms))

    end_bar = max_len
    music_segments_out[0]["end_bar"] = end_bar

    basic_information = {
        "title": title,
        "composer": composer,
        "tempo": tempo_txt,
    }

    for pi, measures in enumerate(part_measures):
        bars_out = []
        for i in range(end_bar):
            bar_no = i + 1
            meas = measures[i] if i < len(measures) else None

            ts_obj = None
            ks_obj = None
            if meas is not None:
                try:
                    ts_obj = getattr(meas, "timeSignature", None) or meas.getContextByClass(meter.TimeSignature)
                except Exception:
                    ts_obj = None
                try:
                    ks_obj = (
                    getattr(meas, "keySignature", None)
                    or meas.getContextByClass(m21key.KeySignature)
                    or meas.getContextByClass(m21key.Key)
                        )
                except Exception:
                    ks_obj = None

            ts_str = _ts_string(ts_obj)
            ks_str = _key_string(ks_obj)

            time_and_keys = []
            if bar_no == 1 and ts_str:
                time_and_keys.append(f"Time signature: {ts_str}")
            if bar_no == 1 and ks_str:
                time_and_keys.append(f"Key signature: {ks_str}")

            if ts_str and (prev_ts is None or ts_str != prev_ts):
                if bar_no != 1:
                    time_and_keys.append(f"Time signature: {ts_str}")
                prev_ts = ts_str

            if ks_str and (prev_ks is None or ks_str != prev_ks):
                if bar_no != 1:
                    time_and_keys.append(f"Key signature: {ks_str}")
                prev_ks = ks_str

            evs = _notes_in_measure(meas) if meas is not None else []

            by_beat = {}
            for b, txt in evs:
                bb = round(safe_float(b, default=1.0), 3)
                by_beat.setdefault(bb, []).append(txt)

            beats_out = []
            if not by_beat:
                beats_out.append({"beat": 1.0, "text": "Beat 1: (no events)."})
            else:
                for b in sorted(by_beat.keys()):
                    joined = ", ".join(by_beat[b])
                    beats_out.append({"beat": b, "text": f"Beat {b}: {joined}."})

            bars_out.append({
                "bar": bar_no,
                "beats": beats_out,
                "repetition": None,
                "time_and_keys": time_and_keys,
            })

        part_name = ""
        try:
            part_name = parts[pi].partName or ""
        except Exception:
            pass
        if not part_name:
            part_name = f"Part {pi}"

        music_segments_out[0]["instruments"][0]["parts"].append({
            "part_index": pi,
            "part_name": part_name,
            "bars": bars_out,
        })

    try:
        first_bar = music_segments_out[0]["instruments"][0]["parts"][0]["bars"][0]
        tk = first_bar.get("time_and_keys", [])
        for s in tk:
            if s.lower().startswith("time signature"):
                basic_information["time_signature"] = s.split(":", 1)[1].strip()
            if s.lower().startswith("key signature"):
                basic_information["key_signature"] = s.split(":", 1)[1].strip()
    except Exception:
        pass

    return {
        "basic_information": basic_information,
        "preamble": [],
        "general_summary": "",
        "parts_summary": {},
        "selected_part_names": [],
        "settings": {},
        "music_segments": music_segments_out,
        "audio": {"whole": {}, "groups": {}},
    }


def run_omr_to_musicxml(input_path: Path, job_dir: Path) -> Path:
    """External OMR hook. Replace or monkeypatch in tests."""
    raise RuntimeError("OMR backend not configured in app.py. Mock this in tests or provide an implementation.")


def apply_instrument_to_score(score, instrument_key: str):
    cls = INSTRUMENT_MAP.get((instrument_key or "").lower(), m21instrument.Piano)
    inst = cls()
    if hasattr(score, "parts") and len(score.parts) > 0:
        for p in score.parts:
            p.insert(0, inst)
    else:
        score.insert(0, inst)


def score_slice_measures(score, start_bar: int, end_bar: int):
    try:
        return score.measures(start_bar, end_bar)
    except Exception:
        s_out = stream.Score()
        if hasattr(score, "parts") and len(score.parts) > 0:
            for p in score.parts:
                s_out.append(p.measures(start_bar, end_bar))
            return s_out
        return score.measures(start_bar, end_bar)


def render_score_to_midi_and_wav(score, midi_out: Path, wav_out: Path):
    """External audio hook. Replace or monkeypatch in tests."""
    raise RuntimeError("Audio rendering backend not configured in app.py. Mock this in tests or provide an implementation.")


app = Flask(__name__)
CORS(app)


@app.get("/health")
def health():
    return jsonify({"ok": True})


@app.post("/ping")
def ping():
    return jsonify({"ok": True})


@app.get("/file/<job_id>/<path:relpath>")
def get_file(job_id, relpath):
    job_dir = UPLOAD_DIR / job_id
    file_path = job_dir / relpath
    if not file_path.exists():
        abort(404)
    return send_file(str(file_path), as_attachment=False)


@app.post("/upload")
def upload():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file field named 'file'"}), 400

    f = request.files["file"]
    if not f.filename:
        return jsonify({"success": False, "error": "Empty filename"}), 400

    ext = Path(f.filename).suffix.lower()
    if ext not in [".xml", ".musicxml", ".mxl"]:
        return jsonify({
            "success": False,
            "error": f"Unsupported file type {ext}. Upload .xml, .musicxml, or .mxl",
        }), 400

    job_id = str(uuid.uuid4())[:8]
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    xml_path = job_dir / "score.musicxml"
    f.save(str(xml_path))

    try:
        doc = build_talking_score_json_music21(str(xml_path))
    except Exception as e:
        return jsonify({"success": False, "error": f"Talking score parse failed: {str(e)}"}), 500

    return jsonify({"success": True, "job_id": job_id, "data": doc})


@app.post("/omr_start")
def omr_start():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file field named 'file'"}), 400

    f = request.files["file"]
    if not f.filename:
        return jsonify({"success": False, "error": "Empty filename"}), 400

    ext = Path(f.filename).suffix.lower()
    if ext not in [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"]:
        return jsonify({
            "success": False,
            "error": f"Unsupported file type {ext}. Upload a PDF or image.",
        }), 400

    job_id = str(uuid.uuid4())[:8]
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    inp = job_dir / f"input{ext}"
    f.save(str(inp))

    OMR_JOBS[job_id] = {"status": "queued", "progress": "Queued", "error": "", "data": None}

    def worker():
        try:
            OMR_JOBS[job_id]["status"] = "running"
            OMR_JOBS[job_id]["progress"] = "Running OMR…"

            xml_path = run_omr_to_musicxml(inp, job_dir)

            OMR_JOBS[job_id]["progress"] = "Parsing talking score…"
            doc = build_talking_score_json_music21(str(xml_path))

            OMR_JOBS[job_id]["status"] = "done"
            OMR_JOBS[job_id]["progress"] = "Done"
            OMR_JOBS[job_id]["data"] = doc
        except Exception as e:
            OMR_JOBS[job_id]["status"] = "error"
            OMR_JOBS[job_id]["progress"] = "Error"
            OMR_JOBS[job_id]["error"] = f"{e}\n{traceback.format_exc()}"

    threading.Thread(target=worker, daemon=True).start()

    return jsonify({"success": True, "job_id": job_id})


@app.get("/omr_status/<job_id>")
def omr_status(job_id):
    st = OMR_JOBS.get(job_id)
    if not st:
        return jsonify({"success": False, "error": "Unknown job_id"}), 404

    if st["status"] == "done":
        return jsonify({
            "success": True,
            "status": "done",
            "job_id": job_id,
            "data": st["data"],
        })

    if st["status"] == "error":
        return jsonify({
            "success": False,
            "status": "error",
            "error": st.get("error", "OMR failed"),
        }), 500

    return jsonify({
        "success": True,
        "status": st["status"],
        "progress": st.get("progress", ""),
    })


@app.post("/omr")
def omr_sync():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file field named 'file'"}), 400

    f = request.files["file"]
    if not f.filename:
        return jsonify({"success": False, "error": "Empty filename"}), 400

    ext = Path(f.filename).suffix.lower()
    if ext not in [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"]:
        return jsonify({
            "success": False,
            "error": f"Unsupported file type {ext}. Upload a PDF or image.",
        }), 400

    job_id = str(uuid.uuid4())[:8]
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    inp = job_dir / f"input{ext}"
    f.save(str(inp))

    try:
        xml_path = run_omr_to_musicxml(inp, job_dir)
        doc = build_talking_score_json_music21(str(xml_path))
    except Exception as e:
        return jsonify({"success": False, "error": f"OMR failed: {str(e)}"}), 500

    return jsonify({"success": True, "job_id": job_id, "data": doc})


@app.post("/render_audio")
def render_audio():
    try:
        payload = request.get_json(force=True) or {}
    except Exception:
        payload = {}

    job_id = payload.get("job_id")
    instrument_key = (payload.get("instrument") or "piano").lower()

    if not job_id:
        return jsonify({"success": False, "error": "Missing job_id"}), 400

    job_dir = UPLOAD_DIR / job_id
    xml_path = job_dir / "score.musicxml"
    if not xml_path.exists():
        return jsonify({"success": False, "error": "score.musicxml not found for this job_id"}), 404

    audio_dir = job_dir / "audio" / instrument_key
    audio_dir.mkdir(parents=True, exist_ok=True)

    try:
        score = converter.parse(str(xml_path))
        apply_instrument_to_score(score, instrument_key)

        whole_midi = audio_dir / "whole.mid"
        whole_wav = audio_dir / "whole.wav"
        if not whole_wav.exists():
            render_score_to_midi_and_wav(score, whole_midi, whole_wav)

        base = PUBLIC_URL or "http://localhost:5000"
        return jsonify({
            "success": True,
            "audio": {
                "whole": {"wav_url": f"{base}/file/{job_id}/audio/{instrument_key}/whole.wav"}
            }
        })
    except Exception as e:
        return jsonify({"success": False, "error": f"Audio render failed: {str(e)}"}), 500


@app.post("/render_group_audio")
def render_group_audio():
    try:
        payload = request.get_json(force=True) or {}
    except Exception:
        payload = {}

    job_id = payload.get("job_id")
    instrument_key = (payload.get("instrument") or "piano").lower()

    try:
        start_bar = int(payload.get("start_bar"))
        end_bar = int(payload.get("end_bar"))
    except Exception:
        return jsonify({"success": False, "error": "start_bar and end_bar must be integers"}), 400

    if not job_id:
        return jsonify({"success": False, "error": "Missing job_id"}), 400
    if start_bar <= 0 or end_bar <= 0 or end_bar < start_bar:
        return jsonify({"success": False, "error": "Invalid bar range"}), 400

    job_dir = UPLOAD_DIR / job_id
    xml_path = job_dir / "score.musicxml"
    if not xml_path.exists():
        return jsonify({"success": False, "error": "score.musicxml not found for this job_id"}), 404

    audio_dir = job_dir / "audio" / instrument_key
    audio_dir.mkdir(parents=True, exist_ok=True)

    key = f"{start_bar}-{end_bar}"
    midi_fp = audio_dir / f"group_{start_bar}_{end_bar}.mid"
    wav_fp = audio_dir / f"group_{start_bar}_{end_bar}.wav"

    base = PUBLIC_URL or "http://localhost:5000"
    if wav_fp.exists():
        return jsonify({
            "success": True,
            "group_key": key,
            "wav_url": f"{base}/file/{job_id}/audio/{instrument_key}/group_{start_bar}_{end_bar}.wav",
        })

    try:
        score = converter.parse(str(xml_path))
        apply_instrument_to_score(score, instrument_key)
        slice_score = score_slice_measures(score, start_bar, end_bar)
        apply_instrument_to_score(slice_score, instrument_key)
        render_score_to_midi_and_wav(slice_score, midi_fp, wav_fp)

        return jsonify({
            "success": True,
            "group_key": key,
            "wav_url": f"{base}/file/{job_id}/audio/{instrument_key}/group_{start_bar}_{end_bar}.wav",
        })
    except Exception as e:
        return jsonify({"success": False, "error": f"Group audio render failed: {str(e)}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
