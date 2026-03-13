
# Note Narrator

Note Narrator is a mobile application designed to make sheet music more accessible to visually impaired musicians. The system converts sheet music into a structured talking score and generates audio descriptions that allow users to navigate and understand musical notation without relying on visual reading.

The application processes sheet music using Optical Music Recognition (OMR), converts the result into a structured textual representation, and generates audio playback of both the music and descriptive narration.

---

# Features

- Upload sheet music (PDF or image)
- Optical Music Recognition (OMR) using Audiveris
- Automatic generation of talking scores
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
3. The MusicXML file is transformed into a structured talking score JSON format.
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

The backend files are present on this repo but were written to be ran on Google Colab.

---

## Running the Backend in Google Colab

The backend is ran on **Google Colab** to take advantage of cloud compute resources.

Typical workflow:

1. Clone the repository
2. Install required packages
3. Start an ngrok tunnel
4. Run the Flask server


to set up backend run both cells in colab. You may need to create an ngrok authentication account.
**Google Colab link:** https://colab.research.google.com/drive/1Hlmr48cJnVLmjBFvmjGAGyLveo8Q8ZNH?usp=sharing



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
Enable IOS voiceover or Android Talkback to use accesbility features.

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
