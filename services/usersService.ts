import apiClient from "@/utils/apiClient";
import { User } from "./authService";

export interface UserProfile extends User {
  createdAt: string;
  updatedAt: string;
  lastSeen?: string;
  isOnline?: boolean;
}

const usersService = {
  /**
   * Get all users (excluding current user)
   */
  getAllUsers: async (): Promise<User[]> => {
    try {
      const response = await apiClient.get("/users");
      return response.data.users || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to fetch users");
    }
  },

  /**
   * Search users by query
   */
  searchUsers: async (query: string): Promise<User[]> => {
    try {
      const response = await apiClient.get("/users/search", {
        params: { query },
      });
      return response.data.users || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Search failed");
    }
  },

  /**
   * Get user profile by ID
   */
  getUserProfile: async (userId: string): Promise<UserProfile> => {
    try {
      const response = await apiClient.get(`/users/${userId}`);
      return response.data.user;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to fetch user profile",
      );
    }
  },

  /**
   * Update user profile with optional avatar upload
   */
  updateProfile: async (
    username: string,
    avatarUri?: string,
  ): Promise<UserProfile> => {
    try {
      const formData = new FormData();
      formData.append("username", username);

      if (avatarUri) {
        formData.append("avatar", {
          uri: avatarUri,
          name: "avatar.jpg",
          type: "image/jpeg",
        } as any);
      }

      const response = await apiClient.put("/users/profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data.user;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Profile update failed");
    }
  },
};

export default usersService;
