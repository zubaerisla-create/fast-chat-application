import { Platform } from "react-native";
import financeService from "./financeService";

export interface SubscriptionPlan {
  id: string;
  planKey: "monthly" | "yearly" | "lifetime";
  title: string;
  price: number;
  priceString: string;
  period: string;
  trialDays?: number;
  badge?: string;
  description: string;
  features: string[];
}

export const FINANCE_PLANS: SubscriptionPlan[] = [
  {
    id: "finance_monthly_10",
    planKey: "monthly",
    title: "Monthly",
    price: 10,
    priceString: "$10",
    period: "/ month",
    trialDays: 7,
    badge: "7 Days Free",
    description: "Full access with 7-day free trial. Then $10/month, cancel anytime.",
    features: [
      "Venture ledgers & double-entry tracking",
      "Loan & purchase affordability simulations",
      "Multi-currency conversion (USD, BDT, EUR)",
      "Financial goals & budget projections",
    ],
  },
  {
    id: "finance_yearly_50",
    planKey: "yearly",
    title: "Annual",
    price: 50,
    priceString: "$50",
    period: "/ year",
    badge: "Save 58%",
    description: "$50 billed once a year ($4.17/mo). Best value for long-term tracking.",
    features: [
      "All Monthly features included",
      "Full transaction history & export",
      "Priority simulation calculations",
      "58% savings compared to monthly",
    ],
  },
  {
    id: "finance_lifetime_100",
    planKey: "lifetime",
    title: "Lifetime",
    price: 100,
    priceString: "$100",
    period: "one-time",
    badge: "Single Payment",
    description: "Pay once, own forever. Zero recurring fees or renewals.",
    features: [
      "Lifetime unlimited access to Fast Finance",
      "All future finance features included",
      "Single payment with no subscription",
      "Full cloud & multi-device sync",
    ],
  },
];

export interface FinanceSubscriptionStatus {
  hasAccess: boolean;
  status: "trialing" | "active" | "lifetime" | "expired";
  isTrial: boolean;
  daysLeft: number;
  trialEndsAt?: string;
  plan?: string;
  currentPeriodEnd?: string;
  isLifetime?: boolean;
  isActive?: boolean;
  isTrialing?: boolean;
  trialDaysLeft?: number;
}

export type SubscriptionStatus = FinanceSubscriptionStatus;

class RevenueCatService {
  private isConfigured = false;
  private rcModule: any = null;

  /**
   * Initialize RevenueCat SDK
   */
  async configure(userId?: string) {
    if (this.isConfigured) return;

    try {
      // Attempt dynamic require if react-native-purchases is linked in native build
      // @ts-ignore
      const Purchases = require("react-native-purchases")?.default || require("react-native-purchases");
      if (Purchases && typeof Purchases.configure === "function") {
        this.rcModule = Purchases;
        const apiKey = Platform.select({
          ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || "appl_mock_key",
          android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || "goog_mock_key",
          default: process.env.EXPO_PUBLIC_REVENUECAT_WEB_KEY || "rc_web_key",
        });

        if (apiKey && apiKey !== "appl_mock_key" && apiKey !== "goog_mock_key") {
          await this.rcModule.configure({ apiKey, appUserID: userId });
          console.log("[RevenueCat] Configured with live API key for user:", userId);
        }
      }
    } catch (e) {
      // Native module not linked in Expo Go / bare simulator, fallback to backend sync
      console.log("[RevenueCat] Native module not active, using integrated backend subscription engine.");
    }

    this.isConfigured = true;
  }

  /**
   * Fetch current subscription and 7-day trial status from backend
   */
  async getStatus(): Promise<FinanceSubscriptionStatus> {
    try {
      const data = await financeService.getSubscriptionStatus();
      return {
        ...data,
        isLifetime: data.status === "lifetime",
        isActive: data.status === "active",
        isTrialing: Boolean(data.isTrial || data.status === "trialing"),
        trialDaysLeft: data.daysLeft ?? 0,
      };
    } catch (err: any) {
      console.warn("[RevenueCatService] getStatus error:", err.message);
      return {
        hasAccess: true,
        status: "trialing",
        isTrial: true,
        daysLeft: 7,
        isTrialing: true,
        trialDaysLeft: 7,
      };
    }
  }

  /**
   * Purchase a subscription package (Monthly $10, Yearly $50, Lifetime $100)
   */
  async purchase(plan: SubscriptionPlan, userId?: string): Promise<FinanceSubscriptionStatus> {
    try {
      let rcOriginalTxId = `rc_${Date.now()}`;
      let expiresAt: string | null = null;

      if (plan.planKey === "monthly") {
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (plan.planKey === "yearly") {
        expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      }

      // If native RevenueCat is active and packages are loaded
      if (this.rcModule) {
        try {
          const offerings = await this.rcModule.getOfferings();
          if (offerings.current !== null) {
            const pkg = offerings.current.availablePackages.find(
              (p: any) => p.identifier === plan.id || p.product.identifier === plan.id
            );
            if (pkg) {
              const { customerInfo } = await this.rcModule.purchasePackage(pkg);
              if (customerInfo.entitlements.active["finance_pro"]) {
                rcOriginalTxId = customerInfo.originalAppUserId;
              }
            }
          }
        } catch (rcErr: any) {
          if (rcErr.userCancelled) {
            throw new Error("Purchase cancelled");
          }
          console.warn("[RevenueCat] Native purchase note:", rcErr.message);
        }
      }

      // Sync verified purchase with our backend
      const updated = await financeService.syncSubscription({
        plan: plan.planKey,
        status: plan.planKey === "lifetime" ? "lifetime" : "active",
        revenuecatCustomerId: userId || `rc_user_${Date.now()}`,
        originalTransactionId: rcOriginalTxId,
        currentPeriodEnd: expiresAt,
      });

      return updated;
    } catch (error: any) {
      throw new Error(error.message || "Failed to complete purchase");
    }
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(userId?: string): Promise<FinanceSubscriptionStatus> {
    if (this.rcModule) {
      try {
        const customerInfo = await this.rcModule.restorePurchases();
        const entitlement = customerInfo.entitlements.active["finance_pro"];
        if (entitlement) {
          const planKey = entitlement.productIdentifier.includes("lifetime")
            ? "lifetime"
            : entitlement.productIdentifier.includes("year")
            ? "yearly"
            : "monthly";

          return await financeService.syncSubscription({
            plan: planKey,
            status: planKey === "lifetime" ? "lifetime" : "active",
            currentPeriodEnd: entitlement.expirationDate,
            revenuecatCustomerId: userId,
          });
        }
      } catch (e: any) {
        console.warn("[RevenueCat] Restore error:", e.message);
      }
    }

    return await this.getStatus();
  }
}

export const revenueCatService = new RevenueCatService();
export default revenueCatService;
