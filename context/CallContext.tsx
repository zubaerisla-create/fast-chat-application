import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import socketService from "@/services/socketService";
import callingService from "@/services/callingService";
let createAgoraRtcEngine: any;
try {
  const Agora = require("react-native-agora");
  createAgoraRtcEngine = Agora.default || Agora.createAgoraRtcEngine;
} catch (e) {}
import { useAuth } from "./AuthContext";
import { useRouter } from "expo-router";

export type CallStatus = "idle" | "incoming" | "outgoing" | "active" | "ended";
export type CallType = "audio" | "video";

interface CallData {
  callerId: string;
  callerName?: string;
  receiverId: string;
  channelName: string;
  callType: CallType;
  agoraToken?: string;
  appId?: string;
  uid?: number;
}

interface CallContextType {
  status: CallStatus;
  callData: CallData | null;
  initiateCall: (receiverId: string, receiverName: string, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<CallStatus>("idle");
  const [callData, setCallData] = useState<CallData | null>(null);

  // Use refs to avoid stale closures inside socket callbacks
  const statusRef = useRef<CallStatus>("idle");
  const userRef = useRef(user);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { userRef.current = user; }, [user]);

  // Register listeners ONCE — use refs for current values to avoid stale closures
  useEffect(() => {
    const unsubscribeIncoming = socketService.on("incoming_call", (data: any) => {
      console.log("Incoming call received:", data);
      if (statusRef.current !== "idle") {
        // Busy — auto reject
        socketService.rejectCall(data.callerId, data.channelName);
        return;
      }
      const currentUser = userRef.current;
      setCallData({
        callerId: data.callerId,
        callerName: data.callerName || "Unknown",
        receiverId: currentUser?.id || currentUser?._id || "",
        channelName: data.channelName,
        callType: data.callType,
      });
      setStatus("incoming");
    });

    const unsubscribeAccepted = socketService.on("call_accepted", (data: any) => {
      console.log("Call joined event received:", data);
      const currentUser = userRef.current;
      setCallData(prev => ({
        ...(prev || {}),
        callerId: prev?.callerId || "",
        receiverId: currentUser?.id || currentUser?._id || "",
        agoraToken: data.token,
        appId: data.appId,
        uid: data.uid,
        channelName: data.channelName,
        callType: data.callType || prev?.callType || "audio",
      }) as CallData);
      setStatus("active");
    });

    const unsubscribeRejected = socketService.on("call_rejected", (_data: any) => {
      console.log("Call rejected by remote");
      setStatus("idle");
      setCallData(null);
      Alert.alert("Call Rejected", "The user rejected or is busy.");
    });

    const unsubscribeEnded = socketService.on("call_ended", (_data: any) => {
      console.log("Call ended by remote");
      setStatus("idle");
      setCallData(null);
    });

    return () => {
      unsubscribeIncoming();
      unsubscribeAccepted();
      unsubscribeRejected();
      unsubscribeEnded();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← Empty array: register ONCE. Refs handle fresh values.

  const initiateCall = async (receiverId: string, receiverName: string, type: CallType) => {
    if (!user) return;

    if (!createAgoraRtcEngine) {
      Alert.alert(
        "Development Build Required",
        "Calling features require a Development Build to access the Agora native SDK. This won't work in Expo Go.",
        [{ text: "I Understand" }]
      );
      return;
    }

    const channelId = user.id || user._id || "";
    const channelName = callingService.generateChannelName(channelId, receiverId);
    setCallData({
      callerId: channelId,
      receiverId,
      callerName: user.username,
      channelName,
      callType: type,
    });
    setStatus("outgoing");

    socketService.initiateCall(receiverId, type, channelName);

    router.push({
      pathname: "/screens/chat/CallingScreen",
      params: { type, role: "caller" },
    });
  };

  const acceptCall = async () => {
    if (!callData || !user) return;
    try {
      socketService.acceptCall(callData.callerId, callData.channelName);
      router.push({
        pathname: "/screens/chat/CallingScreen",
        params: { type: callData.callType, role: "receiver" },
      });
    } catch (error) {
      console.error("Error accepting call:", error);
      Alert.alert("Error", "Could not connect to the call.");
      rejectCall();
    }
  };

  const rejectCall = () => {
    if (!callData) return;
    socketService.rejectCall(callData.callerId, callData.channelName);
    setStatus("idle");
    setCallData(null);
  };

  const endCall = () => {
    const data = callData;
    setStatus("idle");
    setCallData(null);
    if (data) {
      const currentUserId = user?.id || user?._id || "";
      const otherUserId = data.callerId === currentUserId
        ? data.receiverId
        : data.callerId;
      socketService.emit("end_call", { channelName: data.channelName, otherUserId });
    }
    if (router.canGoBack()) router.back();
  };

  return (
    <CallContext.Provider value={{ status, callData, initiateCall, acceptCall, rejectCall, endCall }}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used within CallProvider");
  return context;
};
