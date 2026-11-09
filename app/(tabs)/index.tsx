import { avatarGradient, gradients, palette, radius } from "@/constants/design";
import { useAuth } from "@/context/AuthContext";
import { User } from "@/services/authService";
import conversationsService from "@/services/conversationsService";
import friendsService, { FriendRequest } from "@/services/friendsService";
import socketService from "@/services/socketService";
import usersService, { ExactSearchResult } from "@/services/usersService";
import { formatConversationTime } from "@/utils/dateFormatter";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const idOf = (x: any): string => (x?._id || x?.id || "").toString();

/**
 * Round avatar: photo when available, otherwise initials on a stable gradient.
 */
function Avatar({
  name,
  uri,
  size = 52,
  online,
  isGroup,
}: {
  name: string;
  uri?: string;
  size?: number;
  online?: boolean;
  isGroup?: boolean;
}) {
  const colors = isGroup ? (["#4F46E5", "#06B6D4"] as const) : avatarGradient(name);
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette.surface }}
        />
      ) : (
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}
        >
          {isGroup ? (
            <Ionicons name="people" size={size * 0.45} color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: size * 0.38, fontWeight: "700" }}>
              {(name || "?").charAt(0).toUpperCase()}
            </Text>
          )}
        </LinearGradient>
      )}
      {online && !isGroup && (
        <View
          style={[
            styles.onlineDot,
            { width: size * 0.27, height: size * 0.27, borderRadius: size * 0.135, right: 0, bottom: 0 },
          ]}
        />
      )}
    </View>
  );
}

const previewOf = (lastMessage: any): string => {
  if (!lastMessage) return "Say hello 👋";
  if (typeof lastMessage === "string") return lastMessage;
  if (lastMessage.text) return lastMessage.text;
  switch (lastMessage.fileType) {
    case "image":
      return "📷 Photo";
    case "video":
      return "🎬 Video";
    case "audio":
      return "🎤 Voice message";
    case "file":
      return `📎 ${lastMessage.fileName || "File"}`;
    default:
      return "New message";
  }
};

