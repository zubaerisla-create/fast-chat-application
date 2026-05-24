import { useCall } from "@/context/CallContext";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Safely import Agora — only available in a Development Build, not Expo Go
let createAgoraRtcEngine: any,
  ChannelProfileType: any,
  ClientRoleType: any,
  RtcSurfaceView: any;
try {
  const Agora = require("react-native-agora");
  createAgoraRtcEngine = Agora.default || Agora.createAgoraRtcEngine;
  ChannelProfileType = Agora.ChannelProfileType;
  ClientRoleType = Agora.ClientRoleType;
  RtcSurfaceView = Agora.RtcSurfaceView;
} catch (e) {
  console.warn("Agora native module not found. Calling will not work in Expo Go.");
}

// ── Permission helper ────────────────────────────────────────────────────────
async function requestCallPermissions(isVideo: boolean): Promise<boolean> {
  if (Platform.OS !== "android") return true; // iOS handles permissions via Info.plist

  const perms: string[] = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (isVideo) perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);

  try {
    const results = await PermissionsAndroid.requestMultiple(perms as any);
    const allGranted = perms.every(
      (p) => results[p as keyof typeof results] === PermissionsAndroid.RESULTS.GRANTED
    );
    if (!allGranted) {
      Alert.alert(
        "Permissions Required",
        isVideo
          ? "Camera and microphone access are required for video calls."
          : "Microphone access is required for audio calls.",
        [{ text: "OK" }]
      );
    }
    return allGranted;
  } catch {
    return false;
  }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function CallingScreen() {
  const { type } = useLocalSearchParams<{ type: "audio" | "video"; role: "caller" | "receiver" }>();
  const { status, callData, endCall, acceptCall, rejectCall } = useCall();

  const isVideo = type === "video";

  const [isMuted, setIsMuted] = useState(false);
  // Camera starts ON for video calls, OFF for audio calls
  const [isCameraOff, setIsCameraOff] = useState(!isVideo);
  const [remoteUid, setRemoteUid] = useState<number>(0);
  const engine = useRef<any | null>(null);
  // Track whether Agora has been set up so we never run it twice
  const agoraInitialised = useRef(false);

  // Keep a ref to callData so the effect always reads the latest value
  // without needing callData in the dependency array (which would re-run
  // the effect on every callData update and tear down the engine).
  const callDataRef = useRef(callData);
  useEffect(() => { callDataRef.current = callData; }, [callData]);

  // ── Initialise Agora when BOTH status is active AND callData has appId ───
  //
  // Problem: CallContext does two separate setState calls back-to-back:
  //   setCallData(prev => ({ ...prev, appId, agoraToken, ... }))
  //   setStatus("active")
  // React batches these, but the useEffect dependency on [status] fires
  // after the render where status flipped — at that point callData may
  // still be the previous render's value in the closure.
  //
  // Solution: watch BOTH status AND callData.appId. The effect only
  // proceeds when status === "active" AND appId is present. If status
  // flips first and appId isn't there yet, the effect exits early and
  // re-runs on the next render when callData.appId arrives.
  useEffect(() => {
    // Guard: only run when active and we have the token/appId from the server
    if (status !== "active") return;
    if (!callData?.appId || !callData?.agoraToken) return;
    // Guard: never initialise twice (StrictMode / fast-refresh safety)
    if (agoraInitialised.current) return;

    if (!createAgoraRtcEngine) {
      Alert.alert(
        "Native Module Missing",
        "Calling requires a Development Build (npx expo prebuild). It will not work in Expo Go.",
        [{ text: "OK", onPress: () => endCall() }]
      );
      return;
    }

    agoraInitialised.current = true;
    let cancelled = false;

    (async () => {
      // 1. Request permissions first
      const granted = await requestCallPermissions(isVideo);
      if (!granted || cancelled) return;

      // 2. Read from ref so we always have the freshest callData
      const data = callDataRef.current;
      const appId = data?.appId;
      if (!appId || appId === "your-agora-app-id") {
        console.error("❌ Agora appId is missing or invalid:", appId);
        Alert.alert("Configuration Error", "Agora App ID is not configured. Please contact support.");
        endCall();
        return;
      }

      try {
        // 3. Create and initialise engine
        engine.current = createAgoraRtcEngine();
        engine.current.initialize({ appId });

        // 4. Register event handlers
        engine.current.registerEventHandler({
          onJoinChannelSuccess: (_connection: any) => {
            console.log("✅ Joined Agora channel");
          },
          onUserJoined: (_connection: any, uid: number) => {
            console.log("👤 Remote user joined:", uid);
            setRemoteUid(uid);
          },
          onUserOffline: (_connection: any, uid: number) => {
            console.log("👤 Remote user left:", uid);
            setRemoteUid(0);
            endCall();
          },
          onError: (err: any, msg: string) => {
            console.error("Agora error:", err, msg);
          },
        });

        // 5. Enable audio (always)
        engine.current.enableAudio();
        engine.current.muteLocalAudioStream(false);
        engine.current.setEnableSpeakerphone(true);

        // 6. Enable video and start local preview BEFORE joining channel
        if (isVideo) {
          engine.current.enableVideo();
          engine.current.muteLocalVideoStream(false); // ensure camera is unmuted
          engine.current.startPreview();              // show local camera immediately
        }

        // 7. Join the channel using the freshest callData values
        engine.current.joinChannel(
          data?.agoraToken || "",
          data?.channelName || "",
          data?.uid ?? 0,
          {
            clientRoleType: ClientRoleType.ClientRoleBroadcaster,
            channelProfile: ChannelProfileType.ChannelProfileCommunication,
          }
        );
      } catch (e) {
        console.error("Agora setup error:", e);
        if (!cancelled) endCall();
      }
    })();

    return () => {
      cancelled = true;
      try {
        engine.current?.leaveChannel();
        engine.current?.release();
        engine.current = null;
      } catch (_) {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, callData?.appId, callData?.agoraToken]);

  // ── Controls ─────────────────────────────────────────────────────────────
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    engine.current?.muteLocalAudioStream(next);
  };

  const toggleCamera = () => {
    const next = !isCameraOff;
    setIsCameraOff(next);
    engine.current?.muteLocalVideoStream(next); // true = muted (camera off)
  };

  // ── Waiting / ringing UI ─────────────────────────────────────────────────
  const renderCallingUI = () => (
    <View style={styles.container}>
      <View style={styles.topInfo}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {callData?.callerName?.charAt(0).toUpperCase() ?? "U"}
          </Text>
        </View>
        <Text style={styles.nameText}>{callData?.callerName ?? "User"}</Text>
        <Text style={styles.statusText}>
          {status === "outgoing" ? "Calling..." : "Incoming Call..."}
        </Text>
      </View>

      <View style={styles.bottomControls}>
        {status === "incoming" ? (
          <View style={styles.incomingButtons}>
            <TouchableOpacity
              onPress={rejectCall}
              style={[styles.controlButton, styles.rejectButton]}
              accessibilityLabel="Reject call"
            >
              <Ionicons name="close" size={32} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={acceptCall}
              style={[styles.controlButton, styles.acceptButton]}
              accessibilityLabel="Accept call"
            >
              <Ionicons name="call" size={32} color="white" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.activeButtons}>
            <TouchableOpacity
              onPress={toggleMute}
              style={[styles.controlButton, isMuted && styles.activeButton]}
              accessibilityLabel={isMuted ? "Unmute" : "Mute"}
            >
              <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={endCall}
              style={[styles.controlButton, styles.endButton]}
              accessibilityLabel="End call"
            >
              <Ionicons name="call" size={32} color="white" />
            </TouchableOpacity>
            {isVideo && (
              <TouchableOpacity
                onPress={toggleCamera}
                style={[styles.controlButton, isCameraOff && styles.activeButton]}
                accessibilityLabel={isCameraOff ? "Turn camera on" : "Turn camera off"}
              >
                <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={24} color="white" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );

  // ── Active call UI ───────────────────────────────────────────────────────
  const renderActiveUI = () => (
    <View style={styles.container}>
      {isVideo ? (
        <View style={styles.videoContainer}>
          {/* Remote video — full screen */}
          {remoteUid !== 0 && RtcSurfaceView ? (
            <RtcSurfaceView
              canvas={{ uid: remoteUid }}
              style={styles.remoteVideo}
            />
          ) : (
            <View style={styles.remotePlaceholder}>
              <View style={styles.avatarContainerLarge}>
                <Text style={styles.avatarTextLarge}>
                  {callData?.callerName?.charAt(0).toUpperCase() ?? "U"}
                </Text>
              </View>
              <Text style={styles.placeholderText}>Waiting for other person...</Text>
            </View>
          )}

          {/* Local video — picture-in-picture */}
          <View style={styles.localVideoContainer}>
            {!isCameraOff && RtcSurfaceView ? (
              <RtcSurfaceView
                canvas={{ uid: 0 }}
                style={styles.localVideo}
                zOrderMediaOverlay={true}
              />
            ) : (
              <View style={[styles.localVideo, styles.cameraOffPlaceholder]}>
                <Ionicons name="videocam-off" size={24} color="white" />
              </View>
            )}
          </View>
        </View>
      ) : (
        // Audio call active UI
        <View style={styles.audioActiveContainer}>
          <View style={styles.avatarContainerLarge}>
            <Text style={styles.avatarTextLarge}>
              {callData?.callerName?.charAt(0).toUpperCase() ?? "U"}
            </Text>
          </View>
          <Text style={styles.nameTextLarge}>{callData?.callerName ?? "User"}</Text>
          <Text style={styles.activeText}>Active Call</Text>
        </View>
      )}

      {/* Overlay controls */}
      <View style={styles.overlayControls}>
        <TouchableOpacity
          onPress={toggleMute}
          style={[styles.overlayButton, isMuted && styles.activeButton]}
          accessibilityLabel={isMuted ? "Unmute" : "Mute"}
        >
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={endCall}
          style={[styles.overlayButton, styles.endButton]}
          accessibilityLabel="End call"
        >
          <Ionicons name="call" size={32} color="white" />
        </TouchableOpacity>
        {isVideo && (
          <TouchableOpacity
            onPress={toggleCamera}
            style={[styles.overlayButton, isCameraOff && styles.activeButton]}
            accessibilityLabel={isCameraOff ? "Turn camera on" : "Turn camera off"}
          >
            <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={24} color="white" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return status === "active" ? renderActiveUI() : renderCallingUI();
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },

  // Ringing / waiting
  topInfo: { alignItems: "center", position: "absolute", top: 100 },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  avatarText: { color: "white", fontSize: 40, fontWeight: "bold" },
  nameText: { color: "white", fontSize: 24, fontWeight: "bold", marginBottom: 10 },
  statusText: { color: "#94A3B8", fontSize: 16 },

  bottomControls: {
    position: "absolute",
    bottom: 100,
    width: "100%",
    alignItems: "center",
  },
  incomingButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "80%",
  },
  activeButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 30,
    alignItems: "center",
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  acceptButton: { backgroundColor: "#10B981" },
  rejectButton: { backgroundColor: "#EF4444" },
  endButton: { backgroundColor: "#EF4444", width: 72, height: 72, borderRadius: 36 },
  activeButton: { backgroundColor: "#3B82F6" },

  // Video
  videoContainer: { flex: 1, width: "100%" },
  remoteVideo: { flex: 1 },
  remotePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1E293B",
    gap: 16,
  },
  placeholderText: { color: "#94A3B8", fontSize: 16 },
  localVideoContainer: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  localVideo: { flex: 1 },
  cameraOffPlaceholder: {
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },

  // Audio active
  audioActiveContainer: { alignItems: "center" },
  avatarContainerLarge: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
  },
  avatarTextLarge: { color: "white", fontSize: 60, fontWeight: "bold" },
  nameTextLarge: { color: "white", fontSize: 32, fontWeight: "bold", marginBottom: 15 },
  activeText: { color: "#10B981", fontSize: 20, fontWeight: "600" },

  // Overlay controls (active call)
  overlayControls: {
    position: "absolute",
    bottom: 50,
    flexDirection: "row",
    gap: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 20,
    borderRadius: 40,
  },
  overlayButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
});
