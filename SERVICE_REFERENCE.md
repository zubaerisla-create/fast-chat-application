# Service Reference Guide

Complete reference for all API services with examples.

## 🔐 authService

### Functions

#### `register(username, email, password)`

Create a new user account.

```typescript
import authService from "@/services/authService";

try {
  const { token, user } = await authService.register(
    "john_doe",
    "john@example.com",
    "password123",
  );
  console.log("User created:", user);
  // token is automatically stored
} catch (error) {
  console.error("Registration failed:", error.message);
}
```

**Returns:** `{ token: string, user: User }`

---

#### `login(email, password)`

Authenticate user with email and password.

```typescript
try {
  const { token, user } = await authService.login(
    "john@example.com",
    "password123",
  );
  console.log("Logged in as:", user.username);
} catch (error) {
  console.error("Login failed:", error.message);
}
```

**Returns:** `{ token: string, user: User }`

---

#### `logout()`

Clear all authentication data locally.

```typescript
await authService.logout();
console.log("User logged out");
```

---

#### `getToken()`

Retrieve stored JWT token.

```typescript
const token = await authService.getToken();
console.log("Token:", token);
```

**Returns:** `string | null`

---

#### `getUser()`

Get currently stored user data.

```typescript
const user = await authService.getUser();
if (user) {
  console.log("Current user:", user.username);
}
```

**Returns:** `User | null`

---

#### `isAuthenticated()`

Check if user is currently logged in.

```typescript
const isAuth = await authService.isAuthenticated();
if (isAuth) {
  console.log("User is logged in");
}
```

**Returns:** `boolean`

---

## 👥 usersService

### Functions

#### `getAllUsers()`

Get list of all users except current user.

```typescript
import usersService from "@/services/usersService";

try {
  const users = await usersService.getAllUsers();
  console.log("Found users:", users.length);

  users.forEach((user) => {
    console.log(`${user.username} (${user.email})`);
  });
} catch (error) {
  console.error("Failed to fetch users:", error.message);
}
```

**Returns:** `User[]`

---

#### `searchUsers(query)`

Search for users by username or email.

```typescript
try {
  const results = await usersService.searchUsers("john");
  console.log("Search results:", results);

  // Usage in component
  const [searchResults, setSearchResults] = useState([]);

  const handleSearch = async (text) => {
    const results = await usersService.searchUsers(text);
    setSearchResults(results);
  };
} catch (error) {
  console.error("Search failed:", error.message);
}
```

**Parameters:**

- `query: string` - Search term

**Returns:** `User[]`

---

#### `getUserProfile(userId)`

Get detailed profile of specific user.

```typescript
try {
  const profile = await usersService.getUserProfile("user_123");
  console.log("User profile:", profile);
  console.log("Member since:", profile.createdAt);
} catch (error) {
  console.error("Profile fetch failed:", error.message);
}
```

**Parameters:**

- `userId: string` - User ID to fetch

**Returns:** `UserProfile`

---

#### `updateProfile(username, avatarUri?)`

Update user profile with optional avatar.

```typescript
try {
  // Update username only
  const updated = await usersService.updateProfile("new_username");

  // Update with avatar
  const avatar_updated = await usersService.updateProfile(
    "new_username",
    "/path/to/avatar.jpg",
  );

  console.log("Profile updated:", updated);
} catch (error) {
  console.error("Profile update failed:", error.message);
}
```

**Parameters:**

- `username: string` - New username
- `avatarUri?: string` - Path to avatar image (optional)

**Returns:** `UserProfile`

---

## 💬 conversationsService

### Functions

#### `createOrGetConversation(receiverId)`

Create new conversation or retrieve existing one.

```typescript
import conversationsService from "@/services/conversationsService";

try {
  const conv = await conversationsService.createOrGetConversation("user_456");
  console.log("Conversation ID:", conv.id);
  console.log("Last message:", conv.lastMessage);
} catch (error) {
  console.error("Conversation creation failed:", error.message);
}
```

**Parameters:**

- `receiverId: string` - ID of other person in conversation

**Returns:** `Conversation`

---

#### `getUserConversations()`

Get all conversations for current user.

