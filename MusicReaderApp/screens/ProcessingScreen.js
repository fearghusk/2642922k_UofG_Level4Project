import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  AccessibilityInfo,
  Platform,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";

const BACKEND_BASE_URL = "https://unscarved-solutus-gavyn.ngrok-free.dev";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function ProcessingScreen({ route, navigation }) {
  const file = route?.params?.file;
  const [status, setStatus] = useState("Starting…");

  // Helper: announces on both iOS + Android
  const announce = async (message) => {
    try {
      // Small delay helps ensure SR picks it up, especially before navigation changes
      await sleep(150);
      await AccessibilityInfo.announceForAccessibility(message);
    } catch {
      // ignore if SR not available
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (!file?.uri) throw new Error("No file provided to ProcessingScreen.");

        setStatus("Checking backend…");
        const health = await fetch(`${BACKEND_BASE_URL}/health`, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        if (!health.ok) throw new Error(`Backend health check failed (HTTP ${health.status}).`);

        setStatus("Uploading file…");

        const startRes = await FileSystem.uploadAsync(`${BACKEND_BASE_URL}/omr_start`, file.uri, {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: "file",
          mimeType: file.type || "application/octet-stream",
          headers: {
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        });

        let startJson;
        try {
          startJson = JSON.parse(startRes.body);
        } catch {
          throw new Error(
            `Server returned non-JSON (HTTP ${startRes.status}): ${String(startRes.body).slice(0, 160)}`
          );
        }

        if (startRes.status < 200 || startRes.status >= 300 || !startJson?.success) {
          throw new Error(startJson?.error || `Failed to start OMR (HTTP ${startRes.status}).`);
        }

        const jobId = startJson.job_id;
        if (!jobId) throw new Error("Backend did not return job_id.");

        setStatus("Running OMR…");

        for (let attempt = 0; attempt < 600; attempt++) {
          if (cancelled) return;

          const stRes = await fetch(`${BACKEND_BASE_URL}/omr_status/${jobId}`, {
            headers: { "ngrok-skip-browser-warning": "true" },
          });

          const raw = await stRes.text();
          let stJson = null;
          try {
            stJson = JSON.parse(raw);
          } catch {
            throw new Error(`Status returned non-JSON: ${raw.slice(0, 160)}`);
          }

          if (!stRes.ok) {
            throw new Error(stJson?.error || `Status check failed (HTTP ${stRes.status}).`);
          }

          if (stJson.status === "done" && stJson.data) {
            setStatus("Processing finished.");
            await announce("Processing finished. Opening customise screen.");
            navigation.replace("Customise", {
              backendBaseUrl: BACKEND_BASE_URL,
              jobId,
              doc: stJson.data,
            });
            return;
          }

          if (stJson.status === "error") {
            throw new Error(stJson.error || "OMR failed.");
          }

          setStatus(stJson.progress || `Running OMR… (${attempt}s)`);
          await sleep(1000);
        }

        throw new Error("OMR timed out (took too long).");
      } catch (e) {
        console.log("❌ ProcessingScreen error:", e?.message || e);
        if (!cancelled) {
          const msg = e?.message || "Unknown error";
          setStatus(`Error: ${msg}`);
          await announce(`Error. ${msg}`);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []); // (optional: include file/navi if you prefer, but not required here)

  return (
    <View style={styles.container}>
      <ActivityIndicator
        size="large"
        accessibilityRole="progressbar"
        accessibilityLabel="Processing"
        accessibilityHint="Please wait while your sheet music is processed."
      />

      {/* Live region: reads status updates. On iOS, "polite" isn't used the same way,
          but Text + announceForAccessibility covers it. */}
      <View accessible={true} accessibilityLiveRegion="polite" accessibilityLabel={status}>
        <Text style={styles.text} accessible={false}>
          {status}
        </Text>
      </View>

      {file?.uri ? (
        <Text style={styles.small} accessibilityLabel="File selected for upload">
          Uploading: {file.uri}
        </Text>
      ) : null}

      <Text style={styles.small} accessibilityLabel="Backend server address">
        Backend: {BACKEND_BASE_URL}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  text: { marginTop: 16, fontSize: 16, textAlign: "center", fontWeight: "600" },
  small: { marginTop: 10, fontSize: 12, color: "#6B7280", textAlign: "center" },
});