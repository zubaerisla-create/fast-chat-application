import apiClient from "@/utils/apiClient";

export type PlanId = "free" | "starter" | "pro" | "advanced";

export interface BillingSubscription {
  id: string;
  provider: "paddle";
  plan: PlanId | null;
  interval: "month" | "year" | null;
  status: string;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  scheduledChange: { action: string; at: string } | null;
}

export interface LifetimePurchase {
  id: string;
  plan: "advanced";
  status: "active" | "revoked";
  purchasedAt: string;
}

export interface Entitlement {
  /** "free" means no paid plan (standard limits) */
  plan: PlanId;
  planName: string;
  limits: { maxFileBytes: number };
  features: string[];
  source: "paddle" | null;
  /** Advanced Lifetime: one-time purchase, never expires */
  lifetime: { id: string; purchasedAt: string } | null;
  hasDuplicateSubscriptions: boolean;
}

/**
 * The plan always comes from the backend, which records website (Paddle) purchases from
 * verified webhooks. The app never decides on its own that a purchase is valid, and it
 * doesn't sell plans or link to the website checkout (Google Play billing policy).
 */
const billingService = {
  getMyBilling: async (): Promise<{ entitlement: Entitlement; subscriptions: BillingSubscription[]; lifetimePurchases: LifetimePurchase[] }> => {
    const response = await apiClient.get("/billing/me");
    return {
      entitlement: response.data.entitlement,
      subscriptions: response.data.subscriptions ?? [],
      lifetimePurchases: response.data.lifetimePurchases ?? [],
    };
  },
};

export default billingService;
