import { palette, radius } from "@/constants/design";
import financeService, { BusinessItem } from "@/services/financeService";
import { useCurrency } from "@/context/CurrencyContext";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const TX_TYPES = [
  { key: "PROFIT", label: "Profit / Sale (+)", color: "#10B981" },
  { key: "EXPENSE", label: "Expense (-)", color: "#EF4444" },
  { key: "INVESTMENT", label: "Capital Invested (+)", color: "#635BFF" },
  { key: "WITHDRAWAL", label: "Withdrawal (-)", color: "#F59E0B" },
];

export default function BusinessDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currency, currencySymbol, formatMoney, changeCurrency, currencies } = useCurrency();

  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currencyModal, setCurrencyModal] = useState(false);

  // Record Transaction state
  const [txModal, setTxModal] = useState(false);
  const [txType, setTxType] = useState("PROFIT");
  const [txName, setTxName] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txNote, setTxNote] = useState("");
  const [txSubmitting, setTxSubmitting] = useState(false);

  const loadBusiness = useCallback(async () => {
    if (!id) return;
    try {
      const data = await financeService.getBusinessById(id);
      setBusiness(data);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load venture details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadBusiness();
  }, [loadBusiness]);

  const onRefresh = () => {
    setRefreshing(true);
    loadBusiness();
  };

  const handleDeleteBusiness = () => {
    Alert.alert(
      "Delete Venture",
      `Are you sure you want to delete "${business?.name}"? All associated ledger transactions will be permanently deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await financeService.deleteBusiness(id);
              router.back();
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete venture");
            }
          },
        },
      ]
    );
  };

  const handleRecordTransaction = async () => {
    if (!txName.trim()) {
      Alert.alert("Required", "Please provide a transaction description / title.");
      return;
    }
    const val = Number(txAmount);
    if (isNaN(val) || val <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount greater than 0.");
      return;
    }

    try {
      setTxSubmitting(true);
      await financeService.createTransaction({
        businessId: id,
        type: txType,
        name: txName.trim(),
        amount: val,
        note: txNote.trim() || undefined,
        transactionDate: new Date().toISOString(),
      });
      setTxModal(false);
      setTxName("");
      setTxAmount("");
      setTxNote("");
      loadBusiness();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to record transaction");
    } finally {
      setTxSubmitting(false);
    }
  };

  const handleDeleteTransaction = (txId: string, txTitle: string) => {
    Alert.alert("Delete Entry", `Delete transaction "${txTitle}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await financeService.deleteTransaction(txId);
            loadBusiness();
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to delete transaction");
          }
        },
      },
    ]);
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (!business?.recentTransactions) return [];
    return business.recentTransactions.filter((tx: any) => {
      const matchType = activeFilter === "ALL" || tx.type === activeFilter;
      const matchQuery =
        !searchQuery.trim() ||
        tx.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.note?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchQuery;
    });
  }, [business, activeFilter, searchQuery]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#635BFF" />
        <Text style={styles.loadingText}>Loading venture ledger...</Text>
      </SafeAreaView>
    );
  }

  if (!business) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={styles.errorTitle}>Venture Not Found</Text>
        <Pressable onPress={() => router.back()} style={styles.backButtonCenter}>
          <Text style={styles.backButtonCenterText}>Back to Ventures</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isProfitable = (business.netProfit || 0) >= 0;

  return (
    <SafeAreaView style={styles.screen}>
      {/* ── Top App Bar ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={styles.headerSub}>VENTURE LEDGER & DETAILS</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {business.name}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable onPress={() => setCurrencyModal(true)} style={styles.currencyBadgeBtn}>
            <Text style={styles.currencyBadgeBtnText}>{currencySymbol} {currency}</Text>
            <Ionicons name="chevron-down" size={12} color="#00D4FF" />
          </Pressable>
          <Pressable onPress={handleDeleteBusiness} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={20} color="#F87171" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#635BFF" />}
      >
        {/* ── Hero Balance Card (Mayramao Style) ── */}
        <View style={styles.heroCard}>
          <View style={styles.blurCircle1} />
          <View style={styles.blurCircle2} />

          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroLabel}>CURRENT VENTURE BALANCE</Text>
              <Text style={styles.heroAmount}>
                {formatMoney(business.currentBalance)}
              </Text>
            </View>
            <View
              style={[
                styles.profitBadge,
                { backgroundColor: isProfitable ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)" },
              ]}
            >
              <Ionicons
                name={isProfitable ? "trending-up" : "trending-down"}
                size={16}
                color={isProfitable ? "#10B981" : "#EF4444"}
              />
              <Text style={[styles.profitBadgeText, { color: isProfitable ? "#10B981" : "#EF4444" }]}>
                {formatMoney(business.netProfit, true)} Profit
              </Text>
            </View>
          </View>

          {business.description ? (
            <Text style={styles.heroDesc}>{business.description}</Text>
          ) : null}

          <View style={styles.heroFooter}>
            <Text style={styles.heroDate}>
              Started: {new Date(business.startDate || business.created_at).toLocaleDateString()}
            </Text>
            <Text style={styles.heroDate}>
              {business.transactionCount || business.recentTransactions?.length || 0} Transactions
            </Text>
          </View>
        </View>

        {/* ── 4 Key Financial Metrics (2x2 Grid) ── */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <View style={styles.metricIconWrap}>
              <Ionicons name="wallet-outline" size={16} color="#635BFF" />
            </View>
            <Text style={styles.metricLabel}>Capital Invested</Text>
            <Text style={styles.metricValue}>
              {formatMoney(business.totalInvestment)}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
              <Ionicons name="trending-up" size={16} color="#10B981" />
            </View>
            <Text style={styles.metricLabel}>Total Gross Sales</Text>
            <Text style={[styles.metricValue, { color: "#10B981" }]}>
              {formatMoney(business.totalSales)}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}>
              <Ionicons name="receipt-outline" size={16} color="#EF4444" />
            </View>
            <Text style={styles.metricLabel}>Total Expenses</Text>
            <Text style={[styles.metricValue, { color: "#EF4444" }]}>
              {formatMoney(business.totalExpenses)}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <View
              style={[
                styles.metricIconWrap,
                { backgroundColor: isProfitable ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)" },
              ]}
            >
              <Ionicons name="pie-chart-outline" size={16} color={isProfitable ? "#10B981" : "#EF4444"} />
            </View>
            <Text style={styles.metricLabel}>Net Profit Margin</Text>
            <Text style={[styles.metricValue, { color: isProfitable ? "#10B981" : "#EF4444" }]}>
              {formatMoney(business.netProfit, true)}
            </Text>
          </View>
        </View>

        {/* ── Quick Action Bar ── */}
        <View style={styles.actionRow}>
          <Pressable onPress={() => setTxModal(true)} style={styles.addTxBtn}>
            <Ionicons name="add-circle" size={18} color="#FFFFFF" />
            <Text style={styles.addTxBtnText}>Record Transaction</Text>
          </Pressable>
        </View>

        {/* ── Venture Ledger Header ── */}
        <View style={styles.ledgerHeaderRow}>
          <Text style={styles.sectionTitle}>Ledger Activity</Text>
          <Text style={styles.sectionBadge}>{filteredTransactions.length} entries</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={palette.textFaint} />
          <TextInput
            placeholder="Search transactions..."
            placeholderTextColor={palette.textFaint}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color={palette.textFaint} />
            </Pressable>
          ) : null}
        </View>

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {["ALL", "PROFIT", "EXPENSE", "INVESTMENT", "WITHDRAWAL"].map((filter) => (
            <Pressable
              key={filter}
              onPress={() => setActiveFilter(filter)}
              style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, activeFilter === filter && styles.filterChipTextActive]}>
                {filter === "PROFIT" ? "Sales / Profit" : filter}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── Ledger Transactions List ── */}
        {filteredTransactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={40} color={palette.textFaint} />
            <Text style={styles.emptyTitle}>No transactions recorded</Text>
            <Text style={styles.emptySub}>
              Tap "Record Transaction" above to add sales, operational expenses, or additional investments.
            </Text>
          </View>
        ) : (
          <View style={styles.txListContainer}>
            {filteredTransactions.map((tx: any) => {
              const isPositive = tx.type === "PROFIT" || tx.type === "SELL";
              const isNeutralInvest = tx.type === "INVESTMENT";
              const color = isPositive ? "#10B981" : isNeutralInvest ? "#635BFF" : "#EF4444";

              return (
                <View key={tx.id} style={styles.txCard}>
                  <View style={[styles.txTypeIconWrap, { backgroundColor: `${color}18` }]}>
                    <Ionicons
                      name={
                        isPositive
                          ? "arrow-up"
                          : isNeutralInvest
                          ? "wallet"
                          : "arrow-down"
                      }
                      size={16}
                      color={color}
                    />
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <Text style={styles.txCardTitle}>{tx.name}</Text>
                    <View style={styles.txMetaRow}>
                      <Text style={styles.txDate}>
                        {new Date(tx.transaction_date).toLocaleDateString()}
                      </Text>
                      <View style={[styles.typeBadge, { borderColor: `${color}40` }]}>
                        <Text style={[styles.typeBadgeText, { color }]}>{tx.type}</Text>
                      </View>
                    </View>
                    {tx.note ? <Text style={styles.txNote}>{tx.note}</Text> : null}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.txAmountText, { color }]}>
                      {formatMoney(tx.amount, isPositive)}
                    </Text>
                    <Pressable
                      onPress={() => handleDeleteTransaction(tx.id, tx.name)}
                      hitSlop={8}
                      style={{ marginTop: 6 }}
                    >
                      <Ionicons name="trash-outline" size={15} color={palette.textFaint} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── Record Transaction Modal ── */}
      <Modal visible={txModal} transparent animationType="slide" onRequestClose={() => setTxModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Transaction</Text>
              <Pressable onPress={() => setTxModal(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={palette.text} />
              </Pressable>
            </View>

            {/* Type selector */}
            <Text style={styles.inputLabel}>Transaction Type</Text>
            <View style={styles.typePillGrid}>
              {TX_TYPES.map((t) => (
                <Pressable
                  key={t.key}
                  onPress={() => setTxType(t.key)}
                  style={[
                    styles.typePill,
                    txType === t.key && { backgroundColor: t.color, borderColor: t.color },
                  ]}
                >
                  <Text
                    style={[
                      styles.typePillText,
                      txType === t.key && { color: "#FFFFFF", fontWeight: "700" },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Title */}
            <Text style={styles.inputLabel}>Title / Description</Text>
            <TextInput
              placeholder="e.g. Client Project Payment, Inventory purchase"
              placeholderTextColor={palette.textFaint}
              value={txName}
              onChangeText={setTxName}
              style={styles.input}
            />

            {/* Amount */}
            <Text style={styles.inputLabel}>Amount ({currencySymbol})</Text>
            <TextInput
              placeholder="0.00"
              placeholderTextColor={palette.textFaint}
              value={txAmount}
              onChangeText={setTxAmount}
              keyboardType="numeric"
              style={styles.input}
            />

            {/* Note */}
            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              placeholder="Additional details..."
              placeholderTextColor={palette.textFaint}
              value={txNote}
              onChangeText={setTxNote}
              style={styles.input}
            />

            <View style={styles.modalActions}>
              <Pressable onPress={() => setTxModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleRecordTransaction}
                disabled={txSubmitting}
                style={[styles.saveBtn, txSubmitting && { opacity: 0.6 }]}
              >
                {txSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Record Entry</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Currency Settings Modal ── */}
      <Modal visible={currencyModal} transparent animationType="slide" onRequestClose={() => setCurrencyModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Currency Settings</Text>
                <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 2 }}>
                  Select preferred currency across all accounts & reports
                </Text>
              </View>
              <Pressable onPress={() => setCurrencyModal(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={palette.text} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 360, marginTop: 10 }}>
              <View style={{ gap: 8 }}>
                {currencies.map((c) => {
                  const selected = currency === c.code;
                  return (
                    <Pressable
                      key={c.code}
                      onPress={async () => {
                        await changeCurrency(c.code);
                        setCurrencyModal(false);
                      }}
                      style={[
                        styles.currencyRow,
                        selected && styles.currencyRowActive,
                      ]}
                    >
                      <View style={[styles.currencyIconWrap, selected && styles.currencyIconWrapActive]}>
                        <Text style={[styles.currencyIconText, selected && styles.currencyIconTextActive]}>
                          {c.symbol}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.currencyCodeText, selected && { color: "#00D4FF" }]}>
                          {c.name}
                        </Text>
                        <Text style={styles.currencySubText}>Code: {c.code}</Text>
                      </View>
                      {selected && (
                        <Ionicons name="checkmark-circle" size={20} color="#00D4FF" />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 40,
    gap: 16,
  },

  // Hero Card
  heroCard: {
    backgroundColor: "#0F172A",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    position: "relative",
    overflow: "hidden",
    gap: 12,
  },
  blurCircle1: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(0, 212, 255, 0.08)",
  },
  blurCircle2: {
    position: "absolute",
    bottom: -30,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(99, 91, 255, 0.08)",
  },
  heroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: palette.textMuted,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 4,
  },
  profitBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  profitBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  heroDesc: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  heroFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    paddingTop: 10,
  },
  heroDate: {
    color: palette.textFaint,
    fontSize: 11,
  },

  // 2x2 Metrics Grid
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  metricCard: {
    width: "48%",
    backgroundColor: "#0F172A",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    gap: 4,
  },
  metricIconWrap: {
    alignSelf: "flex-start",
    padding: 6,
    borderRadius: 10,
    backgroundColor: "rgba(99, 91, 255, 0.12)",
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: palette.textMuted,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 2,
  },

  // Action Button
  actionRow: {
    marginTop: 2,
  },
  addTxBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#635BFF",
    paddingVertical: 14,
    borderRadius: 18,
    gap: 8,
    shadowColor: "#635BFF",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  addTxBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  // Ledger section
  ledgerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  sectionBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.textMuted,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 8,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
  },

  // Filter Row
  filterRow: {
    gap: 8,
    paddingVertical: 4,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  filterChipActive: {
    backgroundColor: "#00D4FF",
    borderColor: "#00D4FF",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.textMuted,
  },
  filterChipTextActive: {
    color: "#0B132B",
  },

  // Transactions list
  txListContainer: {
    gap: 10,
  },
  txCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  txTypeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  txCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  txMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  txDate: {
    fontSize: 11,
    color: palette.textFaint,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  txNote: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 3,
  },
  txAmountText: {
    fontSize: 15,
    fontWeight: "800",
  },

  // Empty Card
  emptyCard: {
    backgroundColor: "#0F172A",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  emptySub: {
    fontSize: 12,
    color: palette.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: "#0F172A",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    gap: 10,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.textMuted,
    marginTop: 4,
  },
  typePillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 4,
  },
  typePill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  typePillText: {
    fontSize: 11,
    color: palette.textMuted,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#070B14",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontSize: 14,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cancelBtnText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  saveBtn: {
    backgroundColor: "#635BFF",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  // Currency Selector
  currencyBadgeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 212, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(0, 212, 255, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    gap: 4,
  },
  currencyBadgeBtnText: {
    color: "#00D4FF",
    fontSize: 12,
    fontWeight: "800",
  },
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
  },
  currencyRowActive: {
    borderColor: "#00D4FF",
    backgroundColor: "rgba(0, 212, 255, 0.1)",
  },
  currencyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  currencyIconWrapActive: {
    backgroundColor: "rgba(0, 212, 255, 0.2)",
  },
  currencyIconText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  currencyIconTextActive: {
    color: "#00D4FF",
  },
  currencyCodeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  currencySubText: {
    color: palette.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
});