```typescript
try {
  const conversations = await conversationsService.getUserConversations();

  conversations.forEach((conv) => {
    console.log(`${conv.participantName}: ${conv.lastMessage}`);
  });

  // Show in FlatList
  const [chats, setChats] = useState([]);
  useEffect(() => {
    const loadChats = async () => {
      const data = await conversationsService.getUserConversations();
      setChats(data);
    };
    loadChats();
  }, []);
} catch (error) {
  console.error("Failed to fetch conversations:", error.message);
}
```

**Returns:** `Conversation[]`

---

#### `sendMessage(conversationId, text, fileUrl?, fileType?, fileName?, fileSize?)`

Send a text message or message with attachment.

```typescript
try {
  // Text only
  const msg = await conversationsService.sendMessage(
    "conv_123",
    "Hello world!",
  );

  // With attachment
  const msgWithFile = await conversationsService.sendMessage(
    "conv_123",
    "Check this file",
    "https://cloudinary.com/file123.pdf",
    "application/pdf",
    "document.pdf",
    1024000,
  );

  console.log("Message sent:", msg.id);
} catch (error) {
  console.error("Send failed:", error.message);
}
```

**Parameters:**

- `conversationId: string` - Target conversation
- `text: string` - Message text
- `fileUrl?: string` - URL of file (optional)
- `fileType?: string` - MIME type of file (optional)
- `fileName?: string` - Original filename (optional)
- `fileSize?: number` - Size in bytes (optional)

**Returns:** `Message`

---

#### `getMessages(conversationId, page, limit)`

Get messages with pagination.

```typescript
try {
  // Get first 50 messages
  const messages = await conversationsService.getMessages("conv_123");

  // Get page 2
  const moreMessages = await conversationsService.getMessages(
    "conv_123",
    2,
    50,
  );

  // Load more pattern
  const [messages, setMessages] = useState([]);
  const [page, setPage] = useState(1);

  const loadMore = async () => {
    const newMessages = await conversationsService.getMessages(
      conversationId,
      page + 1,
      50,
    );
    setMessages((prev) => [...newMessages, ...prev]);
    setPage(page + 1);
  };
} catch (error) {
  console.error("Message fetch failed:", error.message);
}
```

**Parameters:**

- `conversationId: string` - Conversation ID
- `page?: number` - Page number (default: 1)
- `limit?: number` - Messages per page (default: 50)

**Returns:** `Message[]`

---

#### `sendVoiceMessage(conversationId, audioUri)`

Send a voice recording.

```typescript
try {
  const msg = await conversationsService.sendVoiceMessage(
    "conv_123",
    "/path/to/audio.wav",
  );
  console.log("Voice message sent:", msg.id);
} catch (error) {
  console.error("Voice message failed:", error.message);
}
```

**Parameters:**

- `conversationId: string` - Target conversation
- `audioUri: string` - Path to audio file

**Returns:** `Message`

---

#### `getConversationMedia(conversationId)`

Get all shared files and images in conversation.

```typescript
try {
  const media = await conversationsService.getConversationMedia("conv_123");

  const images = media.filter((m) => m.type.startsWith("image"));
  const files = media.filter((m) => !m.type.startsWith("image"));

  console.log("Images:", images.length);
  console.log("Files:", files.length);
} catch (error) {
  console.error("Media fetch failed:", error.message);
}
```

**Parameters:**

- `conversationId: string` - Conversation ID

**Returns:** `Array<any>`

---

## 📞 callingService

### Functions

#### `getAgoraToken(channelName, uid?)`

Get Agora token for video/audio call.

```typescript
import callingService from "@/services/callingService";

try {
  const agoraToken = await callingService.getAgoraToken("call_channel_123");

  console.log("Token:", agoraToken.token);
  console.log("UID:", agoraToken.uid);
  console.log("Channel:", agoraToken.channelName);

  // Start call with this token
} catch (error) {
  console.error("Token fetch failed:", error.message);
}
```

**Parameters:**

- `channelName: string` - Unique channel identifier
- `uid?: number` - User ID (default: 0)

**Returns:** `AgoraToken`

---

#### `initiateCall(callerId, receiverId, channelName, callType)`

Start a call.

```typescript
try {
  const call = await callingService.initiateCall(
    "user_123", // caller
    "user_456", // receiver
    "call_xyz_789", // channel name
    "video", // or 'audio'
  );

  console.log("Call initiated:", call.id);
} catch (error) {
  console.error("Call initiation failed:", error.message);
}
```

