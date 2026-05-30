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
  if (Platform.OS !== "android") return true;

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
  const { type, role, otherUserName: paramOtherName } = useLocalSearchParams<{
    type: "audio" | "video";
    role: "caller" | "receiver";
    otherUserName?: string;
  }>();
  const { status, callData, endCall, acceptCall, rejectCall } = useCall();

  const isVideo = type === "video";
  const otherName = paramOtherName || (role === "receiver" ? callData?.callerName : null) || "Other";

  const [isMuted, setIsMuted] = useState(false);
  // Camera starts ON for video calls — never needs a manual tap to enable
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number>(0);
  const [isSwapped, setIsSwapped] = useState(false);
  // Tracks whether the local preview engine is ready (Phase 1 done)
  const [localPreviewReady, setLocalPreviewReady] = useState(false);

  const engine = useRef<any | null>(null);
  // Phase 1: local engine + preview initialized
  const phase1Done = useRef(false);
  // Phase 2: channel joined
  const phase2Done = useRef(false);

  // Keep a ref to callData so the Phase-2 effect always reads the latest value
  const callDataRef = useRef(callData);
  useEffect(() => { callDataRef.current = callData; }, [callData]);

  // ── PHASE 1: Initialize Agora engine + start local preview ───────────────
  // Runs immediately on mount (for video) or just sets up audio (for audio).
  // This ensures the local camera is visible as soon as the screen opens —
  // no need to wait for the call to be accepted.
  useEffect(() => {
    if (phase1Done.current) return;
    if (!createAgoraRtcEngine) {
      console.warn("Agora not available — skipping Phase 1");
      return;
    }

    let cancelled = false;

    (async () => {
      const granted = await requestCallPermissions(isVideo);
      if (!granted || cancelled) return;

      try {
        phase1Done.current = true;

        // Create engine with a placeholder appId for preview.
        // The real appId comes in Phase 2 when we join the channel.
        // For preview only, any non-empty string works; we reinitialize
        // with the real appId in Phase 2 before joining.
        // Actually, we need the real appId even for preview — read from callData if available,
        // otherwise we wait. Let's check if callData already has appId at mount time.
        const earlyAppId = callDataRef.current?.appId;

        if (!earlyAppId || earlyAppId === "your-agora-app-id") {
          // AppId not yet available — Phase 1 will be a no-op; Phase 2 handles everything.
          phase1Done.current = false;
          return;
        }

        engine.current = createAgoraRtcEngine();
        engine.current.initialize({ appId: earlyAppId });

        // Register handlers early so we don't miss events
        engine.current.registerEventHandler({
          onJoinChannelSuccess: (_connection: any) => {
            console.log("✅ Joined Agora channel");
            // Android fix: RtcSurfaceView(uid=0) won't render until we
            // explicitly re-enable local video AFTER the channel is joined.
            // This is why the PiP box shows black on first join — re-enabling
            // forces the camera pipeline to connect to the surface.
            if (isVideo) {
              setTimeout(() => {
                engine.current?.enableLocalVideo(true);
                engine.current?.muteLocalVideoStream(false);
                setLocalPreviewReady(true);
              }, 300);
            }
          },
          onUserJoined: (_connection: any, uid: number) => {
            console.log("👤 Remote user joined:", uid);
            setRemoteUid(uid);
          },
          onUserOffline: (_connection: any, uid: number) => {
            console.log("👤 Remote user left:", uid);
            setRemoteUid(0);
            if (!cancelled) endCall();
          },
          onError: (err: any, msg: string) => {
            console.error("Agora error:", err, msg);
          },
        });

        // Always enable audio
        engine.current.enableAudio();
        engine.current.muteLocalAudioStream(false);
        engine.current.setEnableSpeakerphone(true);

        if (isVideo && !cancelled) {
          // Enable video subsystem + start local camera preview immediately
          engine.current.enableVideo();
          engine.current.enableLocalVideo(true);   // explicitly enable local capture
          engine.current.muteLocalVideoStream(false);
          engine.current.startPreview();
          if (!cancelled) setLocalPreviewReady(true);
          console.log("📷 Local video preview started");
        }
      } catch (e) {
        console.error("Agora Phase-1 error:", e);
        phase1Done.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs ONCE on mount

  // ── PHASE 2: Join the Agora channel when call becomes active ────────────
  // Waits for status === "active" AND appId/token from the server.
  // If Phase 1 already created the engine, we reuse it.
  // If Phase 1 was skipped (appId wasn't available yet), we create engine here.
  useEffect(() => {
    if (status !== "active") return;
    if (!callData?.appId || !callData?.agoraToken) return;
    if (phase2Done.current) return;
    if (!createAgoraRtcEngine) return;

    phase2Done.current = true;
    let cancelled = false;

    (async () => {
      try {
        const data = callDataRef.current;
        const appId = data?.appId;
        if (!appId || appId === "your-agora-app-id") {
          console.error("❌ Agora appId is missing or invalid:", appId);
          Alert.alert("Configuration Error", "Agora App ID is not configured.");
          endCall();
          return;
        }

        if (!phase1Done.current) {
          // Phase 1 was skipped — do a full setup now
          const granted = await requestCallPermissions(isVideo);
          if (!granted || cancelled) return;

          engine.current = createAgoraRtcEngine();
          engine.current.initialize({ appId });

          engine.current.registerEventHandler({
            onJoinChannelSuccess: (_connection: any) => {
              console.log("✅ Joined Agora channel");
              // Android fix: re-enable local video after channel join so the
              // RtcSurfaceView(uid=0) PiP renders without needing a manual toggle.
              if (isVideo) {
                setTimeout(() => {
                  engine.current?.enableLocalVideo(true);
                  engine.current?.muteLocalVideoStream(false);
                  setLocalPreviewReady(true);
                }, 300);
              }
            },
            onUserJoined: (_connection: any, uid: number) => {
              console.log("👤 Remote user joined:", uid);
              setRemoteUid(uid);
            },
            onUserOffline: (_connection: any, uid: number) => {
              console.log("👤 Remote user left:", uid);
              setRemoteUid(0);
              if (!cancelled) endCall();
            },
            onError: (err: any, msg: string) => {
              console.error("Agora error:", err, msg);
            },
          });

          engine.current.enableAudio();
          engine.current.muteLocalAudioStream(false);
          engine.current.setEnableSpeakerphone(true);

          if (isVideo) {
            engine.current.enableVideo();
            engine.current.enableLocalVideo(true);
            engine.current.muteLocalVideoStream(false);
            engine.current.startPreview();
            if (!cancelled) setLocalPreviewReady(true);
          }
          phase1Done.current = true;
        }

        if (cancelled) return;

        // Ensure video is fully enabled right before joining (re-affirm in case
        // Phase 1 had timing issues)
        if (isVideo) {
          engine.current.enableVideo();
          engine.current.enableLocalVideo(true);
          engine.current.muteLocalVideoStream(false);
        }

        // Join the channel with server-provided credentials
        engine.current.joinChannel(
          data?.agoraToken || "",
          data?.channelName || "",
          data?.uid ?? 0,
          {
            clientRoleType: ClientRoleType.ClientRoleBroadcaster,
            channelProfile: ChannelProfileType.ChannelProfileCommunication,
            publishCameraTrack: isVideo,       // explicitly publish camera for video calls
            publishMicrophoneTrack: true,
            autoSubscribeAudio: true,
            autoSubscribeVideo: isVideo,       // auto-subscribe to remote video
          }
        );
        console.log("📡 Joined Agora channel:", data?.channelName);
      } catch (e) {
        console.error("Agora Phase-2 error:", e);
        if (!cancelled) endCall();
      }
    })();

    return () => {
      cancelled = true;
      // Full cleanup only when the component truly unmounts
      // (this cleanup only fires if status/appId/token change, which shouldn't happen)
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, callData?.appId, callData?.agoraToken]);

  // ── Full cleanup when component unmounts ──────────────────────────────────
  useEffect(() => {
    return () => {
      try {
        engine.current?.leaveChannel();
        engine.current?.release();
        engine.current = null;
      } catch (_) {}
    };
  }, []);

  // ── Controls ─────────────────────────────────────────────────────────────
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    engine.current?.muteLocalAudioStream(next);
  };

  const toggleCamera = () => {
    const next = !isCameraOff;
    setIsCameraOff(next);
    engine.current?.muteLocalVideoStream(next);   // true = camera off
    engine.current?.enableLocalVideo(!next);       // complement: false = stop capture
  };

  // ── Waiting / ringing UI ─────────────────────────────────────────────────
  const renderCallingUI = () => (
    <View style={styles.container}>
      {/* For video calls, show the local camera preview even during ringing */}
      {isVideo && localPreviewReady && !isCameraOff && RtcSurfaceView ? (
        <RtcSurfaceView canvas={{ uid: 0 }} style={StyleSheet.absoluteFill} />
      ) : null}

      {/* Semi-transparent overlay so controls are readable over the camera */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isVideo && localPreviewReady ? "rgba(0,0,0,0.4)" : "transparent" }]} />

      <View style={styles.topInfo}>
        {/* Only show avatar when camera is off or audio call */}
        {(!isVideo || !localPreviewReady || isCameraOff) && (
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {callData?.callerName?.charAt(0).toUpperCase() ?? "U"}
            </Text>
          </View>
        )}
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
          {/* ── Full-screen video (remote or local based on swap) ── */}
          {isSwapped ? (
            // Local video full-screen
            !isCameraOff && RtcSurfaceView ? (
              <RtcSurfaceView canvas={{ uid: 0 }} style={styles.remoteVideo} />
            ) : (
              <View style={styles.remotePlaceholder}>
                <View style={styles.avatarContainerLarge}>
                  <Text style={styles.avatarTextLarge}>Y</Text>
                </View>
                <Text style={styles.placeholderText}>Camera is off</Text>
              </View>
            )
          ) : (
            // Remote video full-screen — shows as soon as remote user joins
            remoteUid !== 0 && RtcSurfaceView ? (
              <RtcSurfaceView canvas={{ uid: remoteUid }} style={styles.remoteVideo} />
            ) : (
              <View style={styles.remotePlaceholder}>
                <View style={styles.avatarContainerLarge}>
                  <Text style={styles.avatarTextLarge}>
                    {otherName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.placeholderText}>Waiting for {otherName}...</Text>
              </View>
            )
          )}

          {/* ── PiP — tap to swap ── */}
          <TouchableOpacity
            onPress={() => setIsSwapped(prev => !prev)}
            activeOpacity={0.9}
            style={styles.localVideoContainer}
          >
            {isSwapped ? (
              // Remote video in PiP
              remoteUid !== 0 && RtcSurfaceView ? (
                <RtcSurfaceView canvas={{ uid: remoteUid }} style={styles.localVideo} zOrderMediaOverlay={true} />
              ) : (
                <View style={[styles.localVideo, styles.cameraOffPlaceholder]}>
                  <Ionicons name="person" size={24} color="white" />
                </View>
              )
            ) : (
              // Local video in PiP — camera is always on by default
              !isCameraOff && RtcSurfaceView ? (
                <RtcSurfaceView canvas={{ uid: 0 }} style={styles.localVideo} zOrderMediaOverlay={true} />
              ) : (
                <View style={[styles.localVideo, styles.cameraOffPlaceholder]}>
                  <Ionicons name="videocam-off" size={24} color="white" />
                </View>
              )
            )}
            <View style={styles.pipLabel}>
              <Text style={styles.pipLabelText}>{isSwapped ? otherName : "You"}</Text>
            </View>
          </TouchableOpacity>
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
  topInfo: { alignItems: "center", position: "absolute", top: 100, zIndex: 10 },
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
    zIndex: 10,
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
  pipLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  pipLabelText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
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
    zIndex: 10,
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
