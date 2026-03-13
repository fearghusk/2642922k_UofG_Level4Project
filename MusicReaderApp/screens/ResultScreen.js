import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  AccessibilityInfo,
} from "react-native";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";

function safeString(x) {
  if (x === null || x === undefined) return "";
  return String(x);
}

async function announce(message) {
  try {
    await AccessibilityInfo.announceForAccessibility(message);
  } catch {
    // ignore
  }
}

function speakText(text, { language = "en-GB", rate = 1.0 } = {}) {
  Speech.stop();
  const t = safeString(text).trim();
  if (!t) return;
  Speech.speak(t, { language, rate, onError: () => {} });
}

function applyNatoToSpeech(text) {
  const NATO = {
    A: "Alpha",
    B: "Bravo",
    C: "Charlie",
    D: "Delta",
    E: "Echo",
    F: "Foxtrot",
    G: "Golf",
  };

  return safeString(text).replace(/\b([A-G])\s*([#b♯♭])?\b/g, (match, letter, acc) => {
    const name = NATO[letter] || letter;
    const accidental = acc ? (acc === "#" || acc === "♯" ? " sharp" : " flat") : "";
    return `${name}${accidental}`;
  });
}

// Extracts only pitch names from a bar text string, e.g. "A, C sharp, D"
function extractNotesOnly(barText) {
  const notePattern = /\b([A-G](?:\s*(?:sharp|flat|#|b))?(?:\d)?)\b/gi;
  const matches = [];
  let m;
  while ((m = notePattern.exec(barText)) !== null) {
    // Normalise: "C#" -> "C sharp", trim octave number
    let note = m[1]
      .replace(/#/g, " sharp")
      .replace(/\bb\b/g, " flat")
      .replace(/\s+/g, " ")
      .replace(/\s*\d$/, "") // strip octave digit
      .trim();
    // Avoid duplicating consecutive identical notes
    if (matches[matches.length - 1] !== note) {
      matches.push(note);
    }
  }
  return matches.join(", ");
}

function isKnownValue(v) {
  const t = safeString(v).trim();
  if (!t) return false;
  if (/unknown/i.test(t)) return false;
  return true;
}

function flattenBeatTextForBar(barObj) {
  const beats = barObj?.beats || [];
  return beats
    .map((b) => {
      // Strip "Beat 1:", "Beat 2.5:", etc. — just keep the note content
      const raw = safeString(b?.text).trim();
      return raw.replace(/^Beat\s+[\d.]+\s*:\s*/i, "").replace(/\.$/, "").trim();
    })
    .filter((t) => t && !/^\(no events\)$/i.test(t))
    .join(", ");
}

function extractTimeSignature(timeAndKeysArr) {
  const joined = (timeAndKeysArr || []).map((x) => safeString(x)).join(" ");
  const m = joined.match(/time\s*signature[: ]+(\d+\s*\/\s*\d+)/i);
  if (m?.[1]) return m[1].replace(/\s/g, "");
  const m2 = joined.match(/(\d+\s*\/\s*\d+)/);
  if (m2?.[1]) return m2[1].replace(/\s/g, "");
  return "";
}

function extractKeySignature(timeAndKeysArr) {
  const joined = (timeAndKeysArr || []).map((x) => safeString(x)).join(" ");
  const m1 = joined.match(/key\s*signature[: ]+([A-G][#b]?\s*(major|minor)?)/i);
  if (m1?.[1]) return m1[1].trim();
  const m2 = joined.match(/\bkey[: ]+([A-G][#b]?\s*(major|minor)?)/i);
  if (m2?.[1]) return m2[1].trim();
  const m3 = joined.match(/\b([A-G][#b]?\s*(major|minor))\b/i);
  if (m3?.[1]) return m3[1].trim();
  return "";
}

function renderBasicInformation(bi) {
  const title = bi?.title || bi?.Title || "";
  const composer = bi?.composer || bi?.Composer || "";
  const timeSig = bi?.time_signature || bi?.timeSignature || bi?.["Time signature"] || "";
  const keySig = bi?.key_signature || bi?.keySignature || bi?.Key || "";
  const tempo = bi?.tempo || bi?.Tempo || "";

  const lines = [];
  if (title) lines.push(`Title: ${title}`);
  if (composer) lines.push(`Composer: ${composer}`);
  if (timeSig) lines.push(`Time signature: ${timeSig}`);
  if (keySig) lines.push(`Key: ${keySig}`);
  if (tempo) lines.push(`Tempo: ${tempo}`);

  if (lines.length === 0 && bi && typeof bi === "object") {
    for (const [k, v] of Object.entries(bi)) lines.push(`${k}: ${v}`);
  }
  return lines;
}

function buildFlatBars(doc, fallbackKey, fallbackTime) {
  const byKey = new Map();

  for (const seg of doc?.music_segments || []) {
    const segStart = Number(seg?.start_bar);
    const segEnd = Number(seg?.end_bar);

    for (const inst of seg?.instruments || []) {
      for (const part of inst?.parts || []) {
        for (const barObj of part?.bars || []) {
          const barNum = barObj?.bar;
          if (barNum === undefined || barNum === null) continue;

          const k = `${segStart}-${segEnd}:${String(barNum)}`;

          const tsRaw = extractTimeSignature(barObj?.time_and_keys) || fallbackTime;
          const ksRaw = extractKeySignature(barObj?.time_and_keys) || fallbackKey;

          const timeSig = isKnownValue(tsRaw) ? safeString(tsRaw).trim() : "";
          const keySig = isKnownValue(ksRaw) ? safeString(ksRaw).trim() : "";

          const barText = flattenBeatTextForBar(barObj);

          const existing = byKey.get(k);
          if (!existing) {
            byKey.set(k, { segStart, segEnd, barNum, timeSig, keySig, barText });
          } else {
            if (!existing.timeSig && timeSig) existing.timeSig = timeSig;
            if (!existing.keySig && keySig) existing.keySig = keySig;
            if ((barText || "").length > (existing.barText || "").length) existing.barText = barText;
          }
        }
      }
    }
  }

  const arr = Array.from(byKey.values());
  arr.sort((a, b) => {
    const as = Number.isFinite(a.segStart) ? a.segStart : 0;
    const bs = Number.isFinite(b.segStart) ? b.segStart : 0;
    if (as !== bs) return as - bs;

    const an = Number(a.barNum);
    const bn = Number(b.barNum);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return String(a.barNum).localeCompare(String(b.barNum));
  });

  return arr;
}

function buildGroups(flatBars, groupSize) {
  const n = Math.max(1, Number(groupSize) || 1);
  const out = [];

  for (let startIdx = 0; startIdx < flatBars.length; startIdx += n) {
    const endIdx = Math.min(flatBars.length - 1, startIdx + n - 1);
    const slice = flatBars.slice(startIdx, endIdx + 1);
    if (!slice.length) continue;

    const first = slice[0];
    const last = slice[slice.length - 1];

    out.push({
      startIdx,
      endIdx,
      bars: slice,
      startBarNum: first.barNum,
      endBarNum: last.barNum,
      key: `${first.segStart}-${first.segEnd}:${first.barNum}-${last.barNum}:${startIdx}`,
    });
  }

  return out;
}

export default function ResultScreen({ route, navigation }) {
  const doc = route?.params?.doc;
  const backendUrl = safeString(route?.params?.backendUrl).replace(/\/+$/, "");
  const jobId = safeString(route?.params?.jobId);
  const settings = route?.params?.settings || {};
  const wholeAudioUrl = safeString(route?.params?.wholeAudioUrl || "");

  const speechRate = settings?.speechRate ?? 1.0;
  const barsPerGroup = Math.max(1, Number(settings?.barsPerGroup ?? 1));
  const useNato = !!settings?.useNato;
  const notesOnly = !!settings?.notesOnly;
  const instrument = safeString(settings?.instrument || "piano").toLowerCase();

  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const [groupAudioCache, setGroupAudioCache] = useState(() => ({}));
  const [loadingGroupAudio, setLoadingGroupAudio] = useState(() => ({}));

  const soundRef = useRef(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const [uiStatus, setUiStatus] = useState(""); // SR live-region text (Android helps)

  useEffect(() => {
    console.log("✅ ResultScreen params:", { backendUrl, jobId, instrument, barsPerGroup, wholeAudioUrl });
  }, []);

  useEffect(() => {
    return () => {
      Speech.stop();
      (async () => {
        try {
          if (soundRef.current) {
            await soundRef.current.unloadAsync();
            soundRef.current = null;
          }
        } catch {}
      })();
    };
  }, []);

  const basicInfoLines = useMemo(() => renderBasicInformation(doc?.basic_information), [doc]);
  const generalSummary = useMemo(() => safeString(doc?.general_summary || "").trim(), [doc]);

  const fallbackTimeSig = useMemo(() => {
    const bi = doc?.basic_information;
    return safeString(bi?.time_signature || bi?.timeSignature || bi?.["Time signature"] || "").trim();
  }, [doc]);

  const fallbackKeySig = useMemo(() => {
    const bi = doc?.basic_information;
    return safeString(bi?.key_signature || bi?.keySignature || bi?.Key || "").trim();
  }, [doc]);

  const flatBars = useMemo(
    () => buildFlatBars(doc, fallbackKeySig, fallbackTimeSig),
    [doc, fallbackKeySig, fallbackTimeSig]
  );
  const groups = useMemo(() => buildGroups(flatBars, barsPerGroup), [flatBars, barsPerGroup]);

  // ---- Audio helpers ----
  const stopAudio = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch {}
    setIsPlayingAudio(false);
    setUiStatus("Audio stopped.");
    announce("Audio stopped.");
  };

  const playAudioUrl = async (url, announceLabel = "audio") => {
    const u = safeString(url).trim();
    if (!u) return;

    await stopAudio();

    try {
      setUiStatus(`Loading ${announceLabel}.`);
      await announce(`Loading ${announceLabel}.`);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      const { sound } = await Audio.Sound.createAsync({ uri: u }, { shouldPlay: true });

      soundRef.current = sound;
      setIsPlayingAudio(true);

      setUiStatus(`Playing ${announceLabel}.`);
      await announce(`Playing ${announceLabel}.`);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status?.isLoaded) return;
        if (status.didJustFinish) {
          setIsPlayingAudio(false);
          setUiStatus("Playback finished.");
          announce("Playback finished.");
          sound.unloadAsync().catch(() => {});
          if (soundRef.current === sound) soundRef.current = null;
        }
      });
    } catch (e) {
      setIsPlayingAudio(false);
      console.log("❌ playAudioUrl error:", e?.message || e);
      setUiStatus("Audio playback failed.");
      await announce("Audio playback failed.");
      speakText("Audio playback failed.", { language: "en-GB", rate: speechRate });
    }
  };

  async function ensureGroupAudio({ groupKey, startBar, endBar, announceLabel }) {
    if (groupAudioCache[groupKey]) return groupAudioCache[groupKey];

    if (!backendUrl || !jobId) {
      throw new Error("Missing backendUrl or jobId in ResultScreen params.");
    }

    setLoadingGroupAudio((p) => ({ ...p, [groupKey]: true }));
    setUiStatus(`Generating audio for ${announceLabel}.`);
    await announce(`Generating audio for ${announceLabel}.`);

    try {
      const res = await fetch(`${backendUrl}/render_group_audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, instrument, start_bar: startBar, end_bar: endBar }),
      });

      const raw = await res.text();
      let json = null;
      try {
        json = JSON.parse(raw);
      } catch {}

      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}: ${raw.slice(0, 120)}`);
      if (!json?.success) throw new Error(json?.error || "Backend returned success:false");

      const url = safeString(json.wav_url);
      if (!url) throw new Error("Backend returned success:true but no wav_url field.");

      setGroupAudioCache((p) => ({ ...p, [groupKey]: url }));
      setUiStatus(`Audio ready for ${announceLabel}.`);
      await announce(`Audio ready for ${announceLabel}.`);
      return url;
    } finally {
      setLoadingGroupAudio((p) => ({ ...p, [groupKey]: false }));
    }
  }

  const groupCombinedText = (g) => {
    let prevKey = "";
    let prevTime = "";

    const parts = g.bars.map((b) => {
      const rawBody = safeString(b.barText).trim();

      if (notesOnly) {
        // Just "Bar 3: A, C sharp, D"
        const notes = extractNotesOnly(rawBody);
        return `Bar ${b.barNum}: ${notes || "(no notes)"}`;
      }

      const prefix = [`Bar ${b.barNum}.`];
      if (b.keySig) {
        if (!prevKey || b.keySig !== prevKey) prefix.push(`Key signature ${b.keySig}.`);
        prevKey = b.keySig;
      }
      if (b.timeSig) {
        if (!prevTime || b.timeSig !== prevTime) prefix.push(`Time signature ${b.timeSig}.`);
        prevTime = b.timeSig;
      }
      return `${prefix.join(" ")} ${rawBody}`.trim();
    });

    let out = parts.join(" ");
    if (useNato) out = applyNatoToSpeech(out);
    return out;
  };

  const toggleGroup = async (key, label) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      const willOpen = !next.has(key);
      if (willOpen) next.add(key);
      else next.delete(key);

      // announce inside setState using computed value
      setUiStatus(willOpen ? `Expanded ${label}.` : `Collapsed ${label}.`);
      announce(willOpen ? `Expanded ${label}.` : `Collapsed ${label}.`);

      return next;
    });
  };

  if (!doc) {
    return (
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          No result
        </Text>
        <Text style={styles.body}>No structured talking score document was returned.</Text>
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Talking Score
        </Text>

        <View style={styles.controls} accessibilityRole="toolbar">
          <Pressable
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => navigation?.goBack?.()}
            accessible={false}
            accessibilityRole="button"
            accessibilityLabel="Back to customisation"
            accessibilityHint="Returns to the previous screen."
            hitSlop={10}
          >
            <Text style={styles.btnTextSecondary}>← Back</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnSecondary, !wholeAudioUrl ? styles.btnDisabled : null]}
            onPress={() => playAudioUrl(wholeAudioUrl, "the full piece")}
            accessible={false}
            accessibilityRole="button"
            accessibilityLabel="Play full piece"
            accessibilityHint={wholeAudioUrl ? "Plays the full score audio." : "Full audio is not available."}
            accessibilityState={{ disabled: !wholeAudioUrl, busy: false }}
            disabled={!wholeAudioUrl}
            hitSlop={10}
          >
            <Text style={styles.btnTextSecondary}>▶ Play full piece</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnSecondary, !isPlayingAudio ? styles.btnDisabled : null]}
            onPress={stopAudio}
            accessible={false}
            accessibilityRole="button"
            accessibilityLabel="Stop audio"
            accessibilityHint="Stops audio playback."
            accessibilityState={{ disabled: !isPlayingAudio }}
            disabled={!isPlayingAudio}
            hitSlop={10}
          >
            <Text style={styles.btnTextSecondary}>⏹ Stop audio</Text>
          </Pressable>
        </View>

        <Text style={styles.nowReading} accessibilityLiveRegion="polite">
          Group size: {barsPerGroup} · Instrument: {instrument}
          {useNato ? " · NATO on" : ""}
        </Text>

        {basicInfoLines?.length ? (
          <View style={styles.metaBox} accessible={false} accessibilityLabel="Score information">
            {basicInfoLines.map((l, idx) => (
              <Text key={String(idx)} style={styles.metaText}>
                {l}
              </Text>
            ))}
            {!!generalSummary ? (
              <Text style={[styles.metaText, { marginTop: 6 }]}>{generalSummary}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Screen-reader-only status (helps Android announce changes) */}
        <Text style={styles.srOnly} accessibilityLiveRegion="polite">
          {uiStatus}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card} accessible={false}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Bar groups
          </Text>
          <Text style={styles.cardSubText}>
            Tap a group to show text. Press Play to generate audio for that group.
          </Text>
        </View>

        {groups.map((g) => {
          const label =
            g.bars.length > 1 ? `bars ${g.startBarNum} to ${g.endBarNum}` : `bar ${g.startBarNum}`;

          const open = expandedGroups.has(g.key);
          const combined = groupCombinedText(g);
          const isLoading = !!loadingGroupAudio[g.key];

          const sigLine = (() => {
            const first = g.bars[0];
            const bits = [];
            if (first?.keySig) bits.push(`Key: ${first.keySig}`);
            if (first?.timeSig) bits.push(`Time: ${first.timeSig}`);
            return bits.join(" · ");
          })();

          return (
            <View key={g.key} style={styles.groupCard} accessible={false}>
              <Pressable
                style={styles.groupHeader}
                onPress={() => toggleGroup(g.key, label)}
                accessible={false}
                accessibilityRole="button"
                accessibilityLabel={`${open ? "Collapse" : "Expand"} ${label}`}
                accessibilityHint={open ? "Hides the text for this group." : "Shows the text for this group."}
                accessibilityState={{ expanded: open }}
                hitSlop={10}
              >
                <Text style={styles.groupTitle}>
                  {g.bars.length > 1
                    ? `Bars ${g.startBarNum}–${g.endBarNum}`
                    : `Bar ${g.startBarNum}`}
                </Text>
                <Text style={styles.chev}>{open ? "▾" : "▸"}</Text>
              </Pressable>

              {sigLine ? <Text style={styles.groupSigText}>{sigLine}</Text> : null}

              <View style={styles.inlineButtons} accessible={false}>
                <Pressable
                  style={styles.smallBtn}
                  onPress={() => {
                    announce(`Reading ${label}.`);
                    speakText(combined, { language: "en-GB", rate: speechRate });
                  }}
                  accessible={false}
                  accessibilityRole="button"
                  accessibilityLabel={`Read ${label}`}
                  accessibilityHint="Reads the notes in this group using the screen reader voice."
                  accessibilityState={{ disabled: false }}
                  hitSlop={10}
                >
                  <Text style={styles.smallBtnText}>Read</Text>
                </Pressable>

                <Pressable
                  style={[styles.smallBtn, isLoading ? styles.smallBtnDisabled : null]}
                  disabled={isLoading}
                  onPress={async () => {
                    try {
                      const url = await ensureGroupAudio({
                        groupKey: g.key,
                        startBar: Number(g.startBarNum),
                        endBar: Number(g.endBarNum),
                        announceLabel: label,
                      });
                      await playAudioUrl(url, label);
                    } catch (e) {
                      console.log("❌ GROUP AUDIO ERROR:", e?.message || e);
                      const msg = safeString(e?.message) || "Audio generation failed.";
                      await announce(`Error generating audio for ${label}. ${msg}`);
                      speakText(`Audio generation failed. ${msg}`, { language: "en-GB", rate: speechRate });
                    }
                  }}
                  accessible={false}
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${label}`}
                  accessibilityHint={isLoading ? "Generating audio, please wait." : "Generates and plays audio for this group."}
                  accessibilityState={{ disabled: isLoading, busy: isLoading }}
                  hitSlop={10}
                >
                  {isLoading ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <ActivityIndicator accessibilityLabel="Generating audio" />
                      <Text style={styles.smallBtnText}>Generating…</Text>
                    </View>
                  ) : (
                    <Text style={styles.smallBtnText}>Play</Text>
                  )}
                </Pressable>
              </View>

              {open ? (
                <View style={styles.groupBody} accessible={false} accessibilityLabel={`Text for ${label}`}>
                  <Text style={styles.groupText}>{combined}</Text>
                </View>
              ) : null}
            </View>
          );
        })}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  title: { fontSize: 22, fontWeight: "900", color: "#111827" },

  controls: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  nowReading: { marginTop: 8, fontSize: 12, color: "#4B5563" },

  metaBox: { marginTop: 10, backgroundColor: "white", borderRadius: 14, padding: 12 },
  metaText: { fontSize: 12, color: "#111827", lineHeight: 16 },

  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, alignItems: "center" },
  btnSecondary: { backgroundColor: "#E5E7EB" },
  btnTextSecondary: { color: "#111827", fontWeight: "800" },
  btnDisabled: { opacity: 0.6 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 24 },

  card: { backgroundColor: "white", borderRadius: 14, padding: 14, marginTop: 12 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#111827", marginBottom: 8 },
  cardSubText: { fontSize: 13, lineHeight: 18, color: "#4B5563" },

  groupCard: { backgroundColor: "white", borderRadius: 14, padding: 14, marginTop: 12 },
  groupHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  groupTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  chev: { fontSize: 18, color: "#111827" },

  groupSigText: { marginTop: 4, fontSize: 12, color: "#4B5563", fontWeight: "600" },

  inlineButtons: { flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" },
  smallBtn: { backgroundColor: "#E5E7EB", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  smallBtnDisabled: { opacity: 0.7 },
  smallBtnText: { fontWeight: "800", color: "#111827" },

  groupBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  groupText: { fontSize: 14, lineHeight: 20, color: "#111827" },

  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  body: { fontSize: 16, color: "#111827" },

  // visually hidden but readable by SR
  srOnly: { position: "absolute", left: -10000, top: 0, height: 1, width: 1, opacity: 0 },
});
