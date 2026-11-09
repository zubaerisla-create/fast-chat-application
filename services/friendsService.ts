import apiClient from "@/utils/apiClient";
import { User } from "./authService";

export interface FriendRequest {
  id: string;
  _id: string;
  senderId: string;
  receiverId: string;
  status: "pending" | "accepted" | "rejected" | "canceled";
  createdAt: string;
  updatedAt: string;
  sender?: User;
  receiver?: User;
}

const friendsService = {
  /**
   * Send connection / friend request by receiverId or exact username
   */
  sendRequest: async (data: { receiverId?: string; username?: string }): Promise<FriendRequest> => {
    try {
      const response = await apiClient.post("/friends/requests", data);
      return response.data.request;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to send request");
    }
  },

  /**
   * Get incoming and outgoing requests
   */
  getRequests: async (): Promise<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }> => {
    try {
      const response = await apiClient.get("/friends/requests");
      return {
        incoming: response.data.incoming || [],
        outgoing: response.data.outgoing || [],
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to fetch requests");
    }
  },

  /**
   * Accept friend request
   */
  acceptRequest: async (requestId: string): Promise<{ request: FriendRequest; conversation: any }> => {
    try {
      const response = await apiClient.post(`/friends/requests/${requestId}/accept`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to accept request");
    }
  },

  /**
   * Reject friend request
   */
  rejectRequest: async (requestId: string): Promise<void> => {
    try {
      await apiClient.post(`/friends/requests/${requestId}/reject`);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to decline request");
    }
  },

  /**
   * Cancel outgoing friend request
   */
  cancelRequest: async (requestId: string): Promise<void> => {
    try {
      await apiClient.post(`/friends/requests/${requestId}/cancel`);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to cancel request");
    }
  },

  /**
   * Get accepted friends list
   */
  getFriends: async (): Promise<User[]> => {
    try {
      const response = await apiClient.get("/friends");
      return response.data.friends || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to fetch friends");
    }
  },

  /**
   * Get relationship status with a user
   */
  getRelationshipStatus: async (userId: string): Promise<{ status: string; requestId?: string }> => {
    try {
      const response = await apiClient.get(`/friends/status/${userId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to get relationship status");
    }
  },
};

export default friendsService;
