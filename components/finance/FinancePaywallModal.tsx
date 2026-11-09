import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FINANCE_PLANS, SubscriptionPlan, revenueCatService } from "@/services/revenueCatService";

const { width } = Dimensions.get("window");

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onPurchased?: () => void;
  isTrialExpired?: boolean;
}

export const FinancePaywallModal: React.FC<Props> = ({
  visible,
  onClose,
  onSuccess,
  onPurchased,
  isTrialExpired = false,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(FINANCE_PLANS[1] || FINANCE_PLANS[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handlePurchase = async () => {
    try {
      setIsProcessing(true);
      const updated = await revenueCatService.purchase(selectedPlan);
      setIsProcessing(false);

      if (updated.hasAccess) {
        Alert.alert(
          "Plan Activated",
          selectedPlan.planKey === "monthly"
            ? "Your 7-day free trial is now active. You have full access to all finance features."
            : `You have successfully unlocked the ${selectedPlan.title} plan.`,
          [{ text: "Continue", onPress: () => { onClose(); onSuccess?.(); onPurchased?.(); } }]
        );
      }
    } catch (err: any) {
      setIsProcessing(false);
      Alert.alert("Subscription", err.message || "Unable to complete purchase.");
    }
  };

  const handleRestore = async () => {
    try {
      setIsRestoring(true);
      const res = await revenueCatService.restorePurchases();
      setIsRestoring(false);
      if (res.hasAccess && res.status !== "expired") {
        Alert.alert("Restored", "Your active subscription has been restored.");
        onClose();
        onSuccess?.();
        onPurchased?.();
      } else {
        Alert.alert("No Subscription Found", "No active previous subscription was found for this account.");
      }
    } catch (err: any) {
      setIsRestoring(false);
      Alert.alert("Error", err.message || "Failed to restore purchases.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheetContainer}>
          {/* Header Bar */}
          <View style={styles.headerBar}>
            <View style={styles.handle} />
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12} activeOpacity={0.7}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Title & Subtitle */}
            <View style={styles.titleWrap}>
              <Text style={styles.title}>
                {isTrialExpired ? "Your 7-Day Trial Ended" : "Choose your plan"}
              </Text>
              <Text style={styles.subtitle}>
                Unlock complete business ledgers, loan simulations, and multi-currency portfolio management.
              </Text>
            </View>

            {/* Trial Info Pill */}
            {!isTrialExpired && (
              <View style={styles.trialPill}>
                <Ionicons name="shield-checkmark-outline" size={15} color="#38BDF8" />
                <Text style={styles.trialPillText}>
                  Includes 7 days free on the Monthly plan. Cancel anytime.
                </Text>
              </View>
            )}

            {/* Pricing Cards */}
            <View style={styles.cardsContainer}>
              {FINANCE_PLANS.map((plan) => {
                const isSelected = selectedPlan.id === plan.id;
                const isAnnual = plan.planKey === "yearly";

                return (
                  <TouchableOpacity
                    key={plan.id}
                    onPress={() => setSelectedPlan(plan)}
                    style={[
                      styles.card,
                      isSelected && styles.cardSelected,
                      isAnnual && !isSelected && styles.cardFeatured,
                    ]}
                    activeOpacity={0.85}
                  >
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.cardLeftCol}>
                        <View style={styles.titleRow}>
                          <View style={[styles.radio, isSelected && styles.radioSelected]}>
                            {isSelected && <View style={styles.radioInner} />}
                          </View>
                          <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                            {plan.title}
                          </Text>
                          {plan.badge && (
                            <View style={[styles.badge, isSelected && styles.badgeSelected]}>
                              <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                                {plan.badge}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.cardDesc}>{plan.description}</Text>
                      </View>

                      <View style={styles.cardPriceCol}>
                        <Text style={[styles.priceNum, isSelected && styles.priceNumSelected]}>
                          {plan.priceString}
                        </Text>
                        <Text style={styles.pricePeriod}>{plan.period}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Included Features List */}
            <View style={styles.featuresCard}>
              <Text style={styles.featuresHeading}>WHAT'S INCLUDED</Text>
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark" size={16} color="#FB7185" style={styles.featureIcon} />
                  <Text style={styles.featureText}>Venture ledgers & double-entry balance tracking</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark" size={16} color="#FB7185" style={styles.featureIcon} />
                  <Text style={styles.featureText}>Loan affordability & purchase scenario simulator</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark" size={16} color="#FB7185" style={styles.featureIcon} />
                  <Text style={styles.featureText}>Live multi-currency auto conversion (USD, BDT, EUR)</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark" size={16} color="#FB7185" style={styles.featureIcon} />
                  <Text style={styles.featureText}>Financial target forecasting & transaction reports</Text>
                </View>
              </View>
            </View>

            {/* Primary Action Button */}
            <TouchableOpacity
              onPress={handlePurchase}
              disabled={isProcessing}
              style={[styles.primaryBtn, isProcessing && { opacity: 0.7 }]}
              activeOpacity={0.85}
            >
              {isProcessing ? (
                <ActivityIndicator color="#070B14" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {selectedPlan.planKey === "monthly"
                    ? "Start 7-Day Free Trial"
                    : selectedPlan.planKey === "yearly"
                    ? "Subscribe Annual — $50 / year"
                    : "Get Lifetime Access — $100"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Footer */}
            <View style={styles.footerWrap}>
              <TouchableOpacity onPress={handleRestore} disabled={isRestoring} hitSlop={8}>
                <Text style={styles.restoreText}>
                  {isRestoring ? "Restoring..." : "Restore purchases"}
                </Text>
              </TouchableOpacity>
              <Text style={styles.legalText}>
                Recurring billing for monthly and annual plans. Cancel anytime in App Store or Play Store settings.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    maxHeight: "92%",
    backgroundColor: "#180918",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.2)",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerBar: {
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  closeBtn: {
    position: "absolute",
    right: 0,
    top: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },

  scrollContent: {
    paddingBottom: 32,
  },

  titleWrap: {
    marginTop: 8,
    marginBottom: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: "#D4A5C1",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },

  trialPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(244, 63, 94, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.25)",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  trialPillText: {
    color: "#FFE4E6",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },

  cardsContainer: {
    gap: 10,
    marginBottom: 18,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  cardFeatured: {
    borderColor: "rgba(244, 63, 94, 0.35)",
    backgroundColor: "rgba(244, 63, 94, 0.04)",
  },
  cardSelected: {
    backgroundColor: "rgba(244, 63, 94, 0.08)",
    borderColor: "#F43F5E",
    borderWidth: 1.5,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardLeftCol: {
    flex: 1,
    paddingRight: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: "#F43F5E",
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#F43F5E",
  },
  cardTitle: {
    color: "#F1F5F9",
    fontSize: 15,
    fontWeight: "600",
  },
  cardTitleSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  badge: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeSelected: {
    backgroundColor: "rgba(244, 63, 94, 0.18)",
  },
  badgeText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "600",
  },
  badgeTextSelected: {
    color: "#FB7185",
    fontWeight: "700",
  },
  cardDesc: {
    color: "#9E6D8A",
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  cardPriceCol: {
    alignItems: "flex-end",
  },
  priceNum: {
    color: "#F1F5F9",
    fontSize: 18,
    fontWeight: "700",
  },
  priceNumSelected: {
    color: "#FFFFFF",
  },
  pricePeriod: {
    color: "#9E6D8A",
    fontSize: 11,
    marginTop: 1,
  },

  featuresCard: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.15)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },
  featuresHeading: {
    color: "#D4A5C1",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  featuresList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureIcon: {
    marginTop: 1,
  },
  featureText: {
    color: "#FFF1F4",
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },

  primaryBtn: {
    backgroundColor: "#F43F5E",
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F43F5E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  footerWrap: {
    alignItems: "center",
    marginTop: 14,
    gap: 8,
  },
  restoreText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  legalText: {
    color: "#475569",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 15,
    paddingHorizontal: 8,
  },
});

export default FinancePaywallModal;
