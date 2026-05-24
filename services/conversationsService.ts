import apiClient from "@/utils/apiClient";

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  fileUrl?: string;
  fileType?: string;
  fileName?: string;
  fileSize?: number;
  audioDuration?: number;
  replyToMessageId?: string;
  replyToText?: string;
  replyToSenderId?: string;
  replyToSender?: any;
  timestamp: string;
  isRead?: boolean;
}

const conversationsService = {
  /**
   * Create or retrieve conversation with another user
   */
  createOrGetConversation: async (
    receiverId: string,
  ): Promise<Conversation> => {
    try {
      console.log("Creating/Getting conversation for receiverId:", receiverId);
      const response = await apiClient.post("/conversations", {
        receiverId,
      });
      return response.data.conversation;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to create conversation",
      );
    }
  },

  /**
   * Get all conversations for the current user
   */
  getUserConversations: async (): Promise<Conversation[]> => {
    try {
      const response = await apiClient.get("/conversations");
      return response.data.conversations || [];
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to fetch conversations",
      );
    }
  },

  /**
   * Get media files from a conversation
   */
  getConversationMedia: async (conversationId: string): Promise<any[]> => {
    try {
      const response = await apiClient.get(
        `/conversations/${conversationId}/media`,
      );
      return response.data.media || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to fetch media");
    }
  },

  /**
   * Send a text message
   */
  sendMessage: async (
    conversationId: string,
    text: string,
    fileUrl?: string,
    fileType?: string,
    fileName?: string,
    fileSize?: number,
    audioDuration?: number,
    replyToMessageId?: string,
    replyToText?: string,
    replyToSenderId?: string,
  ): Promise<Message> => {
    try {
      const response = await apiClient.post("/messages", {
        conversationId,
        text,
        fileUrl,
        fileType,
        fileName,
        fileSize,
        audioDuration,
        replyToMessageId,
        replyToText,
        replyToSenderId,
      });
      return response.data.message;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to send message",
      );
    }
  },

  /**
   * Get messages from a conversation with pagination
   */
  getMessages: async (
    conversationId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<Message[]> => {
    try {
      const response = await apiClient.get(`/messages/${conversationId}`, {
        params: { page, limit },
      });
      return response.data.messages || [];
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to fetch messages",
      );
    }
  },

  /**
   * Send a voice message
   */
  sendVoiceMessage: async (
    conversationId: string,
    audioUri: string,
  ): Promise<Message> => {
    try {
      const formData = new FormData();
      formData.append("conversationId", conversationId);
      formData.append("audio", {
        uri: audioUri,
        name: "voice-message.wav",
        type: "audio/wav",
      } as any);

      const response = await apiClient.post("/messages/voice", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data.message;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to send voice message",
      );
    }
  },

  /**
   * Mark messages as read
   */
  markMessagesRead: async (conversationId: string): Promise<string[]> => {
    try {
      const response = await apiClient.patch(
        `/messages/${conversationId}/mark-read`,
      );
      return response.data.messageIds || [];
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to mark messages as read",
      );
    }
  },

  /**
   * Delete a message (unsend)
   */
  deleteMessage: async (messageId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.delete(`/messages/${messageId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to delete message",
      );
    }
  },
};

export default conversationsService;
