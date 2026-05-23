/**
 * Quick test — sends a real push notification to a device token.
 * Run with: node scripts/test-push.js
 *
 * This bypasses the backend completely to verify the Expo push pipeline works.
 */

const TOKEN = "ExponentPushToken[J-HAqGKCMKnmg5q6rcdvSP]"; // CPH2719 (your device)

async function sendTestPush() {
  console.log("Sending test push to:", TOKEN);

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      to: TOKEN,
      title: "Test Notification 🔔",
      body: "If you see this, push notifications are working!",
      sound: "default",
      priority: "high",
      data: {
        type: "chat",
        chatId: "6a0375a6ccc0fe090eafb8fb",
        senderId: "test",
        senderName: "Test",
      },
    }),
  });

  const result = await response.json();
  console.log("Expo push API response:", JSON.stringify(result, null, 2));

  if (result.data?.status === "ok") {
    console.log("✅ Push sent successfully! Check your device.");
  } else {
    console.log("❌ Push failed:", result.data?.message || result);
  }
}

sendTestPush().catch(console.error);
