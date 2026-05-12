import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, { AxiosInstance } from "axios";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://fast-chat-1.onrender.com/api";

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  },
});

// Request Interceptor - Add Token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Error reading token:", error);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor - Handle Errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      try {
        await AsyncStorage.removeItem("authToken");
        await AsyncStorage.removeItem("user");
        // Could trigger logout here
      } catch (err) {
        console.error("Error clearing storage:", err);
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
