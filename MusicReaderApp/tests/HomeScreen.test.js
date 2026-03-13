import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import HomeScreen from "../screens/HomeScreen";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

describe("HomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders upload and photo buttons", () => {
    const navigation = { navigate: jest.fn() };

    const { getByText } = render(<HomeScreen navigation={navigation} />);

    expect(getByText("📄 Upload PDF / Photo")).toBeTruthy();
    expect(getByText("📷 Take a Photo")).toBeTruthy();
  });

  it("navigates to Processing after picking a PDF file", async () => {
    const navigation = { navigate: jest.fn() };

    DocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///score.pdf",
          name: "score.pdf",
          mimeType: "application/pdf",
        },
      ],
    });

    const { getByText } = render(<HomeScreen navigation={navigation} />);

    fireEvent.press(getByText("📄 Upload PDF / Photo"));

    await waitFor(() => {
      expect(navigation.navigate).toHaveBeenCalledWith("Processing", {
        file: {
          uri: "file:///score.pdf",
          name: "score.pdf",
          type: "application/pdf",
        },
      });
    });
  });

  it("navigates to Processing after taking a photo", async () => {
    const navigation = { navigate: jest.fn() };

    ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
      granted: true,
    });

    ImagePicker.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///photo.jpg" }],
    });

    const { getByText } = render(<HomeScreen navigation={navigation} />);

    fireEvent.press(getByText("📷 Take a Photo"));

    await waitFor(() => {
      expect(navigation.navigate).toHaveBeenCalledWith("Processing", {
        file: {
          uri: "file:///photo.jpg",
          name: "photo.jpg",
          type: "image/jpeg",
        },
      });
    });
  });
});