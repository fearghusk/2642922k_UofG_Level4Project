import "@testing-library/jest-native/extend-expect";

jest.mock("expo-speech", () => ({
  stop: jest.fn(),
  speak: jest.fn(),
}));

const mockSound = {
  stopAsync: jest.fn(),
  unloadAsync: jest.fn(),
  setOnPlaybackStatusUpdate: jest.fn(),
};

jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: jest.fn(),
    Sound: {
      createAsync: jest.fn(async () => ({ sound: mockSound })),
    },
  },
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: {
    Images: "Images",
  },
}));

jest.mock(
  "react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo",
  () => ({
    announceForAccessibility: jest.fn(),
  })
);