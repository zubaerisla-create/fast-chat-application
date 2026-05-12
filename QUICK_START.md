# Quick Start Guide - API Integration

## 5-Minute Setup

### Step 1: Configure Environment (1 min)

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local
EXPO_PUBLIC_API_URL=https://fast-chat-1.onrender.com
```

### Step 2: Install Dependencies (2 min)

```bash
npm install
```

### Step 3: Run the App (2 min)

```bash
npm start
# or
expo start
```

---

## File Structure Overview

```
fast-chat-app/
├── services/              # API services
│   ├── authService.ts     # Authentication
│   ├── usersService.ts    # User operations
│   ├── conversationsService.ts  # Messaging
│   ├── callingService.ts  # Voice/Video calls
│   └── socketService.ts   # Real-time updates
│
├── context/              # Global state
│   └── AuthContext.tsx   # Auth state management
│
├── utils/                # Helper utilities
│   └── apiClient.ts      # Axios configuration
│
└── app/                  # React Native screens
    ├── (tabs)/
    │   └── index.tsx     # Main chat list
    └── screens/
        ├── auth/
        │   └── SignupScreen.tsx  # Authentication
        └── chat/
            └── ChatScreen.tsx     # Chat interface
```

---

## Core Concepts

### 1. Authentication Context

Manages user login state globally:

```typescript
import { useAuth } from "@/context/AuthContext";

const { user, isAuthenticated, login, register, logout } = useAuth();
```

### 2. Service Layer

Handles all API communication:

```typescript
import authService from "@/services/authService";
import conversationsService from "@/services/conversationsService";
```

### 3. Real-Time Socket

Handles incoming messages and events:

```typescript
import socketService from "@/services/socketService";

socketService.on("message_received", callback);
```

---

## Common Tasks

### Task 1: Make a User Logged In

```typescript
// In SignupScreen or any auth component
import { useAuth } from "@/context/AuthContext";

const { login, register } = useAuth();

// For signup:
await register(username, email, password);

// For login:
await login(email, password);
```

### Task 2: Send a Message

```typescript
import conversationsService from "@/services/conversationsService";

await conversationsService.sendMessage(conversationId, "Your message here");
```

### Task 3: Get All Users

```typescript
import usersService from "@/services/usersService";

const users = await usersService.getAllUsers();
```

### Task 4: Display Current User

```typescript
import { useAuth } from "@/context/AuthContext";

const { user } = useAuth();

// Use user?.username, user?.email, user?.id
```

### Task 5: Logout User

```typescript
const { logout } = useAuth();
await logout();
```

---

## API Response Examples

### Register Success

```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "user_123",
    "username": "john_doe",
    "email": "john@example.com"
  }
}
```

### Message Success

```json
{
  "message": {
    "id": "msg_456",
    "text": "Hello!",
    "conversationId": "conv_789",
    "senderId": "user_123",
    "timestamp": "2026-05-12T10:00:00Z"
  }
}
```

---

## Error Handling

All services throw errors that you can catch:

```typescript
try {
  await authService.login(email, password);
} catch (error) {
  Alert.alert("Error", error.message);
}
```

Common errors:

- "Invalid email or password" - Login failed
- "Email already exists" - Signup failed
- "Network error" - No internet connection
- "401 Unauthorized" - Token expired

---

## Socket Events

### Listen for Events

```typescript
socketService.on("message_received", (data) => {
  // data = { conversationId, message }
});

socketService.on("user_typing", (data) => {
  // data = { conversationId, isTyping }
});

socketService.on("incoming_call", (data) => {
  // data = { callerId, callType, channelName }
});
```

### Emit Events

```typescript
socketService.sendMessage(conversationId, text);
socketService.sendTyping(conversationId, true);
socketService.initiateCall(receiverId, "audio", channelName);
```

---

## Environment Variables

### Available Variables

```bash
EXPO_PUBLIC_API_URL    # Your backend API URL
```

### Different Environments

**Local Development:**

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000
```

**ngrok Tunnel:**

```bash
EXPO_PUBLIC_API_URL=https://your-ngrok-url.ngrok.io
```

**Production:**

```bash
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
```

---

## Token Management

### Automatic Token Handling

Tokens are automatically:

- Stored after login
- Attached to all requests
- Removed on logout
- Cleared on 401 error

### Manual Token Access

```typescript
const token = await authService.getToken();
const user = await authService.getUser();
```

---

## Debugging

### Check if User is Logged In

```typescript
const isAuth = await authService.isAuthenticated();
console.log("Is authenticated:", isAuth);
```

### Check Current Token

```typescript
const token = await authService.getToken();
console.log("Token:", token);
```

### Check Socket Status

```typescript
console.log("Socket connected:", socketService.isConnected());
```

### View AsyncStorage (DevTools)

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

const token = await AsyncStorage.getItem("authToken");
const user = await AsyncStorage.getItem("user");
```

---

## Performance Tips

1. **Memoize components** - Use useMemo for expensive calculations
2. **Lazy load messages** - Use pagination for message history
3. **Debounce search** - Add delay to search input
4. **Cache user data** - Store in AsyncStorage
5. **Optimize re-renders** - Use useCallback for callbacks

---

## Testing Checklist

- [ ] Can register new user
- [ ] Can login with existing user
- [ ] Can see logged-in username
- [ ] Can send message
- [ ] Can receive message in real-time
- [ ] Can logout
- [ ] Can update profile
- [ ] Error messages display correctly

---

## Helpful Links

- [API Integration Guide](./API_INTEGRATION_GUIDE.md)
- [Full Integration Summary](./INTEGRATION_SUMMARY.md)
- [React Native Docs](https://reactnative.dev/)
- [Expo Docs](https://docs.expo.dev/)
- [Axios Docs](https://axios-http.com/)
- [Socket.IO Docs](https://socket.io/)

---

## Support

If something breaks:

1. Check `.env.local` configuration
2. Verify network connectivity
3. Check console for error messages
4. Review service implementation
5. Check API backend status

---

**Ready to build? Start with Task 1 above! 🚀**
