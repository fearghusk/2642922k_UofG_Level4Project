
# Note Narrator

Note Narrator is a mobile application designed to make sheet music more accessible to visually impaired musicians. The system converts sheet music into a structured **talking score** and generates audio descriptions that allow users to navigate and understand musical notation without relying on visual reading.

The application processes sheet music using Optical Music Recognition (OMR), converts the result into a structured textual representation, and generates audio playback of both the music and descriptive narration.

---

# Features

- Upload sheet music (PDF or image)
- Optical Music Recognition (OMR) using **Audiveris**
- Automatic generation of **talking scores**
- Audio playback of musical passages
- Adjustable speech speed
- Grouped bar reading for easier navigation
- Optional NATO phonetic spelling for note names
- Accessible interface designed for screen reader users

---

# System Architecture

The system consists of two primary components:

### Frontend

A mobile application built with:

- React Native
- Expo

The frontend provides the user interface and accessibility features. It allows users to:

- Upload sheet music
- Configure playback settings
- Navigate talking score output
- Listen to generated audio

---

### Backend

A Python backend built with:

- Flask
- music21
- Audiveris
- FluidSynth

The backend performs the core processing pipeline:

1. Sheet music is uploaded to the server.
2. Optical Music Recognition converts the score into MusicXML.
3. The MusicXML file is transformed into a structured **talking score JSON format**.
4. MIDI and WAV audio are generated from the score.
5. The frontend retrieves the structured data and audio files for playback.

---

# Repository Structure

```
MusicReaderApp/           React Native mobile application
backend/                  Python backend service

backend/app.py            Flask API server
backend/musicAnalyser.py
backend/midiHandler.py
backend/talkingscoreslib.py
backend/talkingscore.html

backend/tests/            Backend test suite (pytest)
```

---

# Running the Frontend

Navigate to the frontend directory:

```
cd MusicReaderApp
```

Install dependencies:

```
npm install
```

Start the Expo development server:

```
npx expo start
```

You can then run the application using:

- Expo Go on a mobile device
- an Android emulator
- an iOS simulator

---

# Running the Backend

The backend can be run locally or using Google Colab.

---

## Local Setup

Install Python dependencies:

```
pip install flask flask-cors music21 pillow reportlab pdf2image
```

Run the backend server:

```
python backend/app.py
```

The server will start on:

```
http://localhost:5000
```

---

## Running the Backend in Google Colab

The backend can also be executed in **Google Colab** to take advantage of cloud compute resources.

Typical workflow:

1. Clone the repository
2. Install required packages
3. Start an ngrok tunnel
4. Run the Flask server

Example setup:

```python
!git clone <repository_url>
%cd note-narrator/backend

!pip install flask flask-cors pyngrok music21 pdf2image pillow reportlab
```

Start an ngrok tunnel:

```python
from pyngrok import ngrok
import os

public_url = ngrok.connect(5000).public_url
os.environ["PUBLIC_URL"] = public_url

print("Backend URL:", public_url)
```

Run the backend server:

```python
!python app.py
```

The printed URL can then be used by the frontend application.

---

# API Endpoints

The backend exposes the following REST endpoints.

### Health check

```
GET /health
```

Returns server status.

---

### Upload MusicXML

```
POST /upload
```

Uploads a MusicXML file and returns a structured talking score.

---

### Start OMR

```
POST /omr_start
```

Starts an asynchronous OMR job.

---

### Check OMR status

```
GET /omr_status/<job_id>
```

Returns the current status of an OMR job.

---

### Generate full audio

```
POST /render_audio
```

Generates full score audio playback.

---

### Generate audio for bar group

```
POST /render_group_audio
```

Generates audio for a selected range of bars.

---

# Testing

## Frontend Tests

Frontend tests are implemented using:

- Jest
- React Native Testing Library

Run tests:

```
npm test
```

Run test coverage:

```
npm run test:coverage
```

---

## Backend Tests

Backend tests are implemented using **pytest**.

Run backend tests:

```
pytest backend/tests
```

Generate coverage reports:

```
pytest --cov=backend
```

---

# Accessibility

Accessibility was a primary design goal for this project.

Implemented features include:

- screen reader announcements
- adjustable speech rate
- grouped bar reading
- optional NATO phonetic spelling for note names
- accessible button and control labels
- navigation designed for non-visual interaction

---

# Technologies Used

Frontend:

- React Native
- Expo
- Jest
- React Native Testing Library

Backend:

- Python
- Flask
- music21
- Audiveris
- FluidSynth

Infrastructure:

- Google Colab
- ngrok

---

# Project Context

This project was developed as part of a **Level 4 Computing Science project at the University of Glasgow**.

The aim of the project was to explore how digital music processing and accessible interface design can improve access to musical notation for visually impaired musicians.

---

# License

This project is provided for academic purposes.
