import apiClient from "@/utils/apiClient";

export interface FinanceProfile {
  monthlyIncome: number;
  rent: number;
  utilities: number;
  subscriptionsInsurance: number;
  existingLoans: number;
  variableExpenses: number;
  fixedExpenses: number;
  totalMonthlyExpenses: number;
  monthlyDisposable: number;
  currentSavings: number;
  dependents: number;
  incomeStability: string;
  riskTolerance: string;
  totalSimulationsUsed: number;
}

export interface BusinessItem {
  id: string;
  name: string;
  description: string;
  startDate: string;
  initial_investment: string | number;
  opening_balance: string | number;
  totalInvestment: number;
  totalSales: number;
  totalExpenses: number;
  totalWithdrawals: number;
  netProfit: number;
  currentBalance: number;
  transactionCount: number;
}

export interface FinanceGoal {
  id: string;
  title: string;
  category: string;
  target_amount: string | number;
  current_amount: string | number;
  target_date?: string;
  notes?: string;
  status: string;
}

export interface FinanceDashboardData {
  profile: FinanceProfile;
  portfolio: {
    businessesCount: number;
    totalInvestment: number;
    totalSales: number;
    totalExpenses: number;
    netProfit: number;
    totalBusinessBalance: number;
    netWorthEstimate: number;
    businesses: BusinessItem[];
  };
  goals: {
    total: number;
    items: FinanceGoal[];
  };
  recentTransactions: any[];
  recentSimulations: any[];
}

export const financeService = {
  getDashboard: async (): Promise<FinanceDashboardData> => {
    const res = await apiClient.get<{ success: boolean; data: FinanceDashboardData }>("/finance/dashboard");
    return res.data.data;
  },

  getProfile: async () => {
    const res = await apiClient.get("/finance/profile");
    return res.data.profile;
  },

  updateProfile: async (data: any) => {
    const res = await apiClient.put("/finance/profile", data);
    return res.data.profile;
  },

  runSimulation: async (payload: {
    purchaseAmount: number;
    paymentType: "full" | "loan";
    loanDuration?: number;
    interestRate?: number;
    planName?: string;
  }) => {
    const res = await apiClient.post("/finance/simulate", payload);
    return res.data.simulation;
  },

  getSimulations: async (limit = 20) => {
    const res = await apiClient.get(`/finance/simulations?limit=${limit}`);
    return res.data.simulations;
  },

  getSimulationById: async (id: string) => {
    const res = await apiClient.get(`/finance/simulations/${id}`);
    return res.data.simulation;
  },

  getBusinesses: async () => {
    const res = await apiClient.get("/finance/businesses");
    return res.data.businesses;
  },

  getBusinessById: async (id: string, month?: string) => {
    const res = await apiClient.get(`/finance/businesses/${id}${month ? `?month=${month}` : ""}`);
    return res.data.business;
  },

  createBusiness: async (data: {
    name: string;
    description?: string;
    startDate?: string;
    initialInvestment?: number;
    openingBalance?: number;
  }) => {
    const res = await apiClient.post("/finance/businesses", data);
    return res.data.business;
  },

  updateBusiness: async (id: string, data: any) => {
    const res = await apiClient.put(`/finance/businesses/${id}`, data);
    return res.data.business;
  },

  deleteBusiness: async (id: string) => {
    const res = await apiClient.delete(`/finance/businesses/${id}`);
    return res.data;
  },

  getTransactions: async (params?: { businessId?: string; type?: string; search?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.businessId) query.set("businessId", params.businessId);
    if (params?.type) query.set("type", params.type);
    if (params?.search) query.set("search", params.search);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const res = await apiClient.get(`/finance/transactions?${query.toString()}`);
    return res.data.transactions;
  },

  createTransaction: async (data: {
    businessId?: string;
    type: string;
    name: string;
    amount: number;
    note?: string;
    transactionDate?: string;
  }) => {
    const res = await apiClient.post("/finance/transactions", data);
    return res.data.transaction;
  },

  updateTransaction: async (id: string, data: any) => {
    const res = await apiClient.put(`/finance/transactions/${id}`, data);
    return res.data.transaction;
  },

  deleteTransaction: async (id: string) => {
    const res = await apiClient.delete(`/finance/transactions/${id}`);
    return res.data;
  },

  getGoals: async () => {
    const res = await apiClient.get("/finance/goals");
    return res.data.goals;
  },

  createGoal: async (data: {
    title: string;
    category?: string;
    targetAmount: number;
    currentAmount?: number;
    targetDate?: string;
    notes?: string;
  }) => {
    const res = await apiClient.post("/finance/goals", data);
    return res.data.goal;
  },

  deleteGoal: async (id: string) => {
    const res = await apiClient.delete(`/finance/goals/${id}`);
    return res.data;
  },
};

export default financeService;
