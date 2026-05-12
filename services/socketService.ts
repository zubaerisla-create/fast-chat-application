import { io, Socket } from "socket.io-client";
import authService from "./authService";

const SOCKET_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://fast-chat-1.onrender.com";

class SocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  // Internal pub/sub map — completely separate from socket events
  private localListeners: Map<string, Function[]> = new Map();

  /**
   * Initialize socket connection
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    try {
      const token = await authService.getToken();

      this.socket = io(SOCKET_URL, {
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      this.setupDefaultListeners();
    } catch (error) {
      console.error("Socket connection error:", error);
    }
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
    });

    this.socket.on("disconnect", () => {
      console.log("Socket disconnected ❌");
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
    // ─────────────────────────────────────────────────────────────────────

    this.socket.on("incomingCall", (data) => {
      this.notifyListeners("incoming_call", data);
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
   * Join a specific conversation room
   */
  joinConversation(conversationId: string): void {
    console.log("Joining conversation room:", conversationId);
    this.emit("join_conversation", conversationId);
    this.emit("joinRoom", conversationId);
  }

  /**
   * Initiate a call
   */
  initiateCall(
    receiverId: string,
    callType: "audio" | "video",
    channelName: string,
  ): void {
    this.emit("initiate_call", { receiverId, callType, channelName });
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
  sendTyping(conversationId: string, isTyping: boolean): void {
    this.emit("user_typing", { conversationId, isTyping });
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export default new SocketService();
