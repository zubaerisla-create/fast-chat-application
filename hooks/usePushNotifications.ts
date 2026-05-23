import apiClient from "@/utils/apiClient";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

// Show notifications even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Sets up foreground + tap listeners only.
 * Token registration is intentionally NOT called here — it is called from
 * AuthContext after the user is authenticated so the API call has a valid token.
 *
 * @param navigationRef  - ref to the navigation container (tap-to-navigate)
 * @param currentChatId  - conversationId the user is currently viewing
 *                         (suppresses duplicate in-app banners for the active chat)
 */
export function usePushNotifications(
  navigationRef: React.RefObject<any>,
  currentChatId: string | null
) {
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // ── Foreground notification received ──────────────────────────────────
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const { chatId } = (notification.request.content.data ?? {}) as any;
        // Suppress the banner if the user is already inside this chat
        if (chatId && chatId === currentChatId) {
          Notifications.dismissNotificationAsync(
            notification.request.identifier
          ).catch(() => {});
        }
        // Otherwise expo-notifications shows it automatically
      }
    );

    // ── User tapped a notification ────────────────────────────────────────
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = (response.notification.request.content.data ?? {}) as any;
        if (data.type === "chat" && data.chatId) {
          navigationRef.current?.navigate("screens/chat/ChatScreen", {
            conversationId: data.chatId,
            userId: data.senderId,
            name: data.senderName ?? "Chat",
          });
        }
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [currentChatId]);
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
    // projectId from app.json > extra.eas.projectId
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
    console.error("❌ Failed to save push token to backend:", err?.message, "Status:", err?.response?.status);
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
