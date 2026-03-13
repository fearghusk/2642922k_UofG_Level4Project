import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  AccessibilityInfo,
} from "react-native";

const INSTRUMENTS = [
  { label: "Piano", value: "piano" },
  { label: "Guitar", value: "guitar" },
  { label: "Violin", value: "violin" },
  { label: "Cello", value: "cello" },
  { label: "Flute", value: "flute" },
  { label: "Clarinet", value: "clarinet" },
];

function safeString(x) {
  if (x === null || x === undefined) return "";
  return String(x);
}

export default function CustomisationScreen({ route, navigation }) {
  const { backendBaseUrl, jobId, doc } = route?.params || {};

  const [speechRate, setSpeechRate] = useState(1.0);
  const [barsPerGroup, setBarsPerGroup] = useState(1);
  const [useNato, setUseNato] = useState(false);
  const [notesOnly, setNotesOnly] = useState(false);
  const [instrument, setInstrument] = useState("piano");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const canContinue = useMemo(
    () => !!backendBaseUrl && !!jobId && !!doc,
    [backendBaseUrl, jobId, doc]
  );

  const step = (val, delta, min, max) => Math.max(min, Math.min(max, val + delta));

  const announce = async (message) => {
    try {
      await AccessibilityInfo.announceForAccessibility(message);
    } catch {
      // ignore
    }
  };

  // Announce errors when they appear
  useEffect(() => {
    if (err) announce(`Error. ${err}`);
  }, [err]);

  // Announce busy state changes (optional but helpful)
  useEffect(() => {
    if (busy) announce("Preparing audio. Please wait.");
  }, [busy]);

  const renderAudio = async () => {
    const url = `${backendBaseUrl}/render_audio`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, instrument }),
    });

    const raw = await resp.text();
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error(`Server returned non-JSON (HTTP ${resp.status}).`);
    }

    if (!resp.ok || !json.success) {
      throw new Error(json.error || `Audio render failed (HTTP ${resp.status}).`);
    }
    return json.audio;
  };

  const onContinue = async () => {
    setErr("");
    if (!canContinue) {
      setErr("Missing backendBaseUrl, jobId, or doc from previous step.");
      return;
    }

    setBusy(true);
    try {
      const audio = await renderAudio();
      const nextDoc = { ...doc, audio };

      const settings = { speechRate, barsPerGroup, useNato, notesOnly, instrument };
      const wholeAudioUrl = safeString(audio?.whole?.wav_url);

      await announce("Audio ready. Opening results.");
      navigation.navigate("Result", {
        doc: nextDoc,
        settings,
        backendUrl: backendBaseUrl,
        jobId,
        wholeAudioUrl,
      });
    } catch (e) {
      setErr(safeString(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.outer} accessible={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          Customise output
        </Text>

        {!canContinue ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            This screen needs backendBaseUrl, jobId, and doc passed from the upload step.
          </Text>
        ) : null}

        {/* Speech rate */}
        <View
          style={styles.card}
          accessible={false}
          accessibilityRole="summary"
          accessibilityLabel={`Speech speed. Current value ${speechRate.toFixed(1)} times.`}
        >
          <Text style={styles.cardTitle}>Speech speed</Text>
          <Text style={styles.valueText} accessibilityLiveRegion="polite">
            {speechRate.toFixed(1)}x
          </Text>

          <View style={styles.row} accessible={false}>
            <Pressable
              style={styles.btn}
              onPress={() =>
                setSpeechRate((v) => {
                  const next = step(v, -0.1, 0.5, 2.0);
                  announce(`Speech speed ${next.toFixed(1)} times`);
                  return next;
                })
              }
              accessible={false}
              accessibilityRole="button"
              accessibilityLabel="Decrease speech speed"
              accessibilityHint="Reduces speech speed by 0.1."
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              hitSlop={10}
            >
              <Text style={styles.btnText}>Slower</Text>
            </Pressable>

            <Pressable
              style={styles.btn}
              onPress={() =>
                setSpeechRate((v) => {
                  const next = step(v, +0.1, 0.5, 2.0);
                  announce(`Speech speed ${next.toFixed(1)} times`);
                  return next;
                })
              }
              accessible={false}
              accessibilityRole="button"
              accessibilityLabel="Increase speech speed"
              accessibilityHint="Increases speech speed by 0.1."
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              hitSlop={10}
            >
              <Text style={styles.btnText}>Faster</Text>
            </Pressable>
          </View>
        </View>

        {/* Bars per group */}
        <View
          style={styles.card}
          accessible={false}
          accessibilityRole="summary"
          accessibilityLabel={`Bars grouped together. Current value ${barsPerGroup}.`}
        >
          <Text style={styles.cardTitle}>Bars grouped together</Text>
          <Text style={styles.valueText} accessibilityLiveRegion="polite">
            {barsPerGroup}
          </Text>

          <View style={styles.row} accessible={false}>
            <Pressable
              style={styles.btn}
              onPress={() =>
                setBarsPerGroup((v) => {
                  const next = step(v, -1, 1, 16);
                  announce(`Bars grouped together ${next}`);
                  return next;
                })
              }
              accessible={false}
              accessibilityRole="button"
              accessibilityLabel="Decrease bars grouped together"
              accessibilityHint="Reduces the number of bars in each group by 1."
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              hitSlop={10}
            >
              <Text style={styles.btnText}>-</Text>
            </Pressable>

            <Pressable
              style={styles.btn}
              onPress={() =>
                setBarsPerGroup((v) => {
                  const next = step(v, +1, 1, 16);
                  announce(`Bars grouped together ${next}`);
                  return next;
                })
              }
              accessible={false}
              accessibilityRole="button"
              accessibilityLabel="Increase bars grouped together"
              accessibilityHint="Increases the number of bars in each group by 1."
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              hitSlop={10}
            >
              <Text style={styles.btnText}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* NATO spelling */}
        <View style={styles.card} accessible={false}>
          <Text style={styles.cardTitle}>NATO note spelling</Text>
          <Text style={styles.subText}>
            When enabled, notes will be spoken using NATO equivalents (A=Alpha, B=Bravo, etc.).
          </Text>

          <Pressable
            style={[styles.btn, useNato ? styles.btnOn : null]}
            onPress={() => {
              setUseNato((v) => {
                const next = !v;
                announce(`NATO note spelling ${next ? "on" : "off"}`);
                return next;
              });
            }}
            accessible={false}
            accessibilityRole="switch"
            accessibilityLabel="NATO note spelling"
            accessibilityHint="Double tap to toggle."
            accessibilityState={{ checked: useNato, disabled: busy }}
            disabled={busy}
            hitSlop={10}
          >
            <Text style={[styles.btnText, useNato ? styles.btnTextOn : null]}>
              {useNato ? "On" : "Off"}
            </Text>
          </Pressable>
        </View>

        {/* Notes only mode */}
        <View style={styles.card} accessible={false}>
          <Text style={styles.cardTitle}>Notes only</Text>
          <Text style={styles.subText}>
            When enabled, reading a bar says only the note names (e.g. "A, C sharp, D") with no beat numbers or rhythm labels.
          </Text>

          <Pressable
            style={[styles.btn, notesOnly ? styles.btnOn : null]}
            onPress={() => {
              setNotesOnly((v) => {
                const next = !v;
                announce(`Notes only ${next ? "on" : "off"}`);
                return next;
              });
            }}
            accessible={false}
            accessibilityRole="switch"
            accessibilityLabel="Notes only"
            accessibilityHint="Double tap to toggle."
            accessibilityState={{ checked: notesOnly, disabled: busy }}
            disabled={busy}
            hitSlop={10}
          >
            <Text style={[styles.btnText, notesOnly ? styles.btnTextOn : null]}>
              {notesOnly ? "On" : "Off"}
            </Text>
          </Pressable>
        </View>

        {/* Instrument (radio group style) */}
        <View style={styles.card} accessible={false}>
          <Text style={styles.cardTitle}>Playback instrument</Text>
          <Text style={styles.subText}>
            Choose the instrument for playback audio. Current selection:{" "}
            {INSTRUMENTS.find((i) => i.value === instrument)?.label || "Unknown"}.
          </Text>

          <View
            style={styles.rowWrap}
            accessible={false}
            accessibilityRole="radiogroup"
            accessibilityLabel="Playback instrument options"
          >
            {INSTRUMENTS.map((opt) => {
              const selected = instrument === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.pill, selected ? styles.pillOn : null]}
                  onPress={() => {
                    setInstrument(opt.value);
                    announce(`Instrument ${opt.label} selected`);
                  }}
                  accessible={false}
                  accessibilityRole="radio"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected, disabled: busy }}
                  accessibilityHint="Double tap to select this instrument."
                  disabled={busy}
                  hitSlop={10}
                >
                  <Text style={[styles.pillText, selected ? styles.pillTextOn : null]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {!!err ? (
          <Text style={styles.error} accessibilityLiveRegion="assertive">
            {err}
          </Text>
        ) : null}

        <Pressable
          style={[styles.primary, (!canContinue || busy) ? styles.primaryDisabled : null]}
          onPress={onContinue}
          disabled={!canContinue || busy}
          accessible={false}
          accessibilityRole="button"
          accessibilityLabel={busy ? "Preparing audio" : "Continue to results"}
          accessibilityHint="Creates the audio and opens the results screen."
          accessibilityState={{ disabled: !canContinue || busy, busy }}
          hitSlop={10}
        >
          <Text style={styles.primaryText}>
            {busy ? "Preparing audio..." : "Continue to results"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 18, paddingBottom: 30 },
  title: { fontSize: 22, fontWeight: "900", color: "#111827", marginBottom: 12 },

  card: { backgroundColor: "white", borderRadius: 14, padding: 14, marginTop: 12 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#111827", marginBottom: 6 },
  subText: { fontSize: 13, lineHeight: 18, color: "#4B5563", marginBottom: 10 },
  valueText: { fontSize: 18, fontWeight: "900", color: "#111827", marginBottom: 8 },

  row: { flexDirection: "row", gap: 10 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  btn: { backgroundColor: "#E5E7EB", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, alignItems: "center" },
  btnOn: { backgroundColor: "#111827" },
  btnText: { fontWeight: "800", color: "#111827" },
  btnTextOn: { color: "white" },

  pill: { backgroundColor: "#E5E7EB", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 },
  pillOn: { backgroundColor: "#111827" },
  pillText: { fontWeight: "800", color: "#111827" },
  pillTextOn: { color: "white" },

  primary: { marginTop: 16, backgroundColor: "#111827", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: "white", fontWeight: "900" },

  error: { marginTop: 12, color: "#B91C1C", fontWeight: "700" },
});
