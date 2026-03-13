import * as DocumentPicker from "expo-document-picker";
import React, { useCallback } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

function getPickedFile(result) {
  if (!result) return null;
  if (result.type === "success") return result; // older API
  if (result.canceled === false && result.assets?.[0]) return result.assets[0]; // newer API
  return null;
}

export default function HomeScreen({ navigation }) {
  const takePhoto = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission denied", "Camera permission is required.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]) return;
      const photo = result.assets[0];

      navigation.navigate("Processing", {
        file: {
          uri: photo.uri,
          name: "photo.jpg",
          type: "image/jpeg",
        },
      });
    } catch (e) {
      Alert.alert("Error", e?.message || "Could not take photo.");
    }
  }, [navigation]);

  const pickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      const file = getPickedFile(result);
      if (!file) return;

      navigation.navigate("Processing", {
        file: {
          uri: file.uri,
          name: file.name || "input.pdf",
          type:
            file.mimeType ||
            (file.name?.toLowerCase().endsWith(".pdf")
              ? "application/pdf"
              : "image/png"),
        },
      });
    } catch (e) {
      Alert.alert("Error", e?.message || "Could not pick a file.");
    }
  }, [navigation]);

  return (
    <View style={styles.container} accessible={false}>
      <Text style={styles.title} accessibilityRole="header">
        Music Reader
      </Text>
      <Text style={styles.subtitle}>
        Upload a PDF or photo of sheet music to generate a talking score.
      </Text>

      <Pressable
        style={styles.button}
        onPress={pickFile}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Upload sheet music"
        accessibilityHint="Opens a file picker to choose a PDF or an image."
        accessibilityState={{ disabled: false }}
        hitSlop={10}
      >
        <Text style={styles.buttonText}>📄 Upload PDF / Photo</Text>
      </Pressable>

      <View style={{ height: 16 }} />

      <Pressable
        style={styles.button}
        onPress={takePhoto}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Take a photo of sheet music"
        accessibilityHint="Opens the camera to take a picture, then starts processing."
        accessibilityState={{ disabled: false }}
        hitSlop={10}
      >
        <Text style={styles.buttonText}>📷 Take a Photo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 10 },
  subtitle: { fontSize: 16, textAlign: "center", marginBottom: 18 },
  button: { width: "90%", padding: 14, borderRadius: 12, backgroundColor: "#111827", alignItems: "center" },
  buttonText: { color: "white", fontSize: 16, fontWeight: "700" },
});
