import { useAuth } from "@/context/AuthContext";
import { User } from "@/services/authService";
import usersService from "@/services/usersService";
import conversationsService from "@/services/conversationsService";
import socketService from "@/services/socketService";
import { formatConversationTime } from "@/utils/dateFormatter";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Chat {
  id: string;
  name: string;
  message: string;
  time: string;
  avatar: string | number;
  color: string;
}

const chats: Chat[] = [
  {
    id: "1",
    name: "hhhh",
    message: "hi",
    time: "4 days",
    avatar: "H",
    color: "#3B82F6",
  },
  {
    id: "2",
    name: "Defjk",
    message: "Bzjzs",
    time: "4 days",
    avatar: "D",
    color: "#000000",
  },
];

export default function App() {
  const router = useRouter();
  const { user, logout, updateUser, onlineUsers } = useAuth();

  const [modalVisible, setModalVisible] = useState(false);
  const [username, setUsername] = useState(user?.username || "abcde");
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [userConversations, setUserConversations] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [typingConversations, setTypingConversations] = useState<{ [conversationId: string]: boolean }>({});

  // Load all users and conversations on component mount / screen focus
  useFocusEffect(
    useCallback(() => {
      loadUsers();
      loadConversations();
    }, [])
  );

  const userConversationsRef = useRef<any[]>([]);
  
  useEffect(() => {
    userConversationsRef.current = userConversations;
  }, [userConversations]);

  // Real-time: update conversation list when a new message arrives
  useEffect(() => {
    const unsubscribe = socketService.on("message_received", (data: any) => {
      const incomingMsg = data.message || data;
      const convId = (incomingMsg.conversationId?._id || incomingMsg.conversationId)?.toString();
      if (!convId) return;

      const exists = userConversationsRef.current.some(conv => (conv.id || conv._id)?.toString() === convId);
      
      if (!exists) {
        // If it's a new conversation from a new user, reload the list to get participant details
        loadConversations();
      } else {
        // Otherwise, just update the last message in the existing list
        setUserConversations((prev) =>
          prev.map((conv) => {
            const id = (conv.id || conv._id)?.toString();
            if (id === convId) {
              return {
                ...conv,
                lastMessage: incomingMsg.text || "New message",
                lastMessageTime: incomingMsg.createdAt || new Date().toISOString(),
              };
            }
            return conv;
          })
        );
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time: update conversation list typing status
  useEffect(() => {
    const unsubscribeTyping = socketService.on("user_typing", (data: any) => {
      const convId = data.conversationId?.toString();
      if (convId) {
        setTypingConversations(prev => ({ ...prev, [convId]: true }));
      }
    });

    const unsubscribeStoppedTyping = socketService.on("user_stopped_typing", (data: any) => {
      const convId = data.conversationId?.toString();
      if (convId) {
        setTypingConversations(prev => ({ ...prev, [convId]: false }));
      }
    });

    return () => {
      unsubscribeTyping();
      unsubscribeStoppedTyping();
    };
  }, []);

  const loadConversations = async () => {
    try {
      setIsLoadingChats(true);
      const conversations = await conversationsService.getUserConversations();
      setUserConversations(conversations);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setIsLoadingChats(false);
    }
  };

  const loadUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const users = await usersService.getAllUsers();
      setAllUsers(users);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      Alert.alert("Success", "Logged out successfully");
      router.replace("/screens/auth/SignupScreen");
    } catch (error) {
      Alert.alert("Error", "Failed to logout");
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      if (!username.trim()) {
        Alert.alert("Error", "Username cannot be empty");
        return;
      }

      const updatedUser = await usersService.updateProfile(username, selectedImage || undefined);
      updateUser(updatedUser);
      Alert.alert("Success", "Profile updated successfully");
      setModalVisible(false);
      setSelectedImage(null); // Clear local selection
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update profile");
    }
  };

  const renderChat = ({ item }: { item: any }) => {
    const isUser = "username" in item;
    
    // Find the other participant if it's a conversation and user is loaded
    let otherParticipant = null;
    if (!isUser && item.participants && user) {
      otherParticipant = item.participants.find(
        (p: any) => (p._id || p.id).toString() !== (user?.id || user?._id)?.toString()
      );
    }

    const name = isUser 
      ? item.username 
      : (otherParticipant?.username || item.participantName || item.name || "User");
    
    // Ensure message is a string, handle if lastMessage is an object
    let message = "No messages yet";
    if (isUser) {
      message = item.email;
    } else if (item.lastMessage) {
      message = typeof item.lastMessage === "string" ? item.lastMessage : (item.lastMessage.text || "New message");
    }

    const convId = (item.id || item._id)?.toString();
    const isTyping = !isUser && convId ? typingConversations[convId] : false;

    const avatar = isUser 
      ? (item.avatar || name.charAt(0).toUpperCase()) 
      : (otherParticipant?.avatar || item.participantAvatar || name.charAt(0).toUpperCase());
    
    const color = isUser ? "#10B981" : "#3B82F6";
    const time = isUser ? "" : formatConversationTime(item.lastMessageTime);
    
    // Check if participant is online (combine real-time socket data with DB status)
    const participantId = isUser ? (item.id || item._id) : (otherParticipant?._id || otherParticipant?.id);
    const isOnlineSocket = participantId ? onlineUsers.includes(participantId.toString()) : false;
    const isOnlineDB = isUser ? item.isOnline : otherParticipant?.isOnline;
    const isOnline = isOnlineSocket || isOnlineDB;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => {
          if (!user) return; // Prevent navigation before auth state is ready
          
          const itemId = item.id || item._id;
          const targetId = isUser ? (item.id || item._id) : (otherParticipant?._id || otherParticipant?.id);
          
          // Safety fallback: do not navigate to undefined or ourselves
          const loggedInUserId = (user.id || user._id)?.toString();
          if (!targetId || targetId.toString() === loggedInUserId) {
            console.warn("⚠️ Cannot navigate to chat: targetId is undefined or matches logged-in user.");
            return;
          }
          
          if (searchText) {
            setSearchText("");
            setSearchVisible(false);
          }
          
          router.push(`../screens/chat/ChatScreen?name=${name}&conversationId=${isUser ? "" : itemId}&userId=${targetId}`);
        }}
      >
        <View
          style={[styles.avatar, { backgroundColor: color || "#10B981" }]}
        >
          {typeof avatar === "string" && !avatar.startsWith("http") ? (
            <Text style={styles.avatarText}>{avatar}</Text>
          ) : (
            <Image source={typeof avatar === "string" ? { uri: avatar } : avatar} style={styles.avatarImage} />
          )}
          
          {/* Online Dot Overlay on Avatar */}
          {isOnline && <View style={styles.avatarOnlineDot} />}
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.nameContainer}>
            <Text style={styles.chatName}>{name}</Text>
          </View>
          <Text style={[styles.chatMessage, isTyping && styles.typingText]} numberOfLines={1}>
            {isTyping ? "typing..." : message}
          </Text>
        </View>
        {time ? <Text style={styles.time}>{time}</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>fast-chat</Text>
        <View style={styles.headerIcons}>
          {/* Search Button - Now Toggles Search Bar */}
          <TouchableOpacity onPress={() => {
            if (searchVisible) {
              setSearchText("");
            }
            setSearchVisible(!searchVisible);
          }}>
            <Ionicons name="search" size={24} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={{ marginLeft: 20 }}
          >
            <Ionicons name="settings-outline" size={24} color="#94A3B8" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogout}
            style={{ marginLeft: 20 }}
          >
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* User Profile Bar */}
      <TouchableOpacity
        style={styles.userBar}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.userAvatar}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.userAvatarText}>
              {user?.username?.charAt(0).toUpperCase() || "A"}
            </Text>
          )}
        </View>
        <View>
          <Text style={styles.userName}>{user?.username || username}</Text>
          <Text style={styles.userEmail}>
            {user?.email || "user@gmail.com"}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Search Bar - Now Conditional */}
      {searchVisible && (
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color="#64748B"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Find people..."
            placeholderTextColor="#64748B"
            value={searchText}
            onChangeText={setSearchText}
            autoFocus
          />
          <TouchableOpacity onPress={() => {
            setSearchVisible(false);
            setSearchText("");
          }}>
            <Ionicons name="close" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>
      )}

      {/* Messages Section */}
      <View style={styles.messagesHeader}>
        <Text style={styles.sectionTitle}>
          {searchText ? "SEARCH RESULTS" : "MESSAGES"}
        </Text>
      </View>

      <FlatList
        data={
          searchText
            ? allUsers.filter(
                (u) =>
                  u.username.toLowerCase().includes(searchText.toLowerCase()) ||
                  u.email.toLowerCase().includes(searchText.toLowerCase())
              )
            : userConversations
        }
        renderItem={renderChat}
        keyExtractor={(item, index) => `${item.id || item._id || index}-${index}`}
        contentContainerStyle={styles.listContent}
        refreshing={isLoadingChats}
        onRefresh={loadConversations}
        ListEmptyComponent={
          searchText ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <Text style={{ color: "#94A3B8" }}>No users found matching "{searchText}"</Text>
            </View>
          ) : (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Ionicons name="chatbubbles-outline" size={48} color="#475569" />
              <Text style={{ color: "#94A3B8", marginTop: 12 }}>No conversations yet. Search to start one!</Text>
            </View>
          )
        }
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
      />

      {/* Edit Profile Modal (Same as before) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.profilePicContainer}>
              <View style={styles.profileAvatar}>
                {selectedImage || user?.avatar ? (
                  <Image
                    source={{ uri: selectedImage || user?.avatar }}
                    style={styles.profileAvatarImage}
                  />
                ) : (
                  <Text style={styles.profileAvatarText}>
                    {username.charAt(0).toUpperCase() || "A"}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={handlePickImage}
              >
                <Ionicons name="camera" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.changePhotoText}>CHANGE PROFILE PICTURE</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>NEW USERNAME</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="#64748B"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter username"
                  placeholderTextColor="#64748B"
                />
              </View>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleUpdateProfile}
              >
                <Text style={styles.saveText}>Save Profile</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  title: { fontSize: 28, fontWeight: "bold", color: "#fff", paddingTop: 4 },
  headerIcons: { flexDirection: "row", alignItems: "center" },

  userBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  userAvatarText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  userName: { color: "#fff", fontSize: 16, fontWeight: "600" },
  userEmail: { color: "#94A3B8", fontSize: 12, marginTop: 2 },

  /* Search Styles */
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    height: 48,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: "#fff", fontSize: 16 },

  messagesHeader: { paddingHorizontal: 16, paddingVertical: 8 },
  sectionTitle: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  listContent: { paddingHorizontal: 8 },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  avatarImage: { width: "100%", height: "100%", borderRadius: 24 },
  chatInfo: { flex: 1, justifyContent: "center" },
  nameContainer: { flexDirection: "row", alignItems: "center" },
  chatName: { color: "#fff", fontSize: 16, fontWeight: "600", marginBottom: 4 },
  chatMessage: { color: "#94A3B8", fontSize: 14 },
  typingText: { color: "#A78BFA", fontWeight: "600" },
  avatarOnlineDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#0F172A",
  },
  time: { color: "#64748B", fontSize: 12 },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContentContainer: {
    width: "90%",
    backgroundColor: "#1E2937",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 22, fontWeight: "bold", color: "#fff" },

  profilePicContainer: { position: "relative", marginVertical: 10 },
  profileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#14B8A6",
    justifyContent: "center",
    alignItems: "center",
  },
  profileAvatarText: { color: "#fff", fontSize: 40, fontWeight: "bold" },
  profileAvatarImage: { width: "100%", height: "100%", borderRadius: 50 },
  cameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#6366F1",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#1E2937",
  },
  changePhotoText: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 20,
    fontWeight: "500",
  },
  inputContainer: { width: "100%", marginBottom: 20 },
  inputLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, color: "#fff", fontSize: 16 },

  buttonContainer: { flexDirection: "row", width: "100%", gap: 12 },
  cancelButton: {
    flex: 1,
    backgroundColor: "#334155",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  saveButton: {
    flex: 1,
    backgroundColor: "#6366F1",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E2937",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  logoutText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
