import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Dimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCall } from "@/context/CallContext";
import { useAuth } from "@/context/AuthContext";

// Safely import Agora
let createAgoraRtcEngine: any, ChannelProfileType: any, ClientRoleType: any, RtcSurfaceView: any;
try {
  const Agora = require("react-native-agora");
  createAgoraRtcEngine = Agora.default || Agora.createAgoraRtcEngine;
  ChannelProfileType = Agora.ChannelProfileType;
  ClientRoleType = Agora.ClientRoleType;
  RtcSurfaceView = Agora.RtcSurfaceView;
} catch (e) {
  console.warn("Agora native module not found. Calling will not work in Expo Go.");
}

const { width, height } = Dimensions.get("window");

export default function CallingScreen() {
  const router = useRouter();
  const { type, role } = useLocalSearchParams<{ type: "audio" | "video"; role: "caller" | "receiver" }>();
  const { status, callData, endCall, acceptCall, rejectCall } = useCall();
  const { user } = useAuth();
  
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(type === "audio");
  const [remoteUid, setRemoteUid] = useState<number>(0);
  const engine = useRef<any | null>(null);

  useEffect(() => {
    if (status === "active") {
      if (!createAgoraRtcEngine) {
        Alert.alert(
          "Native Module Missing",
          "Agora Calling requires a Development Build (npx expo prebuild) because it contains native code. It will not work in standard Expo Go.",
          [{ text: "OK", onPress: () => endCall() }]
        );
        return;
      }
      try {
        setupAgora();
      } catch (error) {
        console.error("Agora initialization failed:", error);
        endCall();
      }
    }
    return () => {
      try {
        engine.current?.leaveChannel();
        engine.current?.release();
      } catch (e) {}
    };
  }, [status]);

  const setupAgora = async () => {
    if (!createAgoraRtcEngine) return;
    try {
      engine.current = createAgoraRtcEngine();
      engine.current.initialize({
        appId: callData?.appId || "your-agora-app-id",
      });

      engine.current.registerEventHandler({
        onJoinChannelSuccess: (connection: any, elapsed: any) => {
          console.log("✅ Successfully joined channel:", connection.channelId);
        },
        onUserJoined: (connection: any, uid: number) => {
          console.log("👤 Remote user joined:", uid);
          setRemoteUid(uid);
        },
        onUserOffline: (connection: any, uid: number) => {
          console.log("👤 Remote user offline:", uid);
          setRemoteUid(0);
          endCall();
        },
        onLeaveChannel: (connection: any, stats: any) => {
          console.log("Left channel");
        },
        onError: (err: any, msg: string) => {
          console.error("Agora error:", err, msg);
        },
      });

      // Always enable audio
      engine.current.enableAudio();
      engine.current.muteLocalAudioStream(false);
      engine.current.setEnableSpeakerphone(true);

      if (type === "video") {
        engine.current.enableVideo();
        engine.current.startPreview();
      }

      engine.current.joinChannel(
        callData?.agoraToken || "",
        callData?.channelName || "",
        callData?.uid || 0,
        {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
        }
      );
    } catch (e) {
      console.error("Agora setup error:", e);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    engine.current?.muteLocalAudioStream(!isMuted);
  };

  const toggleCamera = () => {
    setIsCameraOff(!isCameraOff);
    engine.current?.muteLocalVideoStream(!isCameraOff);
  };

  const handleEndCall = () => {
    endCall();
  };

  const renderCallingUI = () => (
    <View style={styles.container}>
      <View style={styles.topInfo}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {callData?.callerName?.charAt(0).toUpperCase() || "U"}
          </Text>
        </View>
        <Text style={styles.nameText}>{callData?.callerName || "User"}</Text>
        <Text style={styles.statusText}>
          {status === "outgoing" ? "Calling..." : "Incoming Call..."}
        </Text>
      </View>

      <View style={styles.bottomControls}>
        {status === "incoming" ? (
          <View style={styles.incomingButtons}>
            <TouchableOpacity onPress={rejectCall} style={[styles.controlButton, styles.rejectButton]}>
              <Ionicons name="close" size={32} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={acceptCall} style={[styles.controlButton, styles.acceptButton]}>
              <Ionicons name="call" size={32} color="white" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.activeButtons}>
            <TouchableOpacity onPress={toggleMute} style={[styles.controlButton, isMuted && styles.activeButton]}>
              <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleEndCall} style={[styles.controlButton, styles.endButton]}>
              <Ionicons name="call" size={32} color="white" />
            </TouchableOpacity>
            {type === "video" && (
              <TouchableOpacity onPress={toggleCamera} style={[styles.controlButton, isCameraOff && styles.activeButton]}>
                <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={24} color="white" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );

  const renderActiveUI = () => (
    <View style={styles.container}>
      {type === "video" ? (
        <View style={styles.videoContainer}>
          {remoteUid !== 0 ? (
            <RtcSurfaceView
              canvas={{ uid: remoteUid }}
              style={styles.remoteVideo}
            />
          ) : (
            <View style={styles.remotePlaceholder}>
              <Text style={styles.placeholderText}>Waiting for user...</Text>
            </View>
          )}
          
          <View style={styles.localVideoContainer}>
            {!isCameraOff ? (
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
        <View style={styles.audioActiveContainer}>
          <View style={styles.avatarContainerLarge}>
            <Text style={styles.avatarTextLarge}>
              {callData?.callerName?.charAt(0).toUpperCase() || "U"}
            </Text>
          </View>
          <Text style={styles.nameTextLarge}>{callData?.callerName || "User"}</Text>
          <Text style={styles.activeText}>Active Call</Text>
        </View>
      )}

      <View style={styles.overlayControls}>
        <TouchableOpacity onPress={toggleMute} style={[styles.overlayButton, isMuted && styles.activeButton]}>
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleEndCall} style={[styles.overlayButton, styles.endButton]}>
          <Ionicons name="call" size={32} color="white" />
        </TouchableOpacity>
        {type === "video" && (
          <TouchableOpacity onPress={toggleCamera} style={[styles.overlayButton, isCameraOff && styles.activeButton]}>
            <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={24} color="white" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return status === "active" ? renderActiveUI() : renderCallingUI();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", justifyContent: "center", alignItems: "center" },
  topInfo: { alignItems: "center", position: "absolute", top: 100 },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#3B82F6", justifyContent: "center", alignItems: "center", marginBottom: 20 },
  avatarText: { color: "white", fontSize: 40, fontWeight: "bold" },
  nameText: { color: "white", fontSize: 24, fontWeight: "bold", marginBottom: 10 },
  statusText: { color: "#94A3B8", fontSize: 16 },
  
  bottomControls: { position: "absolute", bottom: 100, width: "100%", alignItems: "center" },
  incomingButtons: { flexDirection: "row", justifyContent: "space-around", width: "80%" },
  activeButtons: { flexDirection: "row", justifyContent: "center", gap: 30, alignItems: "center" },
  
  controlButton: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)" },
  acceptButton: { backgroundColor: "#10B981" },
  rejectButton: { backgroundColor: "#EF4444" },
  endButton: { backgroundColor: "#EF4444", width: 72, height: 72, borderRadius: 36 },
  activeButton: { backgroundColor: "#3B82F6" },
  
  videoContainer: { flex: 1, width: "100%" },
  remoteVideo: { flex: 1 },
  remotePlaceholder: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1E293B" },
  placeholderText: { color: "#94A3B8", fontSize: 18 },
  
  localVideoContainer: { position: "absolute", top: 50, right: 20, width: 120, height: 160, borderRadius: 12, overflow: "hidden", elevation: 5 },
  localVideo: { flex: 1 },
  cameraOffPlaceholder: { backgroundColor: "#334155", justifyContent: "center", alignItems: "center" },
  
  audioActiveContainer: { alignItems: "center" },
  avatarContainerLarge: { width: 150, height: 150, borderRadius: 75, backgroundColor: "#3B82F6", justifyContent: "center", alignItems: "center", marginBottom: 30 },
  avatarTextLarge: { color: "white", fontSize: 60, fontWeight: "bold" },
  nameTextLarge: { color: "white", fontSize: 32, fontWeight: "bold", marginBottom: 15 },
  activeText: { color: "#10B981", fontSize: 20, fontWeight: "600" },
  
  overlayControls: { position: "absolute", bottom: 50, flexDirection: "row", gap: 20, backgroundColor: "rgba(0,0,0,0.5)", padding: 20, borderRadius: 40 },
  overlayButton: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)" },
});
