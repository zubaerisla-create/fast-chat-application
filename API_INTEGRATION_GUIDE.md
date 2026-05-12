# Fast Chat App - API Integration Setup Guide

## Overview

This app is fully integrated with a backend API for authentication, messaging, conversations, and user management. All services are properly typed with TypeScript and include error handling.

## Environment Setup

### 1. Configure Your API URL

Create a `.env.local` file in the root directory:

```bash
EXPO_PUBLIC_API_URL=https://fast-chat-1.onrender.com
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

The following packages are already added:

- `axios` - HTTP client
- `@react-native-async-storage/async-storage` - Token persistence
- `socket.io-client` - Real-time communication

## Project Structure

### Services

Located in `/services/`, each service handles a specific API domain:

#### `authService.ts`

- `register()` - Register new user
- `login()` - Login user
- `logout()` - Clear local auth data
- `getToken()` - Retrieve stored JWT token
- `getUser()` - Retrieve stored user data
- `isAuthenticated()` - Check auth status

#### `usersService.ts`

- `getAllUsers()` - Fetch all users (excluding current user)
- `searchUsers(query)` - Search users by username/email
- `getUserProfile(userId)` - Get specific user profile
- `updateProfile(username, avatarUri?)` - Update user profile

#### `conversationsService.ts`

- `createOrGetConversation(receiverId)` - Create or fetch conversation
- `getUserConversations()` - Get all user conversations
- `sendMessage()` - Send text message
- `getMessages()` - Fetch messages with pagination
- `sendVoiceMessage()` - Send voice recording

#### `callingService.ts`

- `getAgoraToken()` - Get token for Agora video/audio
- `initiateCall()` - Start a call
- `endCall()` - End an active call
- `generateChannelName()` - Generate unique channel ID

#### `socketService.ts`

- Real-time event handling
- Socket connection management
- Event listeners for:
  - `message_received`
  - `incoming_call`
  - `user_typing`
  - `user_online/offline`

### Context

Located in `/context/`:

#### `AuthContext.tsx`

Global authentication state with:

- `user` - Current logged-in user
- `isAuthenticated` - Auth status
- `isLoading` - Loading state
- `login(email, password)` - Login function
- `register(username, email, password)` - Registration
- `logout()` - Logout function
- `updateUser(user)` - Update user state

### Utilities

Located in `/utils/`:

#### `apiClient.ts`

Axios instance with:

- Automatic token injection via interceptors
- 401 error handling
- Base URL configuration
- CORS headers for ngrok

## Integration Points

### 1. Authentication Flow

**Signup Screen** (`/app/screens/auth/SignupScreen.tsx`):

```typescript
import { useAuth } from "@/context/AuthContext";

const { register, login, isLoading } = useAuth();

// Register
await register(username, email, password);

// Login
await login(email, password);
```

### 2. Chat Screen Integration

**Chat Screen** (`/app/screens/chat/ChatScreen.tsx`):

```typescript
// Load messages
const messages = await conversationsService.getMessages(conversationId);

// Send message
await conversationsService.sendMessage(conversationId, text);

// Listen for real-time messages
socketService.on("message_received", (data) => {
  setMessages((prev) => [...prev, data.message]);
});
```

### 3. User Discovery

**Index Screen** (`/app/(tabs)/index.tsx`):

```typescript
// Load all users
const users = await usersService.getAllUsers();

// Search users
const results = await usersService.searchUsers("john");

// Update profile
await usersService.updateProfile(newUsername, avatarUri);
```

## API Endpoints Reference

### Authentication

- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login user

### Users

- `GET /api/users` - List all users
- `GET /api/users/search?query=...` - Search users
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/profile` - Update profile

### Conversations

- `POST /api/conversations` - Create/get conversation
- `GET /api/conversations` - List user conversations
- `GET /api/conversations/:id/media` - Get shared media

### Messages

- `POST /api/messages` - Send text message
- `GET /api/messages/:conversationId` - Fetch messages
- `POST /api/messages/voice` - Send voice message

### Calling

- `POST /api/agora/token` - Get Agora token
- `POST /api/call/initiate` - Start call
- `POST /api/call/end` - End call

## Error Handling

All services include try-catch blocks. Errors are:

- Thrown with descriptive messages
- Logged to console for debugging
- Caught in components with user-friendly alerts

```typescript
try {
  await authService.login(email, password);
} catch (error) {
  Alert.alert("Error", error.message);
}
```

## Real-Time Features with Socket.IO

### Connection

Socket connects automatically when user logs in (via AuthContext).

### Listening for Events

```typescript
// Listen for incoming messages
const unsubscribe = socketService.on("message_received", (data) => {
  setMessages((prev) => [...prev, data.message]);
});

// Cleanup
return () => unsubscribe();
```

### Emitting Events

```typescript
// Send typing indicator
socketService.sendTyping(conversationId, true);

// Send call
socketService.initiateCall(receiverId, "audio", channelName);
```

## Token Management

Tokens are automatically:

- Stored in AsyncStorage on login
- Retrieved and attached to requests via interceptor
- Cleared on logout
- Removed if 401 response received

## File Upload Example

```typescript
const formData = new FormData();
formData.append("username", newUsername);
formData.append("avatar", {
  uri: avatarUri,
  name: "avatar.jpg",
  type: "image/jpeg",
});

const response = await API.put("/users/profile", formData, {
  headers: { "Content-Type": "multipart/form-data" },
});
```

## Pagination Example

```typescript
// Fetch messages with pagination
const messages = await conversationsService.getMessages(
  conversationId,
  (page = 1),
  (limit = 50),
);
```

## ngrok Configuration (Local Development)

For testing with ngrok tunnel:

1. Start ngrok: `ngrok http 3000`
2. Add to `.env.local`: `EXPO_PUBLIC_API_URL=https://your-ngrok-url.ngrok.io`
3. The `apiClient` automatically adds `ngrok-skip-browser-warning` header

## Testing Checklist

- [ ] Authentication (signup/login/logout)
- [ ] User search and discovery
- [ ] Message sending and receiving
- [ ] Real-time socket events
- [ ] Profile updates
- [ ] Error handling and validation
- [ ] Token refresh and 401 handling
- [ ] API timeout scenarios

## Debugging

### Enable Console Logs

Errors are logged with descriptive messages:

```
[Service Name] Error: Detailed error message
```

### Check Token

```typescript
const token = await authService.getToken();
console.log("Current Token:", token);
```

### Socket Status

```typescript
console.log("Socket Connected:", socketService.isConnected());
```

## Troubleshooting

### "401 Unauthorized" Error

- Check token validity
- Re-login to refresh token
- Clear AsyncStorage cache

### Socket Not Connecting

- Verify backend is running
- Check Socket.IO CORS settings
- Restart socket connection

### API Request Fails

- Verify API URL in `.env.local`
- Check network connectivity
- Review request payload format

## Best Practices

1. **Always use context for auth state** - Don't pass auth data via props
2. **Handle loading states** - Show loading indicators during API calls
3. **Validate inputs** - Check required fields before sending
4. **Error boundaries** - Wrap components in error boundaries
5. **Clean up subscriptions** - Unsubscribe from socket events on unmount
6. **Cache data** - Store frequently accessed data locally
7. **Optimize requests** - Implement pagination and lazy loading

## Next Steps

1. Update backend API URL in `.env.local`
2. Install dependencies: `npm install`
3. Test each service endpoint
4. Configure Socket.IO on backend
5. Set up Agora SDK for video calls
6. Implement additional features as needed
