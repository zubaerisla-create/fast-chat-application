import apiClient from "@/utils/apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface User {
  id: string;
  _id?: string;
  username: string;
  email: string;
  avatar?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

const authService = {
  /**
   * Send OTP to user's email
   */
  sendOTP: async (email: string, username?: string): Promise<any> => {
    try {
      const response = await apiClient.post("/auth/send-otp", { email, username });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to send OTP");
    }
  },

  /**
   * Register a new user
   */
  register: async (
    username: string,
    email: string,
    password: string,
    otp: string,
  ): Promise<AuthResponse> => {
    try {
      const response = await apiClient.post("/auth/register", {
        username,
        email,
        password,
        otp,
      });

      const { token, user } = response.data;

      // Store token and user data
      await AsyncStorage.setItem("authToken", token);
      await AsyncStorage.setItem("user", JSON.stringify(user));

      return { token, user };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Registration failed");
    }
  },

  /**
   * Login user
   */
  login: async (email: string, password: string): Promise<AuthResponse> => {
    try {
      const response = await apiClient.post("/auth/login", {
        email,
        password,
      });

      const { token, user } = response.data;

      // Store token and user data
      await AsyncStorage.setItem("authToken", token);
      await AsyncStorage.setItem("user", JSON.stringify(user));

      return { token, user };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Login failed");
    }
  },

  /**
   * Google login / register user via Google ID token
   */
  googleLogin: async (idToken: string): Promise<AuthResponse> => {
    try {
      const response = await apiClient.post("/auth/google", {
        idToken,
      });

      const { token, user } = response.data;

      await AsyncStorage.setItem("authToken", token);
      await AsyncStorage.setItem("user", JSON.stringify(user));

      return { token, user };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Google login failed");
    }
  },

  /**
   * Email a password reset code (the server answers the same whether or not the account exists)
   */
  forgotPassword: async (email: string): Promise<string> => {
    try {
      const response = await apiClient.post("/auth/forgot-password", { email });
      return response.data.message;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to send reset code");
    }
  },

  /**
   * Check a reset code before asking for the new password
   */
  verifyResetOTP: async (email: string, otp: string): Promise<void> => {
    try {
      await apiClient.post("/auth/verify-reset-otp", { email, otp });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Invalid code");
    }
  },

  /**
   * Set a new password with a reset code; logs the user in on success
   */
  resetPassword: async (email: string, otp: string, newPassword: string): Promise<AuthResponse> => {
    try {
      const response = await apiClient.post("/auth/reset-password", { email, otp, newPassword });

      const { token, user } = response.data;

      await AsyncStorage.setItem("authToken", token);
      await AsyncStorage.setItem("user", JSON.stringify(user));

      return { token, user };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Password reset failed");
    }
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem("authToken");
      await AsyncStorage.removeItem("user");
    } catch (error) {
      console.error("Logout error:", error);
    }
  },

  /**
   * Get stored token
   */
  getToken: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem("authToken");
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  },

  /**
   * Get stored user data
   */
  getUser: async (): Promise<User | null> => {
    try {
      const user = await AsyncStorage.getItem("user");
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error("Error getting user:", error);
      return null;
    }
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: async (): Promise<boolean> => {
    const token = await authService.getToken();
    return !!token;
  },
};

export default authService;
