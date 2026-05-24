import apiClient from "@/utils/apiClient";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";

/**
 * Module-level ref that tracks the conversationId the user is currently viewing.
 * ChatScreen sets this via activeChatIdRef (re-exported here for the handler).
 * The setNotificationHandler callback reads this ref to decide whether to suppress.
 */
export const activeChatRef = { current: null as string | null };

/**
 * setNotificationHandler must be called at module load time (outside any component).
 * It reads activeChatRef at the moment a notification arrives so it always has
 * the latest value — no stale closure problem.
 *
 * Rules:
 *  - App is FOREGROUND + user is IN that chat  → suppress (silent, no banner)
 *  - App is FOREGROUND + user is NOT in that chat → show banner
 *  - App is BACKGROUND / KILLED                → OS handles it (this handler is not called)
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const { chatId } = (notification.request.content.data ?? {}) as any;
    const appState: AppStateStatus = AppState.currentState;

    // Only suppress when app is active AND user is already inside this specific chat
    const isInThisChat =
      appState === "active" &&
      chatId != null &&
      chatId === activeChatRef.current;

    if (isInThisChat) {
      // Completely silent — no banner, no sound, no badge increment
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    // App is foreground but user is on a different screen → show banner
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

/**
 * Sets up foreground + tap listeners only.
 * Token registration is intentionally NOT called here — it is called from
 * AuthContext after the user is authenticated so the API call has a valid token.
 *
 * @param chatIdRef - the module-level ref from ChatScreen (pass the ref object, NOT .current)
 */
export function usePushNotifications(
  chatIdRef: React.RefObject<string | null>
) {
  // Keep our module-level ref in sync with the one from ChatScreen
  useEffect(() => {
    // Sync on mount and whenever chatIdRef itself changes (it won't — it's stable)
    activeChatRef.current = chatIdRef.current;

    // We need a polling approach since refs don't trigger re-renders.
    // Instead, we rely on ChatScreen updating chatIdRef.current directly,
    // and our setNotificationHandler reads activeChatRef.current at call time.
    // So we just need to keep activeChatRef pointing to the same object.
    // Actually the cleanest solution: make activeChatRef === chatIdRef by reference.
    // We do this by proxying reads in the handler above via activeChatRef,
    // and here we sync the value on an interval as a safety net.
    const interval = setInterval(() => {
      activeChatRef.current = chatIdRef.current;
    }, 500);

    return () => clearInterval(interval);
  }, [chatIdRef]);

  const responseListener = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null>(null);

  useEffect(() => {
    // ── User tapped a notification (from background/killed state) ────────
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = (response.notification.request.content.data ?? {}) as any;
        if (data.type === "chat" && data.chatId) {
          router.push({
            pathname: "/screens/chat/ChatScreen",
            params: {
              conversationId: data.chatId,
              userId: data.senderId,
              name: data.senderName ?? "Chat",
            },
          });
        }
      });

    return () => {
      responseListener.current?.remove();
    };
  }, []);
}

// ── Token registration — call this AFTER the user is authenticated ────────────

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("⚠️ Push notifications only work on physical devices.");
    return null;
  }

  console.log("📱 Device info:", Device.modelName, "OS:", Platform.OS);

  // Android: create a high-priority notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("chat-messages", {
      name: "Chat Messages",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#6366F1",
      sound: "default",
    });
    console.log("✅ Android notification channel created");
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log("🔔 Existing permission status:", existingStatus);
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log("🔔 Requested permission, new status:", finalStatus);
  }

  if (finalStatus !== "granted") {
    console.warn("❌ Push notification permission denied. Status:", finalStatus);
    return null;
  }

  console.log("✅ Permission granted, getting Expo push token...");

  let expoPushToken: string;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "ec4ee1e6-0314-44dd-962b-f3d56be4e4d6",
    });
    expoPushToken = tokenData.data;
    console.log("✅ Got Expo push token:", expoPushToken);
  } catch (tokenErr: any) {
    console.error("❌ Failed to get Expo push token:", tokenErr?.message);
    return null;
  }

  // Save token to backend — auth token is guaranteed to be in AsyncStorage here
  try {
    await apiClient.put("/users/push-token", { expoPushToken });
    console.log("✅ Push token saved to backend successfully");
  } catch (err: any) {
    console.error(
      "❌ Failed to save push token to backend:",
      err?.message,
      "Status:",
      err?.response?.status
    );
  }

  return expoPushToken;
}

// ── Clear token on logout ─────────────────────────────────────────────────────

export async function clearPushToken(): Promise<void> {
  try {
    await apiClient.delete("/users/push-token");
  } catch (err: any) {
    console.error("Failed to clear push token:", err?.message);
  }
}
