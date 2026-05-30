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

  // ── Guards to prevent duplicate / race-condition call processing ──────────
  // Prevents acceptCall() from being called twice (double-tap, race)
  const isProcessingAcceptRef = useRef(false);
  // Prevents endCall() from firing twice (e.g. both users ending simultaneously)
  const isEndingCallRef = useRef(false);

  // Register listeners ONCE — use refs for current values to avoid stale closures
  useEffect(() => {
    const unsubscribeIncoming = socketService.on("incoming_call", (data: any) => {
      console.log("📞 Incoming call received:", data);
      // Only accept a new call when idle — ignore if already in a call
      if (statusRef.current !== "idle") {
        console.log("📞 Busy — auto-rejecting incoming call");
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

      // Navigate to CallingScreen automatically for incoming call
      router.push({
        pathname: "/screens/chat/CallingScreen",
        params: { type: data.callType, role: "receiver", otherUserName: data.callerName || "Unknown" },
      });
    });

    // Caller receives server-generated channelName via call_initiated
    const unsubscribeInitiated = socketService.on("call_initiated", (data: any) => {
      console.log("📡 Call initiated confirmed by server:", data);
      // Bug 5 fix: ignore stale call_initiated events that arrive when idle
      if (statusRef.current === "idle") {
        console.warn("⚠️ Ignoring stale call_initiated — status is idle");
        return;
      }
      // Update callData with the AUTHORITATIVE server channelName
      setCallData(prev => prev ? { ...prev, channelName: data.channelName } : null);
    });

    const unsubscribeAccepted = socketService.on("call_accepted", (data: any) => {
      console.log("✅ Call joined event received:", data);
      // Bug 2 fix: idempotency guard — skip if already active (e.g. socket reconnect re-delivers)
      if (statusRef.current === "active") {
        console.warn("⚠️ Ignoring duplicate call_accepted — already active");
        return;
      }
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
      console.log("🚫 Call rejected by remote");
      // Only process rejection if we are in outgoing state
      if (statusRef.current !== "outgoing") {
        console.warn("⚠️ Ignoring call_rejected — not in outgoing state");
        return;
      }
      setStatus("idle");
      setCallData(null);
      Alert.alert("Call Rejected", "The user rejected or is busy.");
    });

    // Bug 1 fix: call_ended guard — ignore if already idle (stale/reconnected events)
    const unsubscribeEnded = socketService.on("call_ended", (_data: any) => {
      console.log("🔴 Call ended by remote");
      if (statusRef.current === "idle") {
        console.warn("⚠️ Ignoring stale call_ended — already idle");
        return;
      }
      setStatus("idle");
      setCallData(null);
      isEndingCallRef.current = false;
      isProcessingAcceptRef.current = false;
    });

    return () => {
      unsubscribeIncoming();
      unsubscribeInitiated();
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

    // Reset processing guards for the new call
    isProcessingAcceptRef.current = false;
    isEndingCallRef.current = false;

    const callerId = user.id || user._id || "";

    // Set temporary callData (channelName will be updated when server confirms via call_initiated)
    setCallData({
      callerId,
      receiverId,
      callerName: user.username,
      channelName: "",   // server will provide the real channelName
      callType: type,
    });
    setStatus("outgoing");

    // Tell server to initiate — server generates channelName & notifies receiver
    socketService.initiateCall(receiverId, type, "", user.username);

    router.push({
      pathname: "/screens/chat/CallingScreen",
      params: { type, role: "caller", otherUserName: receiverName },
    });
  };

  const acceptCall = async () => {
    // Prevent double-tap / double-invocation
    if (isProcessingAcceptRef.current) {
      console.warn("⚠️ acceptCall already in progress — ignoring duplicate call");
      return;
    }
    if (!callData || !user) return;

    isProcessingAcceptRef.current = true;
    try {
      // Notify server we accepted the call.
      // NOTE: Do NOT router.push() here — the receiver is already on CallingScreen
      // (it was pushed automatically when `incoming_call` fired). Pushing again would
      // create a second CallingScreen instance with separate Agora engine refs, causing
      // the broken PiP and icon state issues. The existing screen transitions to "active"
      // automatically when the server responds with call_accepted.
      socketService.acceptCall(callData.callerId, callData.channelName);
    } catch (error) {
      console.error("Error accepting call:", error);
      Alert.alert("Error", "Could not connect to the call.");
      isProcessingAcceptRef.current = false;
      rejectCall();
    }
    // Note: isProcessingAcceptRef stays true until call_ended resets it
  };

  const rejectCall = () => {
    if (!callData) return;
    socketService.rejectCall(callData.callerId, callData.channelName);
    setStatus("idle");
    setCallData(null);
    isProcessingAcceptRef.current = false;
    isEndingCallRef.current = false;
  };

  const endCall = () => {
    // Bug 5 fix: prevent double-ending (e.g. both onUserOffline and user pressing end)
    if (isEndingCallRef.current) {
      console.warn("⚠️ endCall already in progress — ignoring duplicate");
      return;
    }
    isEndingCallRef.current = true;

    const data = callData;
    setStatus("idle");
    setCallData(null);
    isProcessingAcceptRef.current = false;

    if (data) {
      const currentUserId = user?.id || user?._id || "";
      const otherUserId = data.callerId === currentUserId
        ? data.receiverId
        : data.callerId;
      socketService.emit("end_call", { channelName: data.channelName, otherUserId });
    }

    // Small delay before navigation to allow Agora cleanup
    setTimeout(() => {
      isEndingCallRef.current = false;
      if (router.canGoBack()) router.back();
    }, 200);
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
