import { io, Socket } from "socket.io-client";
import authService from "./authService";

const rawUrl = (process.env.EXPO_PUBLIC_API_URL || "https://fast-chat-1.onrender.com").trim();
const SOCKET_URL = rawUrl.endsWith('/api') ? rawUrl.replace('/api', '') : rawUrl;

class SocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  // Internal pub/sub map — completely separate from socket events
  private localListeners: Map<string, Function[]> = new Map();

  private activeConversationId: string | null = null;

  // Bug 6 fix: track which rooms we've already joined to prevent duplicates
  private joinedRooms: Set<string> = new Set();

  /**
   * Initialize socket connection
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    return new Promise(async (resolve) => {
      try {
        const token = await authService.getToken();

        // Disconnect stale socket if exists
        if (this.socket) {
          this.socket.disconnect();
          this.socket = null;
        }

        this.socket = io(SOCKET_URL, {
          auth: { token },
          transports: ['polling', 'websocket'], // polling first — more reliable in production/preview
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 10,
          timeout: 20000,
          forceNew: false,
        });

        this.setupDefaultListeners();

        // Resolve once connected
        this.socket.once("connect", () => resolve());

        // Resolve anyway after timeout to avoid hanging
        setTimeout(() => resolve(), 5000);
      } catch (error) {
        console.error("Socket connection error:", error);
        resolve(); // Don't reject — app should still work
      }
    });
  }

  /**
   * Notify local component listeners (internal pub/sub — NOT socket.emit)
   */
  private notifyListeners(event: string, data?: any): void {
    const callbacks = this.localListeners.get(event);
    if (callbacks && callbacks.length > 0) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in listener for ${event}:`, err);
        }
      });
    }
  }

  /**
   * Set user ID for automatic online notification
   */
  notifyOnline(userId: string): void {
    this.userId = userId;
    if (this.socket?.connected) {
      this.socket.emit("userOnline", userId);
    }
  }

  /**
   * Disconnect socket
   */
  disconnect(): void {
    if (this.socket?.connected) {
      this.socket.disconnect();
    }
  }

  /**
   * Setup default socket listeners — translate server events to internal events
   */
  private setupDefaultListeners(): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("Socket connected ✅");
      this.notifyListeners("socket:connected");

      // Auto-notify online if userId is known
      if (this.userId) {
        this.socket?.emit("userOnline", this.userId);
      }

      // Bug 6 fix: Re-join active conversation after reconnect.
      // Clear the set first so we actually re-join (server drops room membership on disconnect).
      // Only emit join_conversation (single event) — do NOT also emit joinRoom.
      if (this.activeConversationId) {
        console.log("🔄 Re-joining conversation after reconnect:", this.activeConversationId);
        this.joinedRooms.clear(); // reset so joinConversation will re-emit
        this.socket?.emit("join_conversation", this.activeConversationId);
        this.joinedRooms.add(this.activeConversationId);
      }
    });

    this.socket.on("disconnect", () => {
      console.log("Socket disconnected ❌");
      // Bug 6 fix: clear joinedRooms on disconnect — server drops all memberships,
      // so we must re-join on next connect.
      this.joinedRooms.clear();
      this.notifyListeners("socket:disconnected");
    });

    this.socket.on("onlineUsers", (users: string[]) => {
      console.log("Online users received:", users.length);
      this.notifyListeners("onlineUsersChanged", users);
    });

    // ── Message events — catch all possible names the backend might use ──
    const handleIncomingMessage = (data: any) => {
      console.log("📨 Incoming message from server:", JSON.stringify(data));
      this.notifyListeners("message_received", data);
    };

    this.socket.on("receiveMessage", handleIncomingMessage);
    this.socket.on("newMessage", handleIncomingMessage);
    this.socket.on("message_received", handleIncomingMessage);

    this.socket.on("messagesSeen", (data) => {
      console.log("👀 Messages seen by server:", JSON.stringify(data));
      this.notifyListeners("messages_seen", data);
    });

    const handleMessageDeleted = (data: any) => {
      console.log("🗑️ Message deleted from server:", JSON.stringify(data));
      this.notifyListeners("message_deleted", data);
    };
    this.socket.on("messageDeleted", handleMessageDeleted);
    this.socket.on("message_deleted", handleMessageDeleted);
    // ─────────────────────────────────────────────────────────────────────

    this.socket.on("incomingCall", (data) => {
      this.notifyListeners("incoming_call", data);
    });

    // Server confirms call was initiated and provides authoritative channelName
    this.socket.on("call_initiated", (data) => {
      console.log("📡 call_initiated from server:", data);
      this.notifyListeners("call_initiated", data);
    });

    this.socket.on("call_joined", (data) => {
      this.notifyListeners("call_accepted", data);
    });

    this.socket.on("call_rejected", (data) => {
      this.notifyListeners("call_rejected", data);
    });

    this.socket.on("call_ended", (data) => {
      this.notifyListeners("call_ended", data);
    });

    this.socket.on("userTyping", (data) => {
      this.notifyListeners("user_typing", data);
    });

    this.socket.on("userStoppedTyping", (data) => {
      this.notifyListeners("user_stopped_typing", data);
    });

    this.socket.on("messageReactionUpdated", (data) => {
      this.notifyListeners("message_reaction_updated", data);
    });

    this.socket.on("user_online", (data) => {
      this.notifyListeners("user_online", data);
    });

    this.socket.on("user_offline", (data) => {
      this.notifyListeners("user_offline", data);
    });

    this.socket.on("error", (error) => {
      console.error("Socket error:", error);
      this.notifyListeners("socket:error", error);
    });
  }

  /**
   * Emit event to SERVER
   */
  emit(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`Socket not connected. Could not emit: ${event}`);
    }
  }

  /**
   * Subscribe to an internal event (component-level listener)
   * Returns an unsubscribe function — call it on component unmount.
   */
  on(event: string, callback: Function): () => void {
    if (!this.localListeners.has(event)) {
      this.localListeners.set(event, []);
    }
    this.localListeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.localListeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Send a message via socket
   */
  sendMessage(conversationId: string, message: string): void {
    this.emit("send_message", { conversationId, message });
  }

  /**
   * Mark messages as seen
   */
  markMessagesSeen(conversationId: string, messageIds: string[], seenBy: string, senderId?: string): void {
    this.emit("markMessagesSeen", { conversationId, messageIds, seenBy, senderId, seenAt: new Date().toISOString() });
  }

  /**
   * Join a specific conversation room.
   * Bug 6 fix: guarded with joinedRooms Set — will not re-emit if already joined.
   */
  joinConversation(conversationId: string): void {
    this.activeConversationId = conversationId; // remember for reconnect

    // Bug 6 fix: skip if already in this room (prevents duplicate events)
    if (this.joinedRooms.has(conversationId)) {
      console.log("Already in conversation room, skipping re-join:", conversationId);
      return;
    }

    console.log("Joining conversation room:", conversationId);
    // Emit only join_conversation — do NOT emit joinRoom to avoid double-subscription
    this.emit("join_conversation", conversationId);
    this.joinedRooms.add(conversationId);
  }

  /**
   * Leave a specific conversation room (call on chat screen unmount).
   */
  leaveConversation(conversationId: string): void {
    if (this.joinedRooms.has(conversationId)) {
      this.emit("leave_conversation", conversationId);
      this.joinedRooms.delete(conversationId);
      if (this.activeConversationId === conversationId) {
        this.activeConversationId = null;
      }
    }
  }

  /**
   * Initiate a call
   */
  initiateCall(
    receiverId: string,
    callType: "audio" | "video",
    channelName: string,
    callerName?: string
  ): void {
    this.emit("initiate_call", { receiverId, callType, channelName, callerName });
  }

  /**
   * Accept call
   */
  acceptCall(callerId: string, channelName: string): void {
    this.emit("accept_call", { callerId, channelName });
  }

  /**
   * Reject call
   */
  rejectCall(callerId: string, channelName: string): void {
    this.emit("reject_call", { callerId, channelName });
  }

  /**
   * Send typing indicator
   */
  sendTyping(conversationId: string, receiverId: string, isTyping: boolean): void {
    if (isTyping) {
      this.emit("typing", { conversationId, receiverId });
    } else {
      this.emit("stopTyping", { conversationId, receiverId });
    }
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export default new SocketService();
