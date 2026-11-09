import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { palette, radius } from "@/constants/design";
import financeService, { BusinessItem, FinanceDashboardData } from "@/services/financeService";
import { useCurrency } from "@/context/CurrencyContext";

const { width } = Dimensions.get("window");

type FinanceTab = "overview" | "simulator" | "portfolio" | "ledger" | "goals";

export default function FinanceScreen() {
  const router = useRouter();
  const { currency, currencySymbol, formatMoney, changeCurrency, currencies } = useCurrency();
  const [tab, setTab] = useState<FinanceTab>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<FinanceDashboardData | null>(null);
  const [currencyModal, setCurrencyModal] = useState(false);


  // Ledger / Transaction List
  const [txList, setTxList] = useState<any[]>([]);
  const [txFilter, setTxFilter] = useState("ALL");
  const [txSearch, setTxSearch] = useState("");

  // Simulation State
  const [simPlanName, setSimPlanName] = useState("Gadget / Tech Setup");
  const [simAmount, setSimAmount] = useState("3500");
  const [simPaymentType, setSimPaymentType] = useState<"full" | "loan">("full");
  const [simLoanDuration, setSimLoanDuration] = useState("12");
  const [simInterestRate, setSimInterestRate] = useState("6.5");
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [simHistory, setSimHistory] = useState<any[]>([]);

  // Profile Form
  const [profileMonthlyIncome, setProfileMonthlyIncome] = useState("0");
  const [profileRent, setProfileRent] = useState("0");
  const [profileUtilities, setProfileUtilities] = useState("0");
  const [profileExistingLoans, setProfileExistingLoans] = useState("0");
  const [profileVariableExpenses, setProfileVariableExpenses] = useState("0");
  const [profileCurrentSavings, setProfileCurrentSavings] = useState("0");
  const [savingProfile, setSavingProfile] = useState(false);

  // Business Modal
  const [bizModal, setBizModal] = useState(false);
  const [bizName, setBizName] = useState("");
  const [bizDesc, setBizDesc] = useState("");
  const [bizCapital, setBizCapital] = useState("0");
  const [bizOpening, setBizOpening] = useState("0");

  // Transaction Modal
  const [txModal, setTxModal] = useState(false);
  const [txType, setTxType] = useState("PROFIT");
  const [txBizId, setTxBizId] = useState("");
  const [txName, setTxName] = useState("");
  const [txAmount, setTxAmount] = useState("");

  // Goal Modal
  const [goalModal, setGoalModal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("5000");
  const [goalCurrent, setGoalCurrent] = useState("1000");

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await financeService.getDashboard();
      setDashboard(data);
      if (data?.profile) {
        setProfileMonthlyIncome(String(data.profile.monthlyIncome || 0));
        setProfileRent(String(data.profile.rent || 0));
        setProfileUtilities(String(data.profile.utilities || 0));
        setProfileExistingLoans(String(data.profile.existingLoans || 0));
        setProfileVariableExpenses(String(data.profile.variableExpenses || 0));
        setProfileCurrentSavings(String(data.profile.currentSavings || 0));
      }
      if (data?.recentSimulations) {
        setSimHistory(data.recentSimulations);
      }
    } catch (err: any) {
      console.warn("Error fetching finance data:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadTransactions = async (filterType = txFilter, search = txSearch) => {
    try {
      const params: any = {};
      if (filterType !== "ALL") params.type = filterType;
      if (search.trim()) params.search = search.trim();
      const txs = await financeService.getTransactions(params);
      setTxList(txs || []);
    } catch (err: any) {
      console.warn("Error fetching transactions:", err.message);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadTransactions("ALL", "");
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
    loadTransactions(txFilter, txSearch);
  }, [txFilter, txSearch]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
      loadTransactions(txFilter, txSearch);
    }, [txFilter, txSearch])
  );

  const openBusiness = (b: BusinessItem) => {
    router.push({
      pathname: "/screens/finance/BusinessDetailScreen",
      params: { id: b.id },
    });
  };

  const handleRunSimulation = async () => {
    const amount = Number(simAmount);
    if (!amount || amount <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid purchase or investment amount.");
      return;
    }
    try {
      setSimulating(true);
      const sim = await financeService.runSimulation({
        purchaseAmount: amount,
        paymentType: simPaymentType,
        loanDuration: Number(simLoanDuration) || 12,
        interestRate: Number(simInterestRate) || 0,
        planName: simPlanName,
      });
      setSimResult(sim?.simulation_result || null);
      loadDashboard();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Simulation failed");
    } finally {
      setSimulating(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      await financeService.updateProfile({
        monthly_income: Number(profileMonthlyIncome) || 0,
        rent: Number(profileRent) || 0,
        utilities: Number(profileUtilities) || 0,
        existing_loans: Number(profileExistingLoans) || 0,
        variable_expenses: Number(profileVariableExpenses) || 0,
        current_savings: Number(profileCurrentSavings) || 0,
      });
      Alert.alert("Success", "Financial profile updated!");
      loadDashboard();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateBusiness = async () => {
    if (!bizName.trim()) {
      Alert.alert("Validation", "Please enter business name.");
      return;
    }
    try {
      await financeService.createBusiness({
        name: bizName.trim(),
        description: bizDesc.trim(),
        initialInvestment: Number(bizCapital) || 0,
        openingBalance: Number(bizOpening) || 0,
      });
      setBizModal(false);
      setBizName("");
      setBizDesc("");
      setBizCapital("0");
      setBizOpening("0");
      loadDashboard();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to create business");
    }
  };

  const handleDeleteBusiness = async (id: string) => {
    Alert.alert("Delete Venture", "Are you sure you want to delete this business?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await financeService.deleteBusiness(id);
            loadDashboard();
          } catch (err: any) {
            Alert.alert("Error", err.response?.data?.message || "Failed to delete");
          }
        },
      },
    ]);
  };

  const handleCreateTransaction = async () => {
    const amt = Number(txAmount);
    if (!txName.trim() || !amt || amt <= 0) {
      Alert.alert("Validation", "Please enter a valid title and amount.");
      return;
    }
    try {
      await financeService.createTransaction({
        businessId: txBizId || undefined,
        type: txType,
        name: txName.trim(),
        amount: amt,
      });
      setTxModal(false);
      setTxName("");
      setTxAmount("");
      setTxBizId("");
      loadDashboard();
      loadTransactions(txFilter, txSearch);
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to record transaction");
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await financeService.deleteTransaction(id);
      loadDashboard();
      loadTransactions(txFilter, txSearch);
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to delete");
    }
  };

  const handleCreateGoal = async () => {
    if (!goalTitle.trim()) {
      Alert.alert("Validation", "Please enter goal title.");
      return;
    }
    try {
      await financeService.createGoal({
        title: goalTitle.trim(),
        targetAmount: Number(goalTarget) || 0,
        currentAmount: Number(goalCurrent) || 0,
      });
      setGoalModal(false);
      setGoalTitle("");
      setGoalTarget("5000");
      setGoalCurrent("1000");
      loadDashboard();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to create goal");
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await financeService.deleteGoal(id);
      loadDashboard();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to delete goal");
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00D4FF" />
      </View>
    );
  }

  const p = dashboard?.profile;
  const port = dashboard?.portfolio;
  const goals = dashboard?.goals?.items || [];
  const businesses = port?.businesses || [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#070B14" />

      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.subBrand}>MAYRAMAO INTEGRATED</Text>
          <Text style={styles.brandTitle}>Fast Finance Hub</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable onPress={() => setCurrencyModal(true)} style={styles.currencyBadgeBtn}>
            <Text style={styles.currencyBadgeBtnText}>{currencySymbol} {currency}</Text>
            <Ionicons name="chevron-down" size={12} color="#00D4FF" />
          </Pressable>
          <Pressable onPress={loadDashboard} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color="#00D4FF" />
          </Pressable>
        </View>
      </View>

      {/* Navigation Sub-Tabs */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {(
            [
              { id: "overview", label: "Overview", icon: "pie-chart" },
              { id: "simulator", label: "AI Simulator", icon: "calculator" },
              { id: "portfolio", label: "Ventures", icon: "briefcase" },
              { id: "ledger", label: "Ledger", icon: "card" },
              { id: "goals", label: "Goals & Budget", icon: "flag" },
            ] as const
          ).map((t) => {
            const active = tab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                style={[styles.tabButton, active && styles.tabButtonActive]}
              >
                <Ionicons
                  name={t.icon as any}
                  size={14}
                  color={active ? "#00D4FF" : palette.textMuted}
                />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D4FF" />}
      >
        {/* ── 1. OVERVIEW TAB (Mayramao FinancialOverviewCard + DecisionStatsCard) ── */}
        {tab === "overview" && (
          <View style={styles.sectionWrap}>
            {/* Signature Mayramao FinancialOverviewCard */}
            <View style={styles.mayramaoHeroCard}>
              {/* Decorative circles */}
              <View style={styles.heroCircle1} />
              <View style={styles.heroCircle2} />

              <View style={styles.heroMain}>
                <Text style={styles.heroLabel}>MONTHLY DISPOSABLE CUSHION</Text>
                <Text style={styles.heroValue}>
                  {formatMoney(p?.monthlyDisposable)}
                </Text>
                <Text style={styles.heroSub}>
                  Surplus after {formatMoney(p?.totalMonthlyExpenses)} living costs
                </Text>
              </View>

              {/* Glassmorphic Stat Boxes */}
              <View style={styles.heroRow}>
                <View style={styles.heroStatBox}>
                  <Text style={styles.heroStatLabel}>Liquid Savings</Text>
                  <Text style={styles.heroStatValue}>
                    {formatMoney(p?.currentSavings)}
                  </Text>
                </View>
                <View style={styles.heroStatBox}>
                  <Text style={styles.heroStatLabel}>Fixed Expenses</Text>
                  <Text style={styles.heroStatValue}>
                    {formatMoney(p?.fixedExpenses)}
                  </Text>
                </View>
                <View style={styles.heroStatBox}>
                  <Text style={styles.heroStatLabel}>Ventures Profit</Text>
                  <Text
                    style={[
                      styles.heroStatValue,
                      { color: (port?.netProfit || 0) >= 0 ? "#10B981" : "#EF4444" },
                    ]}
                  >
                    {formatMoney(port?.netProfit, true)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Decision Stats Cards (Mayramao DecisionStatsCard) */}
            <View style={styles.grid2}>
              <View style={styles.decisionCard}>
                <View style={styles.decisionIconWrapSafe}>
                  <Ionicons name="trending-up" size={18} color="#10B981" />
                </View>
                <Text style={styles.decisionPctSafe}>
                  {simHistory.length > 0
                    ? Math.round((simHistory.filter((s) => s.risk_level === "SAFE").length / simHistory.length) * 100)
                    : 100}%
                </Text>
                <Text style={styles.decisionLabel}>Safe Decisions Evaluated</Text>
              </View>

              <View style={styles.decisionCard}>
                <View style={styles.decisionIconWrapRisky}>
                  <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
                </View>
                <Text style={styles.decisionPctRisky}>
                  {simHistory.length > 0
                    ? Math.round((simHistory.filter((s) => s.risk_level !== "SAFE").length / simHistory.length) * 100)
                    : 0}%
                </Text>
                <Text style={styles.decisionLabel}>Caution / High Impact</Text>
              </View>
            </View>

            {/* Quick Action CTAs */}
            <View style={styles.grid2}>
              <Pressable
                onPress={() => setTab("simulator")}
                style={styles.actionGradientBtn}
              >
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Test Purchase / Loan</Text>
              </Pressable>

              <Pressable
                onPress={() => setTxModal(true)}
                style={styles.actionGlassBtn}
              >
                <Ionicons name="add-circle-outline" size={18} color="#00D4FF" />
                <Text style={[styles.actionBtnText, { color: "#00D4FF" }]}>Log Transaction</Text>
              </Pressable>
            </View>

            {/* Recent Simulations (Mayramao SimulationItemCard) */}
            <View style={styles.cardFull}>
              <View style={styles.rowBetween}>
                <Text style={styles.boxTitle}>Recent Simulations</Text>
                <Pressable onPress={() => setTab("simulator")}>
                  <Text style={styles.linkText}>Open Studio</Text>
                </Pressable>
              </View>

              {simHistory.length === 0 ? (
                <Text style={styles.emptyNote}>No simulations run yet.</Text>
              ) : (
                simHistory.slice(0, 4).map((s) => {
                  const isSafe = s.risk_level === "SAFE";
                  const isTight = s.risk_level === "TIGHT";
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => {
                        router.push({
                          pathname: "/screens/finance/SimulationDetailScreen",
                          params: { id: s.id },
                        });
                      }}
                      style={styles.simulationItemCard}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.simItemName}>{s.plan_name || "Purchase Plan"}</Text>
                        <Text style={styles.simItemDate}>
                          {new Date(s.created_at).toLocaleDateString()} • {s.payment_type === "loan" ? "Financed" : "Upfront"}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.simItemPrice}>{formatMoney(s.purchase_amount)}</Text>
                        <View
                          style={[
                            styles.simBadge,
                            {
                              backgroundColor: isSafe
                                ? "rgba(16, 185, 129, 0.2)"
                                : isTight
                                ? "rgba(245, 158, 11, 0.2)"
                                : "rgba(239, 68, 68, 0.2)",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.simBadgeText,
                              { color: isSafe ? "#10B981" : isTight ? "#F59E0B" : "#EF4444" },
                            ]}
                          >
                            {s.risk_level}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>

            {/* Active Goals Preview */}
            <View style={styles.cardFull}>
              <View style={styles.rowBetween}>
                <Text style={styles.boxTitle}>Financial Goals</Text>
                <Pressable onPress={() => setTab("goals")}>
                  <Text style={styles.linkText}>Manage</Text>
                </Pressable>
              </View>
              {goals.length === 0 ? (
                <Text style={styles.emptyNote}>No active goals.</Text>
              ) : (
                goals.slice(0, 2).map((g) => {
                  const pct = Math.min(Math.round(((Number(g.current_amount) || 0) / (Number(g.target_amount) || 1)) * 100), 100);
                  return (
                    <View key={g.id} style={styles.goalRow}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.goalTitle}>{g.title}</Text>
                        <Text style={styles.goalPct}>{pct}%</Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${pct}%` }]} />
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* ── 2. SIMULATOR TAB (Mayramao Simulation Studio) ── */}
        {tab === "simulator" && (
          <View style={styles.sectionWrap}>
            <View style={styles.cardFull}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Ionicons name="sparkles" size={20} color="#00D4FF" />
                <Text style={styles.boxTitle}>AI Purchase Simulator</Text>
              </View>
              <Text style={styles.boxSub}>
                Test debt-to-income impact, pay-in-full recovery, and loan comparison.
              </Text>

              <Text style={styles.inputLabel}>Plan / Item Name</Text>
              <TextInput
                value={simPlanName}
                onChangeText={setSimPlanName}
                style={styles.input}
                placeholder="e.g. Server Farm, New Car, Tech Setup"
                placeholderTextColor={palette.textFaint}
              />

              <Text style={styles.inputLabel}>Purchase / Capital Amount ({currencySymbol})</Text>
              <TextInput
                value={simAmount}
                onChangeText={setSimAmount}
                keyboardType="numeric"
                style={[styles.input, { fontWeight: "700" }]}
              />

              <Text style={styles.inputLabel}>Payment Method</Text>
              <View style={styles.methodToggle}>
                <Pressable
                  onPress={() => setSimPaymentType("full")}
                  style={[styles.toggleBtn, simPaymentType === "full" && styles.toggleBtnActiveFull]}
                >
                  <Text style={[styles.toggleText, simPaymentType === "full" && styles.toggleTextActiveFull]}>
                    Pay Upfront (Full)
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSimPaymentType("loan")}
                  style={[styles.toggleBtn, simPaymentType === "loan" && styles.toggleBtnActiveLoan]}
                >
                  <Text style={[styles.toggleText, simPaymentType === "loan" && styles.toggleTextActiveLoan]}>
                    Financing / Loan
                  </Text>
                </Pressable>
              </View>

              {simPaymentType === "loan" && (
                <View style={styles.grid2}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Duration (mo)</Text>
                    <TextInput
                      value={simLoanDuration}
                      onChangeText={setSimLoanDuration}
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Interest Rate (%)</Text>
                    <TextInput
                      value={simInterestRate}
                      onChangeText={setSimInterestRate}
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  </View>
                </View>
              )}

              <Pressable
                onPress={handleRunSimulation}
                disabled={simulating}
                style={styles.actionGradientBtn}
              >
                {simulating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>Run Smart Simulation</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Results Display */}
            {simResult && (
              <View style={styles.cardFull}>
                {/* Risk Badge */}
                <View
                  style={[
                    styles.riskBanner,
                    {
                      backgroundColor:
                        simResult.ai_guidance?.risk_level === "SAFE"
                          ? "rgba(16, 185, 129, 0.15)"
                          : simResult.ai_guidance?.risk_level === "TIGHT"
                          ? "rgba(245, 158, 11, 0.15)"
                          : "rgba(239, 68, 68, 0.15)",
                      borderColor:
                        simResult.ai_guidance?.risk_level === "SAFE"
                          ? "#10B981"
                          : simResult.ai_guidance?.risk_level === "TIGHT"
                          ? "#F59E0B"
                          : "#EF4444",
                    },
                  ]}
                >
                  <Ionicons
                    name={simResult.ai_guidance?.risk_level === "SAFE" ? "shield-checkmark" : "alert-circle"}
                    size={28}
                    color={
                      simResult.ai_guidance?.risk_level === "SAFE"
                        ? "#10B981"
                        : simResult.ai_guidance?.risk_level === "TIGHT"
                        ? "#F59E0B"
                        : "#EF4444"
                    }
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.riskTitle}>{simResult.ai_guidance?.assessment_title}</Text>
                    <Text style={styles.riskDesc}>{simResult.ai_guidance?.guidance}</Text>
                  </View>
                </View>

                {/* Comparison Details (PaymentComparisonScreen) */}
                <View style={styles.comparisonBox}>
                  <Text style={[styles.boxTitle, { fontSize: 14, marginBottom: 8 }]}>Options Comparison</Text>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Pay in Full Cost</Text>
                    <Text style={styles.statValue}>
                      {formatMoney(simResult.scenario_summary?.comparisons?.pay_in_full?.total_cost)}
                    </Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Financing Monthly</Text>
                    <Text style={styles.statValue}>
                      {formatMoney(simResult.scenario_summary?.comparisons?.financing?.monthly_payment)} / mo
                    </Text>
                  </View>
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Recovery Time</Text>
                    <Text style={styles.statValue}>
                      {simResult.scenario_summary?.recovery_months || 0} months
                    </Text>
                  </View>
                </View>

                {/* Key Insights */}
                {simResult.ai_guidance?.key_insights && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={[styles.boxSub, { fontWeight: "700", marginBottom: 6 }]}>KEY METRICS:</Text>
                    {simResult.ai_guidance.key_insights.map((k: string, idx: number) => (
                      <Text key={idx} style={styles.insightLine}>
                        • {k}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── 3. VENTURES & BUSINESSES TAB ── */}
        {tab === "portfolio" && (
          <View style={styles.sectionWrap}>
            <View style={styles.rowBetween}>
              <Text style={styles.boxTitle}>Business Ventures</Text>
              <Pressable onPress={() => setBizModal(true)} style={styles.addPillBtn}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addBtnText}>New Venture</Text>
              </Pressable>
            </View>

            {businesses.length === 0 ? (
              <View style={styles.cardFull}>
                <Text style={styles.emptyNote}>No businesses registered yet. Add your first venture!</Text>
              </View>
            ) : (
              businesses.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => openBusiness(b)}
                  style={styles.bizCard}
                >
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bizName}>{b.name}</Text>
                      <Text style={styles.bizDesc}>{b.description || "Active business venture"}</Text>
                    </View>
                    <Pressable
                      onPress={() => handleDeleteBusiness(b.id)}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={18} color={palette.textFaint} />
                    </Pressable>
                  </View>

                  <View style={styles.bizGrid}>
                    <View style={styles.metricBlock}>
                      <Text style={styles.statLabel}>Capital Invested</Text>
                      <Text style={styles.statValue}>{formatMoney(b.totalInvestment)}</Text>
                    </View>
                    <View style={styles.metricBlock}>
                      <Text style={styles.statLabel}>Total Sales</Text>
                      <Text style={[styles.statValue, { color: "#10B981" }]}>{formatMoney(b.totalSales)}</Text>
                    </View>
                    <View style={styles.metricBlock}>
                      <Text style={styles.statLabel}>Expenses</Text>
                      <Text style={[styles.statValue, { color: "#F87171" }]}>{formatMoney(b.totalExpenses)}</Text>
                    </View>
                    <View style={styles.metricBlock}>
                      <Text style={styles.statLabel}>Net Profit</Text>
                      <Text
                        style={[
                          styles.statValue,
                          { color: b.netProfit >= 0 ? "#10B981" : "#EF4444" },
                        ]}
                      >
                        {formatMoney(b.netProfit, true)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bizFooter}>
                    <Text style={styles.bizBalanceLabel}>Balance: {formatMoney(b.currentBalance)}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={styles.bizViewText}>View Ledger</Text>
                      <Ionicons name="chevron-forward" size={14} color="#00D4FF" />
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* ── 4. LEDGER / TRANSACTION TAB ── */}
        {tab === "ledger" && (
          <View style={styles.sectionWrap}>
            <View style={styles.rowBetween}>
              <Text style={styles.boxTitle}>Transaction Ledger</Text>
              <Pressable onPress={() => setTxModal(true)} style={styles.addPillBtn}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addBtnText}>Log Entry</Text>
              </Pressable>
            </View>

            {/* Filter Buttons */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {["ALL", "PROFIT", "EXPENSE", "INVESTMENT", "WITHDRAWAL"].map((t) => (
                <Pressable
                  key={t}
                  onPress={() => {
                    setTxFilter(t);
                    loadTransactions(t, txSearch);
                  }}
                  style={[styles.filterChip, txFilter === t && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, txFilter === t && styles.filterChipTextActive]}>
                    {t}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Transaction List */}
            <View style={styles.cardFull}>
              {txList.length === 0 ? (
                <Text style={styles.emptyNote}>No transactions found.</Text>
              ) : (
                txList.map((t) => {
                  const isPositive = t.type === "PROFIT" || t.type === "SELL" || t.type === "SALE";
                  return (
                    <View key={t.id} style={styles.txRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.txName}>{t.name}</Text>
                        <Text style={styles.txDate}>
                          {t.business_name || "General"} • {new Date(t.transaction_date).toLocaleDateString()} • {t.type}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Text
                          style={[
                            styles.txAmount,
                            { color: isPositive ? "#10B981" : "#F87171" },
                          ]}
                        >
                          {formatMoney(t.amount, isPositive)}
                        </Text>
                        <Pressable onPress={() => handleDeleteTransaction(t.id)} hitSlop={6}>
                          <Ionicons name="trash-outline" size={16} color={palette.textFaint} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* ── 5. GOALS & BUDGET PROFILE TAB ── */}
        {tab === "goals" && (
          <View style={styles.sectionWrap}>
            {/* Goals Tracker */}
            <View style={styles.cardFull}>
              <View style={styles.rowBetween}>
                <Text style={styles.boxTitle}>Financial Goals</Text>
                <Pressable onPress={() => setGoalModal(true)}>
                  <Text style={styles.linkText}>+ Add Goal</Text>
                </Pressable>
              </View>

              {goals.length === 0 ? (
                <Text style={styles.emptyNote}>No goals created yet.</Text>
              ) : (
                goals.map((g) => {
                  const pct = Math.min(Math.round(((Number(g.current_amount) || 0) / (Number(g.target_amount) || 1)) * 100), 100);
                  return (
                    <View key={g.id} style={styles.goalCard}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.goalTitle}>{g.title}</Text>
                        <Pressable onPress={() => handleDeleteGoal(g.id)} hitSlop={6}>
                          <Ionicons name="trash-outline" size={15} color={palette.textFaint} />
                        </Pressable>
                      </View>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${pct}%` }]} />
                      </View>
                      <View style={styles.rowBetween}>
                        <Text style={styles.goalSub}>{formatMoney(g.current_amount)} of {formatMoney(g.target_amount)}</Text>
                        <Text style={styles.goalPct}>{pct}%</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Currency Settings Card */}
            <View style={styles.cardFull}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.boxTitle}>Currency Settings</Text>
                  <Text style={styles.boxSub}>
                    Active currency: {currency} ({currencySymbol})
                  </Text>
                </View>
                <Pressable onPress={() => setCurrencyModal(true)} style={styles.currencyBadgeBtn}>
                  <Text style={styles.currencyBadgeBtnText}>Change ({currencySymbol})</Text>
                  <Ionicons name="chevron-down" size={12} color="#00D4FF" />
                </Pressable>
              </View>
            </View>

            {/* Profile Config */}
            <View style={styles.cardFull}>
              <Text style={styles.boxTitle}>Budget & Baseline Profile</Text>

              <Text style={styles.inputLabel}>Monthly Income ({currencySymbol})</Text>
              <TextInput
                value={profileMonthlyIncome}
                onChangeText={setProfileMonthlyIncome}
                keyboardType="numeric"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Rent / Housing ({currencySymbol})</Text>
              <TextInput
                value={profileRent}
                onChangeText={setProfileRent}
                keyboardType="numeric"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Utilities ({currencySymbol})</Text>
              <TextInput
                value={profileUtilities}
                onChangeText={setProfileUtilities}
                keyboardType="numeric"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Loan / Debt Payments ({currencySymbol})</Text>
              <TextInput
                value={profileExistingLoans}
                onChangeText={setProfileExistingLoans}
                keyboardType="numeric"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Variable Expenses ({currencySymbol})</Text>
              <TextInput
                value={profileVariableExpenses}
                onChangeText={setProfileVariableExpenses}
                keyboardType="numeric"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Current Liquid Savings ({currencySymbol})</Text>
              <TextInput
                value={profileCurrentSavings}
                onChangeText={setProfileCurrentSavings}
                keyboardType="numeric"
                style={styles.input}
              />

              <Pressable
                onPress={handleSaveProfile}
                disabled={savingProfile}
                style={styles.actionGradientBtn}
              >
                {savingProfile ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.actionBtnText}>Save Financial Profile</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── MODALS ── */}
      {/* Create Business Modal */}
      <Modal visible={bizModal} transparent animationType="fade" onRequestClose={() => setBizModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Venture</Text>
            <TextInput
              placeholder="Business Name"
              placeholderTextColor={palette.textFaint}
              value={bizName}
              onChangeText={setBizName}
              style={styles.input}
            />
            <TextInput
              placeholder="Description"
              placeholderTextColor={palette.textFaint}
              value={bizDesc}
              onChangeText={setBizDesc}
              style={styles.input}
            />
            <TextInput
              placeholder={`Initial Capital Invested (${currencySymbol})`}
              placeholderTextColor={palette.textFaint}
              value={bizCapital}
              onChangeText={setBizCapital}
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              placeholder={`Opening Balance (${currencySymbol})`}
              placeholderTextColor={palette.textFaint}
              value={bizOpening}
              onChangeText={setBizOpening}
              keyboardType="numeric"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setBizModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCreateBusiness} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transaction Modal */}
      <Modal visible={txModal} transparent animationType="fade" onRequestClose={() => setTxModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Record Transaction</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 6 }}>
              {[
                { key: "PROFIT", label: "Profit / Sale (+)", activeColor: "#10B981" },
                { key: "EXPENSE", label: "Expense (-)", activeColor: "#EF4444" },
                { key: "INVESTMENT", label: "Capital Invested (+)", activeColor: "#635BFF" },
                { key: "WITHDRAWAL", label: "Withdrawal (-)", activeColor: "#F59E0B" },
              ].map((t) => (
                <Pressable
                  key={t.key}
                  onPress={() => setTxType(t.key)}
                  style={[
                    styles.txChip,
                    txType === t.key && { backgroundColor: t.activeColor, borderColor: t.activeColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.txChipText,
                      txType === t.key && { color: "#FFFFFF", fontWeight: "700" },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              placeholder="Transaction Title"
              placeholderTextColor={palette.textFaint}
              value={txName}
              onChangeText={setTxName}
              style={styles.input}
            />
            <TextInput
              placeholder={`Amount (${currencySymbol})`}
              placeholderTextColor={palette.textFaint}
              value={txAmount}
              onChangeText={setTxAmount}
              keyboardType="numeric"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setTxModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCreateTransaction} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Record</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Goal Modal */}
      <Modal visible={goalModal} transparent animationType="fade" onRequestClose={() => setGoalModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Financial Goal</Text>
            <TextInput
              placeholder="Goal Title (e.g. New Car, Savings)"
              placeholderTextColor={palette.textFaint}
              value={goalTitle}
              onChangeText={setGoalTitle}
              style={styles.input}
            />
            <TextInput
              placeholder={`Target Amount (${currencySymbol})`}
              placeholderTextColor={palette.textFaint}
              value={goalTarget}
              onChangeText={setGoalTarget}
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              placeholder={`Current Saved (${currencySymbol})`}
              placeholderTextColor={palette.textFaint}
              value={goalCurrent}
              onChangeText={setGoalCurrent}
              keyboardType="numeric"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setGoalModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCreateGoal} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Currency Settings Modal */}
      <Modal visible={currencyModal} transparent animationType="slide" onRequestClose={() => setCurrencyModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.rowBetween}>
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
  container: { flex: 1, backgroundColor: "#070B14" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#070B14" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  subBrand: { color: "#00D4FF", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  brandTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginTop: 2 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 212, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(0, 212, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    paddingVertical: 10,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  tabScroll: { paddingHorizontal: 16, gap: 8 },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  tabButtonActive: {
    backgroundColor: "rgba(0, 212, 255, 0.16)",
    borderColor: "#00D4FF",
  },
  tabText: { color: palette.textMuted, fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: "#00D4FF", fontWeight: "800" },
  scrollContent: { padding: 16, paddingBottom: 60 },
  sectionWrap: { gap: 14 },

  // Mayramao Signature Hero Card
  mayramaoHeroCard: {
    borderRadius: 26,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 22,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  heroCircle1: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(0, 212, 255, 0.14)",
  },
  heroCircle2: {
    position: "absolute",
    bottom: -50,
    left: -40,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(16, 185, 129, 0.16)",
  },
  heroMain: { marginBottom: 16 },
  heroLabel: { color: "rgba(255, 255, 255, 0.7)", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  heroValue: { color: "#FFFFFF", fontSize: 36, fontWeight: "900", letterSpacing: -1, marginVertical: 4 },
  heroSub: { color: "#10B981", fontSize: 12, fontWeight: "600" },
  heroRow: { flexDirection: "row", gap: 8 },
  heroStatBox: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  heroStatLabel: { color: "rgba(255, 255, 255, 0.7)", fontSize: 11, marginBottom: 2 },
  heroStatValue: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },

  // Decision Stats Cards
  grid2: { flexDirection: "row", gap: 10 },
  decisionCard: {
    flex: 1,
    backgroundColor: "#0F172A",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  decisionIconWrapSafe: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    padding: 8,
    borderRadius: radius.pill,
  },
  decisionIconWrapRisky: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    padding: 8,
    borderRadius: radius.pill,
  },
  decisionPctSafe: { color: "#10B981", fontSize: 28, fontWeight: "900", marginTop: 8 },
  decisionPctRisky: { color: "#EF4444", fontSize: 28, fontWeight: "900", marginTop: 8 },
  decisionLabel: { color: palette.textMuted, fontSize: 11, fontWeight: "600", marginTop: 4 },

  actionGradientBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "#635BFF",
    shadowColor: "#635BFF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  actionGlassBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "rgba(0, 212, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(0, 212, 255, 0.25)",
  },
  actionBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },

  // Card
  cardFull: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 10,
  },
  boxTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  boxSub: { color: palette.textMuted, fontSize: 12, marginTop: -4 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  linkText: { color: "#00D4FF", fontSize: 13, fontWeight: "700" },
  emptyNote: { color: palette.textFaint, fontSize: 12, textAlign: "center", paddingVertical: 10 },

  // Simulation Item Card
  simulationItemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginVertical: 4,
  },
  simItemName: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  simItemDate: { color: palette.textFaint, fontSize: 11, marginTop: 2 },
  simItemPrice: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  simBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 4,
  },
  simBadgeText: { fontSize: 10, fontWeight: "800" },

  // Business Card
  bizCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 10,
  },
  bizName: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  bizDesc: { color: palette.textMuted, fontSize: 12, marginTop: 2 },
  metricBlock: {
    width: "48%",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 8,
    borderRadius: 12,
  },
  bizGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  txChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  txChipText: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  statLabel: { color: palette.textMuted, fontSize: 11 },
  statValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", marginTop: 2 },
  bizFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    paddingTop: 10,
    marginTop: 4,
  },
  bizBalanceLabel: { color: "#00D4FF", fontSize: 13, fontWeight: "700" },
  bizViewText: { color: "#00D4FF", fontSize: 12, fontWeight: "700" },

  addPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "#635BFF",
  },
  addBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  // Ledger Row
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  txName: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  txDate: { color: palette.textFaint, fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: "800" },

  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  filterChipActive: { backgroundColor: "rgba(0, 212, 255, 0.18)", borderWidth: 1, borderColor: "#00D4FF" },
  filterChipText: { color: palette.textMuted, fontSize: 11, fontWeight: "700" },
  filterChipTextActive: { color: "#00D4FF" },

  // Simulator specifics
  inputLabel: { color: palette.textMuted, fontSize: 11, fontWeight: "700", marginTop: 6 },
  input: {
    height: 48,
    borderRadius: 14,
    backgroundColor: "#070B14",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 14,
    color: "#FFFFFF",
    fontSize: 14,
    marginVertical: 4,
  },
  methodToggle: { flexDirection: "row", gap: 8, marginVertical: 4 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#070B14",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  toggleBtnActiveFull: { backgroundColor: "rgba(0, 212, 255, 0.15)", borderColor: "#00D4FF" },
  toggleBtnActiveLoan: { backgroundColor: "rgba(99, 91, 255, 0.15)", borderColor: "#635BFF" },
  toggleText: { color: palette.textMuted, fontSize: 12, fontWeight: "600" },
  toggleTextActiveFull: { color: "#00D4FF", fontWeight: "800" },
  toggleTextActiveLoan: { color: "#A855F7", fontWeight: "800" },

  riskBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  riskTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  riskDesc: { color: palette.textMuted, fontSize: 12, marginTop: 2, lineHeight: 18 },
  comparisonBox: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  insightLine: { color: palette.textMuted, fontSize: 11, marginVertical: 2 },

  // Goals
  goalCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    marginVertical: 4,
    gap: 6,
  },
  goalRow: { marginVertical: 4 },
  goalTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  goalPct: { color: "#00D4FF", fontSize: 12, fontWeight: "800" },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
    marginVertical: 4,
  },
  progressFill: { height: "100%", backgroundColor: "#00D4FF", borderRadius: 3 },
  goalSub: { color: palette.textFaint, fontSize: 11 },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    padding: 20,
  },
  modalBox: {
    borderRadius: 24,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 20,
    gap: 8,
  },
  modalTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  cancelBtnText: { color: palette.textMuted, fontSize: 13, fontWeight: "700" },
  saveBtn: {
    backgroundColor: "#635BFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  saveBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },

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
