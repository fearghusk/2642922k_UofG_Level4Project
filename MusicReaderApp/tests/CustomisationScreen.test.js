import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import CustomisationScreen from "../screens/CustomisationScreen";

describe("CustomisationScreen", () => {
  const makeProps = (overrides = {}) => ({
    route: {
      params: {
        backendBaseUrl: "http://test-server",
        jobId: "job-123",
        doc: { title: "Test score" },
        ...overrides,
      },
    },
    navigation: {
      navigate: jest.fn(),
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("renders the customisation controls", () => {
    const props = makeProps();

    const { getByText } = render(<CustomisationScreen {...props} />);

    expect(getByText("Customise output")).toBeTruthy();
    expect(getByText("Speech speed")).toBeTruthy();
    expect(getByText("Bars grouped together")).toBeTruthy();
    expect(getByText("NATO note spelling")).toBeTruthy();
    expect(getByText("Notes only")).toBeTruthy();
    expect(getByText("Playback instrument")).toBeTruthy();
    expect(getByText("Continue to results")).toBeTruthy();
  });

  it("toggles NATO note spelling on and off", () => {
    const props = makeProps();

    const { getAllByText } = render(<CustomisationScreen {...props} />);

    const offButtons = getAllByText("Off");
    fireEvent.press(offButtons[0]);

    expect(getAllByText("On").length).toBeGreaterThan(0);
  });

  it("toggles notes only mode on and off", () => {
    const props = makeProps();

    const { getAllByText } = render(<CustomisationScreen {...props} />);

    const offButtons = getAllByText("Off");
    fireEvent.press(offButtons[1]);

    expect(getAllByText("On").length).toBeGreaterThan(0);
  });

  it("shows a setup warning when required route params are missing", () => {
    const props = {
      route: { params: {} },
      navigation: { navigate: jest.fn() },
    };

    const { getByText } = render(<CustomisationScreen {...props} />);

    expect(
      getByText(
        "This screen needs backendBaseUrl, jobId, and doc passed from the upload step."
      )
    ).toBeTruthy();
  });

  it("navigates to Result after successful audio generation", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          success: true,
          audio: {
            whole: {
              wav_url: "http://test-server/audio/whole.wav",
            },
          },
        }),
    });

    const props = makeProps();

    const { getByText } = render(<CustomisationScreen {...props} />);

    fireEvent.press(getByText("Continue to results"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://test-server/render_audio",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_id: "job-123",
            instrument: "piano",
          }),
        })
      );
    });

    await waitFor(() => {
      expect(props.navigation.navigate).toHaveBeenCalledWith(
        "Result",
        expect.objectContaining({
          backendUrl: "http://test-server",
          jobId: "job-123",
          wholeAudioUrl: "http://test-server/audio/whole.wav",
          settings: expect.objectContaining({
            speechRate: 1,
            barsPerGroup: 1,
            useNato: false,
            notesOnly: false,
            instrument: "piano",
          }),
          doc: expect.objectContaining({
            title: "Test score",
            audio: expect.any(Object),
          }),
        })
      );
    });
  });

  it("shows an error if the audio request fails", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          success: false,
          error: "Audio render failed.",
        }),
    });

    const props = makeProps();

    const { getByText } = render(<CustomisationScreen {...props} />);

    fireEvent.press(getByText("Continue to results"));

    await waitFor(() => {
      expect(getByText("Audio render failed.")).toBeTruthy();
    });

    expect(props.navigation.navigate).not.toHaveBeenCalled();
  });
});