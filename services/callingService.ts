import apiClient from "@/utils/apiClient";

export interface AgoraToken {
  token: string;
  uid: number;
  channelName: string;
}

export interface CallSession {
  callerId: string;
  receiverId: string;
  channelName: string;
  callType: "audio" | "video";
  status: "initiated" | "ongoing" | "ended";
  startTime: string;
}

const callingService = {
  /**
   * Get Agora token for a channel
   */
  getAgoraToken: async (
    channelName: string,
    uid: number = 0,
  ): Promise<AgoraToken> => {
    try {
      const response = await apiClient.get(`/agora/token?channelName=${channelName}&uid=${uid}`);
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to get Agora token",
      );
    }
  },

  /**
   * Initiate a call
   */
  initiateCall: async (
    callerId: string,
    receiverId: string,
    channelName: string,
    callType: "audio" | "video",
  ): Promise<CallSession> => {
    try {
      const response = await apiClient.post("/call/initiate", {
        callerId,
        receiverId,
        channelName,
        callType,
      });
      return response.data.call;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to initiate call",
      );
    }
  },

  /**
   * End a call
   */
  endCall: async (
    channelName: string,
    userId: string,
    otherUserId: string,
  ): Promise<void> => {
    try {
      await apiClient.post("/call/end", {
        channelName,
        userId,
        otherUserId,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to end call");
    }
  },

  /**
   * Generate unique channel name for a call
   */
  generateChannelName: (userId1: string, userId2: string): string => {
    const ids = [userId1, userId2].sort();
    return `call_${ids[0]}_${ids[1]}_${Date.now()}`;
  },
};

export default callingService;
