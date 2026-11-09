import { palette, radius } from "@/constants/design";
import financeService from "@/services/financeService";
import { useCurrency } from "@/context/CurrencyContext";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SimulationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { formatMoney } = useCurrency();

  const [sim, setSim] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadSimulation = useCallback(async () => {
    if (!id) return;
    try {
      const data = await financeService.getSimulationById(id);
      setSim(data);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load simulation details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSimulation();
  }, [loadSimulation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#635BFF" />
        <Text style={styles.loadingText}>Loading AI simulation analysis...</Text>
      </SafeAreaView>
    );
  }

  if (!sim) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorTitle}>Simulation Not Found</Text>
        <Pressable onPress={() => router.back()} style={styles.backButtonCenter}>
          <Text style={styles.backButtonCenterText}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const riskLevel = sim.risk_level || "SAFE";
  const isSafe = riskLevel === "SAFE";
  const isTight = riskLevel === "TIGHT";
  const riskColor = isSafe ? "#10B981" : isTight ? "#F59E0B" : "#EF4444";

  return (
    <SafeAreaView style={styles.screen}>
      {/* Top App Bar */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={styles.headerSub}>AI DECISION EVALUATION</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {sim.plan_name || "Purchase Simulation"}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Risk Banner Card */}
        <View style={[styles.riskBanner, { borderColor: `${riskColor}50`, backgroundColor: `${riskColor}12` }]}>
          <View style={[styles.riskIconWrap, { borderColor: riskColor, backgroundColor: `${riskColor}25` }]}>
            <Ionicons
              name={isSafe ? "checkmark" : isTight ? "alert" : "close"}
              size={24}
              color={riskColor}
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.rowAlign}>
              <View style={[styles.riskBadge, { backgroundColor: riskColor }]}>
                <Text style={styles.riskBadgeText}>{riskLevel} IMPACT</Text>
              </View>
              <Text style={styles.evalDate}>
                {new Date(sim.created_at).toLocaleDateString()}
              </Text>
            </View>
            <Text style={styles.riskHeadline}>
              {isSafe
                ? "Financially Safe & Recommended"
                : isTight
                ? "Budget Strain Warning"
                : "High Risk / Caution Required"}
            </Text>
            <Text style={styles.riskExplanation}>
              {sim.ai_guidance?.summary ||
                (isSafe
                  ? "This purchase fits cleanly within your disposable monthly surplus and liquid reserves."
                  : "This commitment leaves your monthly buffer extremely thin or threatens emergency savings.")}
            </Text>
          </View>
        </View>

        {/* Purchase Summary Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Purchase Parameters</Text>
          <View style={styles.paramGrid}>
            <View style={styles.paramItem}>
              <Text style={styles.paramLabel}>Purchase / Capital</Text>
              <Text style={styles.paramValue}>{formatMoney(sim.purchase_amount)}</Text>
            </View>
            <View style={styles.paramItem}>
              <Text style={styles.paramLabel}>Evaluation Method</Text>
              <Text style={styles.paramValue}>
                {sim.payment_type === "loan" ? "Financing / Loan" : "Upfront (Cash)"}
              </Text>
            </View>
            {sim.loan_duration ? (
              <View style={styles.paramItem}>
                <Text style={styles.paramLabel}>Loan Term</Text>
                <Text style={styles.paramValue}>{sim.loan_duration} Months</Text>
              </View>
            ) : null}
            {sim.interest_rate ? (
              <View style={styles.paramItem}>
                <Text style={styles.paramLabel}>Interest Rate</Text>
                <Text style={styles.paramValue}>{sim.interest_rate}% APR</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Options Comparison Table */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Strategy Comparison</Text>
          <View style={styles.compRow}>
            <Text style={styles.compLabel}>Pay Upfront Total Cost</Text>
            <Text style={styles.compVal}>{formatMoney(sim.purchase_amount)}</Text>
          </View>
          <View style={styles.compRow}>
            <Text style={styles.compLabel}>Est. Monthly Financing</Text>
            <Text style={styles.compVal}>{formatMoney(sim.monthly_payment)} / mo</Text>
          </View>
          <View style={styles.compRow}>
            <Text style={styles.compLabel}>Capital Recovery Period</Text>
            <Text style={[styles.compVal, { color: "#00D4FF" }]}>
              {sim.months_to_recover ? `${sim.months_to_recover} Months` : "N/A"}
            </Text>
          </View>
          <View style={styles.compRow}>
            <Text style={styles.compLabel}>Post-Purchase Monthly Surplus</Text>
            <Text
              style={[
                styles.compVal,
                { color: (sim.remaining_cushion || 0) >= 0 ? "#10B981" : "#EF4444" },
              ]}
            >
              {formatMoney(sim.remaining_cushion)}
            </Text>
          </View>
        </View>

        {/* AI Action Recommendations */}
        <View style={styles.card}>
          <View style={styles.rowAlign}>
            <Ionicons name="sparkles" size={18} color="#635BFF" />
            <Text style={[styles.cardTitle, { marginLeft: 8 }]}>AI Strategic Advice</Text>
          </View>
          <Text style={styles.adviceText}>
            {sim.ai_guidance?.recommendation ||
              "Maintain at least 3 months of emergency expenses before taking on additional commitments. Prioritize cashflow preservation."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B132B",
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#0B132B",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 12,
    marginBottom: 16,
  },
  backButtonCenter: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: "#635BFF",
    borderRadius: 12,
  },
  backButtonCenterText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  iconBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  headerSub: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: "#00D4FF",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 2,
  },

  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },

  // Risk Banner
  riskBanner: {
    flexDirection: "row",
    padding: 18,
    borderRadius: 22,
    borderWidth: 1.5,
    gap: 14,
  },
  riskIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowAlign: {
    flexDirection: "row",
    alignItems: "center",
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  riskBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  evalDate: {
    fontSize: 11,
    color: palette.textFaint,
    marginLeft: 8,
  },
  riskHeadline: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 8,
  },
  riskExplanation: {
    fontSize: 13,
    color: palette.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },

  // Card
  card: {
    backgroundColor: "#0F172A",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  paramGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  paramItem: {
    width: "48%",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 10,
    borderRadius: 12,
  },
  paramLabel: {
    fontSize: 11,
    color: palette.textMuted,
    fontWeight: "600",
  },
  paramValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 3,
  },

  compRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  compLabel: {
    fontSize: 13,
    color: palette.textMuted,
  },
  compVal: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  adviceText: {
    fontSize: 13,
    color: palette.textMuted,
    lineHeight: 20,
  },
});