export default function App() {
  const router = useRouter();
  const { user, logout, updateUser, onlineUsers } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const isSmallDevice = windowWidth < 360;
  const myId = idOf(user);

  // Tab State: "chats" | "requests"
  const [activeTab, setActiveTab] = useState<"chats" | "requests">("chats");

  // Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [blockedModalVisible, setBlockedModalVisible] = useState(false);
  const [newGroupModalVisible, setNewGroupModalVisible] = useState(false);

  // Profile Edit
  const [username, setUsername] = useState(user?.username || "");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Blocked Users
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);

  // Group Creation
  const [groupTitle, setGroupTitle] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [friendsList, setFriendsList] = useState<User[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Conversations & Requests
  const [userConversations, setUserConversations] = useState<any[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [hasLoadedChats, setHasLoadedChats] = useState(false);

  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  // Exact Search
  const [searchText, setSearchText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<ExactSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);

  const [typingConversations, setTypingConversations] = useState<{ [conversationId: string]: boolean }>({});
  const searchRef = useRef<TextInput>(null);
  const userConversationsRef = useRef<any[]>([]);

  useEffect(() => {
    userConversationsRef.current = userConversations;
  }, [userConversations]);

  // Initial and focus load
  useFocusEffect(
    useCallback(() => {
      loadConversations();
      loadRequests();
    }, [])
  );

  // Load conversations
  const loadConversations = async () => {
    try {
      setIsLoadingChats(true);
      const conversations = await conversationsService.getUserConversations();
      setUserConversations(conversations);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setIsLoadingChats(false);
      setHasLoadedChats(true);
    }
  };

  // Load requests
  const loadRequests = async () => {
    try {
      setIsLoadingRequests(true);
      const res = await friendsService.getRequests();
      setIncomingRequests(res.incoming || []);
      setOutgoingRequests(res.outgoing || []);
    } catch (error) {
      console.error("Error loading requests:", error);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  // Load friends for group creation
  const openNewGroupModal = async () => {
    setGroupTitle("");
    setGroupDescription("");
    setSelectedFriendIds([]);
    setNewGroupModalVisible(true);
    try {
      const friends = await friendsService.getFriends();
      setFriendsList(friends);
    } catch (error) {
      console.error("Failed to load friends:", error);
    }
  };

  // Create Group
  const handleCreateGroup = async () => {
    if (!groupTitle.trim()) {
      Alert.alert("Group Name Required", "Please enter a name for the group.");
      return;
    }
    if (selectedFriendIds.length === 0) {
      Alert.alert("Select Members", "Please select at least one friend to add to the group.");
      return;
    }

    try {
      setIsCreatingGroup(true);
      const group = await conversationsService.createGroup({
        title: groupTitle.trim(),
        description: groupDescription.trim() || undefined,
        memberIds: selectedFriendIds,
      });

      setNewGroupModalVisible(false);
      await loadConversations();

      // Navigate to the group chat
      router.push(
        `../screens/chat/ChatScreen?name=${encodeURIComponent(group.title || "Group")}&conversationId=${idOf(group)}&isGroup=true`
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create group.");
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Load blocked accounts
  const openBlockedAccountsModal = async () => {
    setBlockedModalVisible(true);
    setIsLoadingBlocked(true);
    try {
      const list = await usersService.getBlockedUsers();
      setBlockedUsers(list);
    } catch (error) {
      console.error("Error fetching blocked users:", error);
    } finally {
      setIsLoadingBlocked(false);
    }
  };

  // Unblock user
  const handleUnblockUser = async (targetId: string, targetName: string) => {
    try {
      await usersService.unblockUser(targetId);
      setBlockedUsers((prev) => prev.filter((u) => idOf(u) !== targetId));
      Alert.alert("Unblocked", `${targetName} has been unblocked.`);
      loadConversations();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to unblock user.");
    }
  };

  // Exact Username Search
  const handleExactSearch = async () => {
    const query = searchText.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const result = await usersService.searchExactUsername(query);
      setSearchResult(result);
    } catch (error: any) {
      setSearchError(error.message || "User not found");
    } finally {
      setIsSearching(false);
    }
  };

  // Send friend request
  const handleSendFriendRequest = async (receiverId: string) => {
    try {
      setIsActionPending(true);
      await friendsService.sendRequest({ receiverId });
      if (searchResult) {
        setSearchResult({ ...searchResult, relationship: "pending_outgoing" });
      }
      loadRequests();
      Alert.alert("Request Sent", "Your message request has been sent.");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send request.");
    } finally {
      setIsActionPending(false);
    }
  };

  // Cancel friend request
  const handleCancelFriendRequest = async (requestId?: string) => {
    try {
      setIsActionPending(true);
      if (requestId) {
        await friendsService.cancelRequest(requestId);
      }
      if (searchResult) {
        setSearchResult({ ...searchResult, relationship: "none", requestId: undefined });
      }
      loadRequests();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to cancel request.");
    } finally {
      setIsActionPending(false);
    }
  };

  // Accept request
  const handleAcceptRequest = async (requestId: string) => {
    try {
      setIsActionPending(true);
      const res = await friendsService.acceptRequest(requestId);
      loadRequests();
      loadConversations();
      Alert.alert("Request Accepted", "You can now chat with this user.");
      if (res.conversation) {
        openChat(res.conversation.otherUser || {}, idOf(res.conversation));
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to accept request.");
    } finally {
      setIsActionPending(false);
    }
  };

  // Reject request
  const handleRejectRequest = async (requestId: string) => {
    try {
      setIsActionPending(true);
      await friendsService.rejectRequest(requestId);
      loadRequests();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to decline request.");
    } finally {
      setIsActionPending(false);
    }
  };

  // Real-time Socket Event Handlers
  useEffect(() => {
    const unsubMessage = socketService.on("message_received", (data: any) => {
      const incomingMsg = data.message || data;
      const convId = (incomingMsg.conversationId?._id || incomingMsg.conversationId)?.toString();
      if (!convId) return;

      const exists = userConversationsRef.current.some((conv) => idOf(conv) === convId);

      if (!exists) {
        loadConversations();
      } else {
        setUserConversations((prev) => {
          const updated = prev.map((conv) =>
            idOf(conv) === convId
              ? {
                  ...conv,
                  lastMessage: { ...incomingMsg, senderId: idOf(incomingMsg.senderId) || incomingMsg.senderId },
                  lastMessageTime: incomingMsg.createdAt || new Date().toISOString(),
                }
              : conv
          );
          const index = updated.findIndex((conv) => idOf(conv) === convId);
          return index > 0 ? [updated[index], ...updated.slice(0, index), ...updated.slice(index + 1)] : updated;
        });
      }
    });

    const unsubTyping = socketService.on("user_typing", (data: any) => {
      const convId = data.conversationId?.toString();
      if (convId) setTypingConversations((prev) => ({ ...prev, [convId]: true }));
    });

    const unsubStoppedTyping = socketService.on("user_stopped_typing", (data: any) => {
      const convId = data.conversationId?.toString();
      if (convId) setTypingConversations((prev) => ({ ...prev, [convId]: false }));
    });

    // Real-time Friend Request Events
    const unsubReqReceived = socketService.on("friendRequestReceived", () => {
      loadRequests();
    });
    const unsubReqAccepted = socketService.on("friendRequestAccepted", () => {
      loadRequests();
      loadConversations();
    });
    const unsubReqRejected = socketService.on("friendRequestRejected", () => {
      loadRequests();
    });
    const unsubReqCanceled = socketService.on("friendRequestCanceled", () => {
      loadRequests();
    });
    const unsubBlocked = socketService.on("userBlocked", () => {
      loadConversations();
    });
    const unsubUnblocked = socketService.on("userUnblocked", () => {
      loadConversations();
    });
    const unsubConvAdded = socketService.on("conversationAdded", () => {
      loadConversations();
    });

    return () => {
      unsubMessage();
      unsubTyping();
      unsubStoppedTyping();
      unsubReqReceived();
      unsubReqAccepted();
      unsubReqRejected();
      unsubReqCanceled();
      unsubBlocked();
      unsubUnblocked();
      unconvAddedSafe(unsubConvAdded);
      unconvAddedSafe(unsubBlocked);
      unconvAddedSafe(unsubUnblocked);
    };
  }, []);

  const unconvAddedSafe = (fn: any) => {
    if (typeof fn === "function") fn();
  };

  const isOnline = useCallback(
    (person: any) => {
      const pid = idOf(person);
      return (pid && onlineUsers.includes(pid)) || !!person?.isOnline;
    },
    [onlineUsers]
  );

  const otherParticipant = (conv: any) => conv.participants?.find((p: any) => idOf(p) !== myId);

  const openChat = (target: any, conversationId = "", isGroup = false) => {
    if (searchText) {
      setSearchText("");
      setSearchResult(null);
      setSearchError(null);
    }
    if (isGroup) {
      router.push(
        `../screens/chat/ChatScreen?name=${encodeURIComponent(target.title || "Group")}&conversationId=${conversationId}&isGroup=true`
      );
      return;
    }

    const targetId = idOf(target);
    if (!targetId || targetId === myId) return;

    router.push(
      `../screens/chat/ChatScreen?name=${encodeURIComponent(target.username || "User")}&conversationId=${conversationId}&userId=${targetId}`
    );
  };

  const handleLogout = () => {
    Alert.alert("Log out?", "You'll need to sign in again to see your messages.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          try {
            setModalVisible(false);
            await logout();
            router.replace("/screens/auth/SignupScreen");
          } catch {
            Alert.alert("Error", "Failed to log out");
          }
        },
      },
    ]);
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

      setIsSavingProfile(true);
      const updatedUser = await usersService.updateProfile(username.trim(), selectedImage || undefined);
      updateUser({ ...user, ...updatedUser } as User);
      setModalVisible(false);
      setSelectedImage(null);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Render a conversation item in Chats list
  const renderConversation = ({ item }: { item: any }) => {
    const isGroup = item.type === "group";
    const other = isGroup ? null : otherParticipant(item) || { username: item.participantName || "User" };
    const name = isGroup ? item.title || "Group Chat" : other?.username || "User";
    const avatar = isGroup ? item.avatar : other?.avatar;
    const convId = idOf(item);
    const isTyping = typingConversations[convId];
    const last = item.lastMessage;
    const fromMe = last && typeof last === "object" && idOf(last.senderId) === myId;
    const unread = last && typeof last === "object" && !fromMe && last.isRead === false;

    return (
      <Pressable
        onPress={() => openChat(isGroup ? item : other, convId, isGroup)}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        android_ripple={{ color: "rgba(255,255,255,0.04)" }}
      >
        <Avatar name={name} uri={avatar} online={isGroup ? false : isOnline(other)} isGroup={isGroup} />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
              {isGroup && (
                <View style={styles.groupBadge}>
                  <Text style={styles.groupBadgeText}>Group</Text>
                </View>
              )}
              <Text style={[styles.rowName, unread && styles.rowNameUnread]} numberOfLines={1}>
                {name}
              </Text>
            </View>
            <Text style={[styles.rowTime, unread && { color: palette.accent }]}>
              {formatConversationTime(item.lastMessageTime || last?.createdAt)}
            </Text>
          </View>
          <View style={styles.rowBottom}>
            {isTyping ? (
              <Text style={styles.typing} numberOfLines={1}>
                typing…
              </Text>
            ) : (
              <Text style={[styles.rowPreview, unread && styles.rowPreviewUnread]} numberOfLines={1}>
                {fromMe ? <Text style={styles.youPrefix}>You: </Text> : null}
                {previewOf(last)}
              </Text>
            )}
            {unread ? (
              <View style={styles.unreadDot} />
            ) : fromMe && last?.isRead ? (
              <Ionicons name="checkmark-done" size={16} color={palette.accent} />
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  // Render Exact Search Result Card
  const renderExactSearchResult = () => {
    if (!searchResult && !searchError) return null;

    if (searchError) {
      return (
        <View style={styles.searchResultBox}>
          <View style={styles.notFoundRow}>
            <Ionicons name="alert-circle-outline" size={24} color={palette.danger} />
            <Text style={styles.notFoundText}>{searchError}</Text>
          </View>
          <Text style={styles.notFoundSubtext}>
            Enter the exact, full username (case-sensitive or exact letters).
          </Text>
        </View>
      );
    }

    if (!searchResult) return null;
    const target = searchResult.user;
    const rel = searchResult.relationship;

    return (
      <View style={styles.searchResultBox}>
        <View style={styles.searchResultCard}>
          <Avatar name={target.username} uri={target.avatar} size={50} online={isOnline(target)} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.searchResultName}>{target.username}</Text>
            <Text style={styles.searchResultEmail}>{target.email}</Text>
          </View>
          <View>
            {rel === "none" && (
              <TouchableOpacity
                onPress={() => handleSendFriendRequest(idOf(target))}
                disabled={isActionPending}
                style={styles.actionBtnPrimary}
              >
                {isActionPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="person-add" size={15} color="#fff" style={{ marginRight: 5 }} />
                    <Text style={styles.actionBtnPrimaryText}>Add Friend</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {rel === "pending_outgoing" && (
              <TouchableOpacity
                onPress={() => handleCancelFriendRequest(searchResult.requestId || undefined)}
                disabled={isActionPending}
                style={styles.actionBtnSecondary}
              >
                <Text style={styles.actionBtnSecondaryText}>Pending (Cancel)</Text>
              </TouchableOpacity>
            )}

            {rel === "pending_incoming" && (
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity
                  onPress={() => searchResult.requestId && handleAcceptRequest(searchResult.requestId)}
                  disabled={isActionPending}
                  style={styles.actionBtnPrimary}
                >
                  <Text style={styles.actionBtnPrimaryText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => searchResult.requestId && handleRejectRequest(searchResult.requestId)}
                  disabled={isActionPending}
                  style={styles.actionBtnDanger}
                >
                  <Text style={styles.actionBtnDangerText}>Decline</Text>
                </TouchableOpacity>
              </View>
            )}

            {rel === "accepted" && (
              <TouchableOpacity
                onPress={() => openChat(target)}
                style={styles.actionBtnPrimary}
              >
                <Ionicons name="chatbubble" size={14} color="#fff" style={{ marginRight: 5 }} />
                <Text style={styles.actionBtnPrimaryText}>Message</Text>
              </TouchableOpacity>
            )}

            {rel === "blocked" && (
              <View style={styles.badgeBlocked}>
                <Text style={styles.badgeBlockedText}>Blocked</Text>
              </View>
            )}

            {rel === "self" && (
              <View style={styles.badgeSelf}>
                <Text style={styles.badgeSelfText}>You</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={palette.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting} numberOfLines={1}>Hi, {user?.username || "there"}</Text>
          <Text style={[styles.title, isSmallDevice && { fontSize: 24 }]} numberOfLines={1}>
            Messages
          </Text>
        </View>
        <View style={styles.headerRight}>
          {/* New Group Button */}
          <Pressable
            onPress={openNewGroupModal}
            style={({ pressed }) => [styles.newGroupBtn, pressed && { opacity: 0.8 }]}
            hitSlop={6}
          >
            <LinearGradient
              colors={["#6366F1", "#8B7CFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.newGroupIconWrap}
            >
              <Ionicons name="people" size={14} color="#fff" />
            </LinearGradient>
            <Text style={styles.newGroupBtnText}>
              {windowWidth < 370 ? "Group" : "New Group"}
            </Text>
          </Pressable>

          {/* Finance Button */}
          <Pressable
            onPress={() => router.push("/(tabs)/finance")}
            style={({ pressed }) => [styles.financeIconBtn, pressed && { opacity: 0.8 }]}
            hitSlop={6}
          >
            <Ionicons name="wallet-outline" size={17} color="#8B7CFF" />
          </Pressable>

          {/* Profile Avatar Button */}
          <Pressable
            onPress={() => {
              setUsername(user?.username || "");
              setModalVisible(true);
            }}
            hitSlop={8}
            style={styles.headerAvatarBtn}
          >
            <Avatar name={user?.username || "?"} uri={user?.avatar} size={isSmallDevice ? 36 : 40} />
          </Pressable>
        </View>
      </View>

      {/* Exact Username Search Input */}
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={palette.textFaint} />
        <TextInput
          ref={searchRef}
          style={styles.searchInput}
          placeholder="Search by exact username..."
          placeholderTextColor={palette.textFaint}
          value={searchText}
          onChangeText={(t) => {
            setSearchText(t);
            if (searchResult || searchError) {
              setSearchResult(null);
              setSearchError(null);
            }
          }}
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={palette.accent}
          returnKeyType="search"
          onSubmitEditing={handleExactSearch}
        />
        {isSearching ? (
          <ActivityIndicator size="small" color={palette.accent} />
        ) : searchText ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              onPress={() => {
                setSearchText("");
                setSearchResult(null);
                setSearchError(null);
              }}
              hitSlop={10}
            >
              <Ionicons name="close-circle" size={18} color={palette.textMuted} />
            </Pressable>
            <TouchableOpacity onPress={handleExactSearch} style={styles.searchSubmitBtn}>
              <Text style={styles.searchSubmitBtnText}>Find</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Search Result Card (if any) */}
      {renderExactSearchResult()}

      {/* Tabs Switcher: Chats vs Requests */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          onPress={() => setActiveTab("chats")}
          style={[styles.tabButton, activeTab === "chats" && styles.tabButtonActive]}
        >
          <Text style={[styles.tabButtonText, activeTab === "chats" && styles.tabButtonTextActive]}>
            Chats
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab("requests")}
          style={[styles.tabButton, activeTab === "requests" && styles.tabButtonActive]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[styles.tabButtonText, activeTab === "requests" && styles.tabButtonTextActive]}>
              Requests
            </Text>
            {incomingRequests.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{incomingRequests.length}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Content depending on active tab */}
      {activeTab === "chats" ? (
        <FlatList
          data={userConversations}
          renderItem={renderConversation}
          keyExtractor={(item, index) => `${idOf(item) || index}`}
          ListEmptyComponent={
            !hasLoadedChats ? (
              <View style={styles.empty}>
                <ActivityIndicator color={palette.accent} />
              </View>
            ) : (
              <View style={styles.empty}>
                <LinearGradient colors={gradients.primary} style={styles.emptyIcon}>
                  <Ionicons name="chatbubbles" size={30} color="#fff" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>No conversations yet</Text>
                <Text style={styles.emptyText}>
                  Search for a friend by exact username and send a request to start chatting!
                </Text>
              </View>
            )
          }
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isLoadingChats && hasLoadedChats}
              onRefresh={() => {
                loadConversations();
                loadRequests();
              }}
              tintColor={palette.accent}
              colors={[palette.accent]}
              progressBackgroundColor={palette.surface}
            />
          }
        />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={isLoadingRequests}
              onRefresh={loadRequests}
              tintColor={palette.accent}
              colors={[palette.accent]}
              progressBackgroundColor={palette.surface}
            />
          }
        >
          {/* Incoming Requests */}
          <View style={{ marginTop: 14 }}>
            <Text style={styles.sectionHeaderTitle}>
              Incoming Requests ({incomingRequests.length})
            </Text>
            {incomingRequests.length === 0 ? (
              <Text style={styles.emptySectionText}>No pending incoming requests.</Text>
            ) : (
              incomingRequests.map((req) => (
                <View key={req.id || req._id} style={styles.requestCard}>
                  <Avatar name={req.sender?.username || "User"} uri={req.sender?.avatar} size={46} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.requestSenderName}>{req.sender?.username || "User"}</Text>
                    <Text style={styles.requestSenderEmail}>{req.sender?.email}</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => handleAcceptRequest(req.id || req._id)}
                      disabled={isActionPending}
                      style={styles.actionBtnPrimary}
                    >
                      <Text style={styles.actionBtnPrimaryText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRejectRequest(req.id || req._id)}
                      disabled={isActionPending}
                      style={styles.actionBtnDanger}
                    >
                      <Text style={styles.actionBtnDangerText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Outgoing Requests */}
          <View style={{ marginTop: 28 }}>
            <Text style={styles.sectionHeaderTitle}>
              Sent Requests ({outgoingRequests.length})
            </Text>
            {outgoingRequests.length === 0 ? (
              <Text style={styles.emptySectionText}>No sent requests pending.</Text>
            ) : (
              outgoingRequests.map((req) => (
                <View key={req.id || req._id} style={styles.requestCard}>
                  <Avatar name={req.receiver?.username || "User"} uri={req.receiver?.avatar} size={46} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.requestSenderName}>{req.receiver?.username || "User"}</Text>
                    <Text style={styles.requestSenderEmail}>Pending approval</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleCancelFriendRequest(req.id || req._id)}
                    disabled={isActionPending}
                    style={styles.actionBtnSecondary}
                  >
                    <Text style={styles.actionBtnSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* Floating Action Button for New Group */}
      {activeTab === "chats" && (
        <Pressable
          onPress={openNewGroupModal}
          style={({ pressed }) => [styles.fabBtn, pressed && { transform: [{ scale: 0.94 }] }]}
          hitSlop={8}
          accessibilityLabel="Create New Group"
        >
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Ionicons name="people" size={22} color="#fff" />
            <View style={styles.fabPlusDot}>
              <Ionicons name="add" size={11} color="#fff" />
            </View>
          </LinearGradient>
        </Pressable>
      )}

      {/* New Group Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={newGroupModalVisible}
        onRequestClose={() => setNewGroupModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setNewGroupModalVisible(false)} />
          <View style={[styles.sheet, { maxHeight: "85%" }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>New Group Chat</Text>
              <Pressable onPress={() => setNewGroupModalVisible(false)} hitSlop={10} style={styles.sheetClose}>
                <Ionicons name="close" size={20} color={palette.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 14 }}>
              <Text style={styles.inputLabel}>Group Name *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="people-outline" size={18} color={palette.textFaint} />
                <TextInput
                  style={styles.input}
                  value={groupTitle}
                  onChangeText={setGroupTitle}
                  placeholder="e.g. Project Discussion"
                  placeholderTextColor={palette.textFaint}
                />
              </View>

              <Text style={styles.inputLabel}>Description (optional)</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="information-circle-outline" size={18} color={palette.textFaint} />
                <TextInput
                  style={styles.input}
                  value={groupDescription}
                  onChangeText={setGroupDescription}
                  placeholder="What is this group about?"
                  placeholderTextColor={palette.textFaint}
                />
              </View>

              <Text style={[styles.inputLabel, { marginTop: 18 }]}>
                Select Friends ({selectedFriendIds.length} selected)
              </Text>
              {friendsList.length === 0 ? (
                <View style={{ paddingVertical: 14 }}>
                  <Text style={{ color: palette.textMuted, fontSize: 13 }}>
                    No accepted friends yet. Send friend requests first to create a group!
                  </Text>
                </View>
              ) : (
                friendsList.map((friend) => {
                  const friendId = idOf(friend);
                  const isSelected = selectedFriendIds.includes(friendId);
                  return (
                    <TouchableOpacity
                      key={friendId}
                      onPress={() => {
                        setSelectedFriendIds((prev) =>
                          isSelected ? prev.filter((id) => id !== friendId) : [...prev, friendId]
                        );
                      }}
                      style={[styles.friendSelectRow, isSelected && styles.friendSelectRowActive]}
                    >
                      <Avatar name={friend.username} uri={friend.avatar} size={40} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.friendSelectName}>{friend.username}</Text>
                        <Text style={styles.friendSelectEmail}>{friend.email}</Text>
                      </View>
                      <Ionicons
                        name={isSelected ? "checkbox" : "square-outline"}
                        size={22}
                        color={isSelected ? palette.accent : palette.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })
              )}

              <Pressable
                onPress={handleCreateGroup}
                disabled={isCreatingGroup || !groupTitle.trim() || selectedFriendIds.length === 0}
                style={{ marginTop: 24, marginBottom: 20 }}
              >
                <LinearGradient
                  colors={gradients.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.saveButton,
                    (isCreatingGroup || !groupTitle.trim() || selectedFriendIds.length === 0) && { opacity: 0.5 },
                  ]}
                >
                  {isCreatingGroup ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveText}>Create Group</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Blocked Accounts Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={blockedModalVisible}
        onRequestClose={() => setBlockedModalVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setBlockedModalVisible(false)} />
          <View style={[styles.sheet, { maxHeight: "75%" }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Blocked Users</Text>
              <Pressable onPress={() => setBlockedModalVisible(false)} hitSlop={10} style={styles.sheetClose}>
                <Ionicons name="close" size={20} color={palette.textMuted} />
              </Pressable>
            </View>

            {isLoadingBlocked ? (
              <View style={{ padding: 30, alignItems: "center" }}>
                <ActivityIndicator color={palette.accent} />
              </View>
            ) : blockedUsers.length === 0 ? (
              <View style={{ padding: 30, alignItems: "center" }}>
                <Ionicons name="shield-checkmark-outline" size={40} color={palette.textFaint} />
                <Text style={{ color: palette.textMuted, marginTop: 10 }}>No blocked users</Text>
              </View>
            ) : (
              <ScrollView style={{ marginTop: 14 }}>
                {blockedUsers.map((b) => {
                  const bId = idOf(b);
                  return (
                    <View key={bId} style={styles.requestCard}>
                      <Avatar name={b.username || "User"} uri={b.avatar} size={42} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.requestSenderName}>{b.username || "User"}</Text>
                        <Text style={styles.requestSenderEmail}>{b.email}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleUnblockUser(bId, b.username || "User")}
                        style={styles.actionBtnSecondary}
                      >
                        <Text style={styles.actionBtnSecondaryText}>Unblock</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Profile sheet */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Your Profile</Text>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={10} style={styles.sheetClose}>
                <Ionicons name="close" size={20} color={palette.textMuted} />
              </Pressable>
            </View>

            <Pressable onPress={handlePickImage} style={styles.sheetAvatar}>
              <Avatar name={username || user?.username || "?"} uri={selectedImage || user?.avatar} size={104} />
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </Pressable>
            <Text style={styles.sheetEmail}>{user?.email}</Text>

            <Text style={styles.inputLabel}>Username</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="at-outline" size={18} color={palette.textFaint} />
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Username"
                placeholderTextColor={palette.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor={palette.accent}
              />
            </View>

            <Pressable onPress={handleUpdateProfile} disabled={isSavingProfile} style={{ marginTop: 20 }}>
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.saveButton, isSavingProfile && { opacity: 0.6 }]}
              >
                {isSavingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save changes</Text>}
              </LinearGradient>
            </Pressable>

            {/* Blocked Accounts Button */}
            <Pressable
              onPress={() => {
                setModalVisible(false);
                openBlockedAccountsModal();
              }}
              style={({ pressed }) => [styles.billingButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="ban-outline" size={18} color={palette.danger} />
              <Text style={[styles.billingText, { color: palette.danger }]}>Blocked Users</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setModalVisible(false);
                router.push("/screens/account/BillingScreen");
              }}
              style={({ pressed }) => [styles.billingButton, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="card-outline" size={18} color={palette.text} />
              <Text style={styles.billingText}>Plan & billing</Text>
            </Pressable>

            <Pressable onPress={handleLogout} style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.7 }]}>
              <Ionicons name="log-out-outline" size={18} color={palette.danger} />
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
    marginRight: 8,
  },
  greeting: { color: palette.textMuted, fontSize: 13, fontWeight: "500" },
  title: { color: palette.text, fontSize: 28, fontWeight: "800", letterSpacing: -0.6, marginTop: 1 },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  newGroupBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
  },
  newGroupIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  newGroupBtnText: {
    color: "#A5B4FC",
    fontSize: 12,
    fontWeight: "700",
  },
  financeIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(139, 124, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(139, 124, 255, 0.28)",
  },
  headerAvatarBtn: {
    padding: 2,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },

  fabBtn: {
    position: "absolute",
    bottom: 24,
    right: 20,
    shadowColor: "#6A5CFF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  fabGradient: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  fabPlusDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: palette.bgElevated,
    borderWidth: 1,
    borderColor: palette.border,
  },
  searchInput: { flex: 1, color: palette.text, fontSize: 15, height: "100%" },
  searchSubmitBtn: {
    backgroundColor: palette.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  searchSubmitBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  searchResultBox: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    padding: 12,
  },
  searchResultCard: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchResultName: { color: palette.text, fontSize: 15, fontWeight: "700" },
  searchResultEmail: { color: palette.textMuted, fontSize: 13, marginTop: 2 },

  notFoundRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  notFoundText: { color: palette.danger, fontSize: 15, fontWeight: "700" },
  notFoundSubtext: { color: palette.textMuted, fontSize: 12, marginTop: 4 },

  tabsContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: palette.bgElevated,
    borderRadius: radius.pill,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  tabButtonActive: {
    backgroundColor: palette.surfaceRaised,
  },
  tabButtonText: {
    color: palette.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  tabButtonTextActive: {
    color: palette.text,
    fontWeight: "700",
  },
  tabBadge: {
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },

  listContent: { paddingBottom: 40, flexGrow: 1 },

  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  rowPressed: { backgroundColor: "rgba(255,255,255,0.03)" },
  rowBody: { flex: 1, marginLeft: 14 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowName: { color: palette.text, fontSize: 16, fontWeight: "600" },
  rowNameUnread: { fontWeight: "800" },
  rowTime: { color: palette.textFaint, fontSize: 12 },
  rowBottom: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 8 },
  rowPreview: { flex: 1, color: palette.textMuted, fontSize: 14 },
  rowPreviewUnread: { color: palette.text, fontWeight: "600" },
  youPrefix: { color: palette.textFaint },
  typing: { flex: 1, color: palette.accent, fontSize: 14, fontWeight: "600", fontStyle: "italic" },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.accent },

  groupBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginRight: 6,
  },
  groupBadgeText: {
    color: "#818cf8",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  onlineDot: { position: "absolute", backgroundColor: palette.success, borderWidth: 2.5, borderColor: palette.bg },

  sectionHeaderTitle: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  emptySectionText: {
    color: palette.textFaint,
    fontSize: 14,
    fontStyle: "italic",
    paddingVertical: 8,
  },

  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.bgElevated,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  requestSenderName: { color: palette.text, fontSize: 15, fontWeight: "600" },
  requestSenderEmail: { color: palette.textMuted, fontSize: 12, marginTop: 2 },

  actionBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  actionBtnPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  actionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  actionBtnSecondaryText: { color: palette.textMuted, fontSize: 13, fontWeight: "600" },

  actionBtnDanger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.dangerSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  actionBtnDangerText: { color: palette.danger, fontSize: 13, fontWeight: "700" },

  badgeBlocked: {
    backgroundColor: palette.dangerSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  badgeBlockedText: { color: palette.danger, fontSize: 12, fontWeight: "700" },

  badgeSelf: {
    backgroundColor: palette.surfaceRaised,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  badgeSelfText: { color: palette.textMuted, fontSize: 12, fontWeight: "700" },

  friendSelectRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: palette.bg,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: palette.border,
  },
  friendSelectRowActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  friendSelectName: { color: palette.text, fontSize: 14, fontWeight: "600" },
  friendSelectEmail: { color: palette.textMuted, fontSize: 12, marginTop: 2 },

  empty: { alignItems: "center", paddingHorizontal: 40, paddingTop: 48 },
  emptyIcon: { width: 68, height: 68, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: "700", marginTop: 12 },
  emptyText: { color: palette.textMuted, fontSize: 14, textAlign: "center", marginTop: 6, lineHeight: 20 },

  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(3, 6, 12, 0.7)" },
  sheet: {
    backgroundColor: palette.bgElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: palette.border,
  },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: palette.borderStrong, marginTop: 10 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  sheetTitle: { color: palette.text, fontSize: 20, fontWeight: "800" },
  sheetClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface,
  },
  sheetAvatar: { alignSelf: "center", marginTop: 18 },
  cameraBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6A5CFF",
    borderWidth: 3,
    borderColor: palette.bgElevated,
  },
  sheetEmail: { color: palette.textMuted, fontSize: 14, textAlign: "center", marginTop: 12 },

  inputLabel: { color: palette.textMuted, fontSize: 13, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  input: { flex: 1, color: palette.text, fontSize: 15, height: "100%" },

  saveButton: { height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  billingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    marginTop: 12,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceRaised,
  },
  billingText: { color: palette.text, fontSize: 15, fontWeight: "700" },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    marginTop: 12,
    borderRadius: radius.md,
    backgroundColor: palette.dangerSoft,
  },
  logoutText: { color: palette.danger, fontSize: 15, fontWeight: "700" },
});
