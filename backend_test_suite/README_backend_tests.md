# Backend test suite

Place these files inside your repository like this:

- `backend/app.py` ← the test-friendly Flask app file
- `backend/tests/conftest.py`
- `backend/tests/test_api_basic.py`
- `backend/tests/test_api_audio.py`
- `backend/tests/test_talking_score_json.py`
- `backend/tests/data/sample.musicxml`

## Install test tools

```bash
pip install pytest pytest-cov flask flask-cors music21
```

## Run tests

From the project root:

```bash
pytest backend/tests
```

## Run coverage

```bash
pytest backend/tests --cov=backend/app.py --cov-report=term-missing --cov-report=html
```

If you later make `backend` a Python package with `backend/__init__.py`, you can use:

```bash
pytest backend/tests --cov=backend --cov-report=term-missing --cov-report=html
```
