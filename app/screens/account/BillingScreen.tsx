import { palette, radius } from "@/constants/design";
import billingService, { BillingSubscription, Entitlement, LifetimePurchase } from "@/services/billingService";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Free trial",
  past_due: "Payment overdue",
  paused: "Paused",
  canceled: "Canceled",
  expired: "Expired",
  pending: "Pending",
};

const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "");

/**
 * Shows the plan the backend has verified for this account (bought on the website).
 * The app doesn't sell plans or link to the web checkout; any future in-app purchase
 * must use Google Play Billing (see docs/FASTCHAT_BILLING_SETUP.md).
 */
export default function BillingScreen() {
  const router = useRouter();
  const [data, setData] = useState<{ entitlement: Entitlement; subscriptions: BillingSubscription[]; lifetimePurchases: LifetimePurchase[] } | null>(null);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      setError("");
      billingService
        .getMyBilling()
        .then(setData)
        .catch(() => setError("Your plan couldn't be loaded. Check your connection and try again."));
    }, [])
  );

  const webSubs = data?.subscriptions.filter((s) => s.status !== "canceled") ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={26} color={palette.text} />
        </Pressable>
        <Text style={styles.title}>Plan & billing</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!data && !error && <ActivityIndicator color={palette.accent} style={{ marginTop: 40 }} />}
        {!!error && <Text style={styles.error}>{error}</Text>}

        {data && (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Current plan</Text>
              <Text style={styles.plan}>{data.entitlement.plan === "free" ? "No paid plan" : data.entitlement.planName}</Text>
              <Text style={styles.muted}>Files up to {Math.round(data.entitlement.limits.maxFileBytes / 1048576)} MB each</Text>
              {data.entitlement.lifetime && (
                <Text style={styles.muted}>Lifetime access since {formatDate(data.entitlement.lifetime.purchasedAt)}. No renewals, no expiry.</Text>
              )}
            </View>

            {data.entitlement.hasDuplicateSubscriptions && (
              <View style={styles.warning}>
                <Ionicons name="warning-outline" size={18} color={palette.warning} />
                <Text style={styles.warningText}>
                  {data.entitlement.lifetime
                    ? "You have Advanced Lifetime and a subscription that still renews. Cancel the subscription from your account on the FastChat website."
                    : "You have more than one active subscription. Cancel one from your account on the FastChat website to avoid paying twice."}
                </Text>
              </View>
            )}

            {data.subscriptions.map((s) => (
              <View key={s.id} style={styles.subRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subTitle}>
                    {(s.plan ?? "Plan").replace(/^./, (c) => c.toUpperCase())} · {s.interval === "year" ? "yearly" : "monthly"}
                  </Text>
                  <Text style={styles.muted}>
                    Billed on the web
                    {s.status === "trialing" && s.trialEnd ? ` · trial ends ${formatDate(s.trialEnd)}` : ""}
                    {s.scheduledChange?.action === "cancel" ? ` · ends ${formatDate(s.scheduledChange.at)}` : ""}
                  </Text>
                </View>
                <Text style={styles.badge}>{STATUS_LABEL[s.status] ?? s.status}</Text>
              </View>
            ))}

            {webSubs.length > 0 && <Text style={styles.muted}>Your web subscription is managed from your account on the FastChat website.</Text>}
            {data.entitlement.plan === "free" && (
              <Text style={[styles.muted, { marginTop: 8 }]}>{"Plans can't be purchased in the app."}</Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  title: { color: palette.text, fontSize: 20, fontWeight: "700" },
  content: { padding: 20, gap: 14 },
  card: { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: radius.lg, padding: 20 },
  label: { color: palette.textMuted, fontSize: 13 },
  plan: { color: palette.text, fontSize: 26, fontWeight: "800", marginTop: 4 },
  muted: { color: palette.textMuted, fontSize: 14, marginTop: 4, lineHeight: 20 },
  error: { color: palette.danger, fontSize: 15, marginTop: 20 },
  warning: { flexDirection: "row", gap: 10, backgroundColor: "rgba(251, 191, 36, 0.1)", borderRadius: radius.md, padding: 14 },
  warningText: { color: palette.warning, flex: 1, fontSize: 14, lineHeight: 20 },
  subRow: { flexDirection: "row", alignItems: "center", gap: 12, borderColor: palette.border, borderWidth: 1, borderRadius: radius.md, padding: 14 },
  subTitle: { color: palette.text, fontSize: 15, fontWeight: "600" },
  badge: { color: palette.text, backgroundColor: palette.surfaceRaised, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, overflow: "hidden" },
});
