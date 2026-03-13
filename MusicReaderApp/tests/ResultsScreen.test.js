import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import ResultScreen from "../screens/ResultScreen";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";

const makeDoc = () => ({
  basic_information: {
    title: "Test Piece",
    composer: "Test Composer",
    time_signature: "4/4",
    key_signature: "C major",
    tempo: "120 bpm",
  },
  general_summary: "Short summary",
  music_segments: [
    {
      start_bar: 1,
      end_bar: 2,
      instruments: [
        {
          instrument_index: 0,
          instrument_name: "Score",
          parts: [
            {
              part_index: 0,
              part_name: "Part 0",
              bars: [
                {
                  bar: 1,
                  beats: [
                    { beat: 1, text: "Beat 1: C4 quarter." },
                    { beat: 2, text: "Beat 2: D4 quarter." },
                  ],
                  time_and_keys: ["Time signature: 4/4", "Key signature: C major"],
                },
                {
                  bar: 2,
                  beats: [
                    { beat: 1, text: "Beat 1: E4 quarter." },
                    { beat: 2, text: "Beat 2: F#4 quarter." },
                  ],
                  time_and_keys: [],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

describe("ResultScreen", () => {
  const makeProps = (overrides = {}) => ({
    route: {
      params: {
        doc: makeDoc(),
        settings: {
          speechRate: 1,
          barsPerGroup: 1,
          useNato: false,
          notesOnly: false,
          instrument: "piano",
        },
        backendUrl: "http://test-server",
        jobId: "job-123",
        wholeAudioUrl: "http://test-server/audio/whole.wav",
        ...overrides,
      },
    },
    navigation: {
      goBack: jest.fn(),
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("shows fallback text when no document is provided", () => {
    const props = {
      route: { params: {} },
      navigation: { goBack: jest.fn() },
    };

    const { getByText } = render(<ResultScreen {...props} />);

    expect(getByText("No result")).toBeTruthy();
    expect(
      getByText("No structured talking score document was returned.")
    ).toBeTruthy();
  });

  it("renders grouped bars from the document", () => {
    const props = makeProps();

    const { getByText } = render(<ResultScreen {...props} />);

    expect(getByText("Talking Score")).toBeTruthy();
    expect(getByText("Bar groups")).toBeTruthy();
    expect(getByText("Bar 1")).toBeTruthy();
    expect(getByText("Bar 2")).toBeTruthy();
    expect(getByText("Title: Test Piece")).toBeTruthy();
  });

  it("expands a bar group and reveals its text", () => {
    const props = makeProps();

    const { getByText, queryByText } = render(<ResultScreen {...props} />);

    expect(queryByText(/C4 quarter, D4 quarter/i)).toBeNull();

    fireEvent.press(getByText("Bar 1"));

    expect(
      getByText("Bar 1. Key signature C major. Time signature 4/4. C4 quarter, D4 quarter")
    ).toBeTruthy();
  });

  it("renders notes-only text when notesOnly mode is enabled", () => {
    const props = makeProps({
      settings: {
        speechRate: 1,
        barsPerGroup: 1,
        useNato: false,
        notesOnly: true,
        instrument: "piano",
      },
    });

    const { getByText } = render(<ResultScreen {...props} />);

    fireEvent.press(getByText("Bar 1"));

    expect(getByText("Bar 1: C, D")).toBeTruthy();
  });

  it("calls speech synthesis when Read is pressed", async () => {
    const props = makeProps();

    const { getAllByText } = render(<ResultScreen {...props} />);

    fireEvent.press(getAllByText("Read")[0]);

    await waitFor(() => {
      expect(Speech.stop).toHaveBeenCalled();
      expect(Speech.speak).toHaveBeenCalledWith(
        expect.stringContaining("Bar 1."),
        expect.objectContaining({
          language: "en-GB",
          rate: 1,
          onError: expect.any(Function),
        })
      );
    });
  });

  it("requests and plays group audio when Play is pressed", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          success: true,
          wav_url: "http://test-server/audio/group_1_1.wav",
        }),
    });

    const props = makeProps();

    const { getAllByText } = render(<ResultScreen {...props} />);

    fireEvent.press(getAllByText("Play")[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://test-server/render_group_audio",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_id: "job-123",
            instrument: "piano",
            start_bar: 1,
            end_bar: 1,
          }),
        })
      );
    });

    await waitFor(() => {
      expect(Audio.setAudioModeAsync).toHaveBeenCalled();
      expect(Audio.Sound.createAsync).toHaveBeenCalledWith(
        { uri: "http://test-server/audio/group_1_1.wav" },
        { shouldPlay: true }
      );
    });
  });

  it("goes back when Back is pressed", () => {
    const props = makeProps();

    const { getByText } = render(<ResultScreen {...props} />);

    fireEvent.press(getByText("← Back"));

    expect(props.navigation.goBack).toHaveBeenCalled();
  });
});