**Parameters:**

- `callerId: string` - ID of person making call
- `receiverId: string` - ID of person receiving call
- `channelName: string` - Unique channel name
- `callType: 'audio' | 'video'` - Type of call

**Returns:** `CallSession`

---

#### `endCall(channelName, userId, otherUserId)`

End an active call.

```typescript
try {
  await callingService.endCall(
    "call_xyz_789", // channel name
    "user_123", // current user
    "user_456", // other user
  );

  console.log("Call ended");
} catch (error) {
  console.error("Call end failed:", error.message);
}
```

**Parameters:**

- `channelName: string` - Unique channel name
- `userId: string` - Current user ID
- `otherUserId: string` - Other participant ID

**Returns:** `void`

---

#### `generateChannelName(userId1, userId2)`

Generate unique channel name for call.

```typescript
const channelName = callingService.generateChannelName("user_123", "user_456");
// Returns: "call_user_123_user_456_1715511600000"
```

**Parameters:**

- `userId1: string` - First user ID
- `userId2: string` - Second user ID

**Returns:** `string`

---

## 🔌 socketService

### Functions

#### `connect()`

Initialize Socket.IO connection.

```typescript
import socketService from "@/services/socketService";

await socketService.connect();
console.log("Socket connected");
```

---

#### `disconnect()`

Close Socket.IO connection.

```typescript
socketService.disconnect();
console.log("Socket disconnected");
```

---

#### `on(event, callback)`

Listen for socket events.

```typescript
// Listen for incoming message
const unsubscribe = socketService.on("message_received", (data) => {
  console.log("New message:", data.message.text);

  // Update UI
  setMessages((prev) => [...prev, data.message]);
});

// Cleanup on component unmount
useEffect(() => {
  return () => unsubscribe();
}, []);
```

**Available Events:**

- `socket:connected` - Connection established
- `socket:disconnected` - Connection lost
- `message_received` - New message arrived
- `incoming_call` - Incoming call notification
- `call_rejected` - Call was rejected
- `call_ended` - Call ended
- `user_typing` - User is typing
- `user_online` - User came online
- `user_offline` - User went offline
- `socket:error` - Socket error occurred

---

#### `emit(event, data?)`

Send custom socket event.

```typescript
socketService.emit("custom_event", {
  data: "some data",
});
```

---

#### `sendMessage(conversationId, message)`

Emit message event.

```typescript
socketService.sendMessage("conv_123", "Hello!");
```

---

#### `initiateCall(receiverId, callType, channelName)`

Emit call initiation.

```typescript
socketService.initiateCall("user_456", "video", "call_xyz");
```

---

#### `acceptCall(callerId, channelName)`

Emit call acceptance.

```typescript
socketService.acceptCall("user_123", "call_xyz");
```

---

#### `rejectCall(callerId, channelName)`

Emit call rejection.

```typescript
socketService.rejectCall("user_123", "call_xyz");
```

---

#### `sendTyping(conversationId, isTyping)`

Send typing indicator.

```typescript
// User started typing
socketService.sendTyping("conv_123", true);

// User stopped typing
socketService.sendTyping("conv_123", false);
```

---

#### `isConnected()`

Check socket connection status.

```typescript
if (socketService.isConnected()) {
  console.log("Socket is connected");
} else {
  console.log("Socket is disconnected");
}
```

**Returns:** `boolean`

---

## 🎯 Common Patterns

### Pattern 1: Loading Data

```typescript
const [data, setData] = useState(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  const loadData = async () => {
    try {
      const result = await service.getData();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  loadData();
}, []);
```

### Pattern 2: Real-Time Updates

```typescript
useEffect(() => {
  const unsubscribe = socketService.on("event", (data) => {
    setLocalState((prev) => [...prev, data]);
  });

  return () => unsubscribe();
}, []);
```

### Pattern 3: Optimistic Updates

```typescript
const handleSend = async (message) => {
  // Update UI immediately
  setMessages((prev) => [...prev, message]);

  try {
    // Send to server
    await api.send(message);
  } catch (error) {
    // Rollback on error
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    Alert.alert("Error", error.message);
  }
};
```

---

**For more examples, see the component files in `/app/` directory!**
