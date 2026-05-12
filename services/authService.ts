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
   * Register a new user
   */
  register: async (
    username: string,
    email: string,
    password: string,
  ): Promise<AuthResponse> => {
    try {
      const response = await apiClient.post("/auth/register", {
        username,
        email,
        password,
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
