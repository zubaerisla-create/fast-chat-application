import apiClient from "@/utils/apiClient";
import { User } from "./authService";

export interface UserProfile extends User {
  createdAt: string;
  updatedAt: string;
  lastSeen?: string;
  isOnline?: boolean;
}

export interface ExactSearchResult {
  user: UserProfile;
  relationship: "none" | "pending_outgoing" | "pending_incoming" | "accepted" | "blocked" | "self";
  requestId?: string | null;
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
   * Search users by exact username
   */
  searchExactUsername: async (username: string): Promise<ExactSearchResult> => {
    try {
      const response = await apiClient.get("/users/search/exact", {
        params: { username: username.trim() },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "User not found");
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
        error.response?.data?.message || "Failed to fetch user profile"
      );
    }
  },

  /**
   * Get blocked users list
   */
  getBlockedUsers: async (): Promise<any[]> => {
    try {
      const response = await apiClient.get("/users/blocked");
      return response.data.users || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to fetch blocked users");
    }
  },

  /**
   * Block a user
   */
  blockUser: async (userId: string): Promise<void> => {
    try {
      await apiClient.post(`/users/${userId}/block`);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to block user");
    }
  },

  /**
   * Unblock a user
   */
  unblockUser: async (userId: string): Promise<void> => {
    try {
      await apiClient.post(`/users/${userId}/unblock`);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to unblock user");
    }
  },

  /**
   * Update user profile with optional avatar upload
   */
  updateProfile: async (
    username: string,
    avatarUri?: string
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
