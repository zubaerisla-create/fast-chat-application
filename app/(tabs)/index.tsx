import { avatarGradient, gradients, palette, radius } from "@/constants/design";
import { useAuth } from "@/context/AuthContext";
import { User } from "@/services/authService";
import conversationsService from "@/services/conversationsService";
import socketService from "@/services/socketService";
import usersService from "@/services/usersService";
import { formatConversationTime } from "@/utils/dateFormatter";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const idOf = (x: any): string => (x?._id || x?.id || "").toString();

/**
 * Round avatar: photo when available, otherwise initials on a stable gradient.
 */
function Avatar({ name, uri, size = 52, online }: { name: string; uri?: string; size?: number; online?: boolean }) {
  const colors = avatarGradient(name);
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette.surface }} />
      ) : (
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: "#fff", fontSize: size * 0.38, fontWeight: "700" }}>
            {(name || "?").charAt(0).toUpperCase()}
          </Text>
        </LinearGradient>
      )}
      {online && (
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
  const myId = idOf(user);

  const [modalVisible, setModalVisible] = useState(false);
  const [username, setUsername] = useState(user?.username || "");
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [userConversations, setUserConversations] = useState<any[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [hasLoadedChats, setHasLoadedChats] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [typingConversations, setTypingConversations] = useState<{ [conversationId: string]: boolean }>({});
  const searchRef = useRef<TextInput>(null);

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

      const exists = userConversationsRef.current.some((conv) => idOf(conv) === convId);

      if (!exists) {
        // If it's a new conversation from a new user, reload the list to get participant details
        loadConversations();
      } else {
        // Otherwise, update the last message and move the conversation to the top
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

    return () => unsubscribe();
  }, []);

  // Real-time: update conversation list typing status
  useEffect(() => {
    const unsubscribeTyping = socketService.on("user_typing", (data: any) => {
      const convId = data.conversationId?.toString();
      if (convId) {
        setTypingConversations((prev) => ({ ...prev, [convId]: true }));
      }
    });

    const unsubscribeStoppedTyping = socketService.on("user_stopped_typing", (data: any) => {
      const convId = data.conversationId?.toString();
      if (convId) {
        setTypingConversations((prev) => ({ ...prev, [convId]: false }));
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
      setHasLoadedChats(true);
    }
  };

  const loadUsers = async () => {
    try {
      const users = await usersService.getAllUsers();
      setAllUsers(users);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const isOnline = useCallback(
    (person: any) => {
      const pid = idOf(person);
      return (pid && onlineUsers.includes(pid)) || !!person?.isOnline;
    },
    [onlineUsers]
  );

  const openChat = (target: any, conversationId = "") => {
    const targetId = idOf(target);
    // Safety fallback: do not navigate before auth is ready, to undefined, or to ourselves
    if (!user || !targetId || targetId === myId) return;
    if (searchText) setSearchText("");
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
      setSelectedImage(null); // Clear local selection
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const otherParticipant = (conv: any) => conv.participants?.find((p: any) => idOf(p) !== myId);

  // ── Search: matching conversations + people you haven't chatted with yet ──
  const query = searchText.trim().toLowerCase();
  const matches = (u: any) =>
    !!u && (u.username?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query));

  const filteredConversations = useMemo(
    () => (query ? userConversations.filter((c) => matches(otherParticipant(c))) : userConversations),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, userConversations, myId]
  );

  const peopleResults = useMemo(() => {
    if (!query) return [];
    const chattedWith = new Set(userConversations.map((c) => idOf(otherParticipant(c))));
    return allUsers.filter((u) => matches(u) && !chattedWith.has(idOf(u)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, allUsers, userConversations, myId]);

  // People strip: online first, then everyone else
  const people = useMemo(
    () => [...allUsers].sort((a, b) => Number(isOnline(b)) - Number(isOnline(a))).slice(0, 20),
    [allUsers, isOnline]
  );
  const onlineCount = allUsers.filter(isOnline).length;

  const renderConversation = ({ item }: { item: any }) => {
    const other = otherParticipant(item) || { username: item.participantName || "User" };
    const name = other.username || "User";
    const convId = idOf(item);
    const isTyping = typingConversations[convId];
    const last = item.lastMessage;
    const fromMe = last && typeof last === "object" && idOf(last.senderId) === myId;
    const unread = last && typeof last === "object" && !fromMe && last.isRead === false;

    return (
      <Pressable
        onPress={() => openChat(other, convId)}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        android_ripple={{ color: "rgba(255,255,255,0.04)" }}
      >
        <Avatar name={name} uri={other.avatar} online={isOnline(other)} />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={[styles.rowName, unread && styles.rowNameUnread]} numberOfLines={1}>
              {name}
            </Text>
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
            {unread ? <View style={styles.unreadDot} /> : fromMe && last.isRead ? (
              <Ionicons name="checkmark-done" size={16} color={palette.accent} />
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  const renderPerson = (person: any) => (
    <Pressable
      key={idOf(person)}
      onPress={() => openChat(person)}
      style={({ pressed }) => [styles.personRow, pressed && styles.rowPressed]}
    >
      <Avatar name={person.username} uri={person.avatar} size={44} online={isOnline(person)} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={styles.rowName} numberOfLines={1}>
          {person.username}
        </Text>
        <Text style={styles.rowPreview} numberOfLines={1}>
          {person.email}
        </Text>
      </View>
      <View style={styles.messageChip}>
        <Ionicons name="chatbubble-outline" size={14} color={palette.accent} />
        <Text style={styles.messageChipText}>Message</Text>
      </View>
    </Pressable>
  );

  const listHeader = (
    <View>
      {!query && people.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>People</Text>
            {onlineCount > 0 && (
              <View style={styles.onlinePill}>
                <View style={styles.onlinePillDot} />
                <Text style={styles.onlinePillText}>{onlineCount} online</Text>
              </View>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleStrip}>
            {people.map((p) => (
              <Pressable key={idOf(p)} onPress={() => openChat(p)} style={styles.personChip}>
                <Avatar name={p.username} uri={p.avatar} size={58} online={isOnline(p)} />
                <Text style={styles.personChipName} numberOfLines={1}>
                  {p.username}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {query && peopleResults.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.sectionPad]}>Start a new chat</Text>
          {peopleResults.map(renderPerson)}
        </View>
      )}

      {(filteredConversations.length > 0 || !query) && (
        <Text style={[styles.sectionTitle, styles.sectionPad, { marginTop: 18 }]}>
          {query ? "Conversations" : "Recent chats"}
        </Text>
      )}
    </View>
  );

  const listEmpty = !hasLoadedChats ? (
    <View style={styles.empty}>
      <ActivityIndicator color={palette.accent} />
    </View>
  ) : query ? (
    peopleResults.length === 0 ? (
      <View style={styles.empty}>
        <Ionicons name="search" size={40} color={palette.textFaint} />
        <Text style={styles.emptyTitle}>No results</Text>
        <Text style={styles.emptyText}>Nobody matches “{searchText.trim()}”.</Text>
      </View>
    ) : null
  ) : (
    <View style={styles.empty}>
      <LinearGradient colors={gradients.primary} style={styles.emptyIcon}>
        <Ionicons name="chatbubbles" size={30} color="#fff" />
      </LinearGradient>
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptyText}>Find someone by name or email and say hello.</Text>
      <Pressable onPress={() => searchRef.current?.focus()} style={styles.emptyButton}>
        <Ionicons name="search" size={16} color={palette.text} />
        <Text style={styles.emptyButtonText}>Find people</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={palette.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.username || "there"}</Text>
          <Text style={styles.title}>Messages</Text>
        </View>
        <Pressable
          onPress={() => {
            setUsername(user?.username || "");
            setModalVisible(true);
          }}
          hitSlop={8}
        >
          <Avatar name={user?.username || "?"} uri={user?.avatar} size={44} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={palette.textFaint} />
        <TextInput
          ref={searchRef}
          style={styles.searchInput}
          placeholder="Search people or chats"
          placeholderTextColor={palette.textFaint}
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={palette.accent}
          returnKeyType="search"
        />
        {searchText ? (
          <Pressable onPress={() => setSearchText("")} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={palette.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={filteredConversations}
        renderItem={renderConversation}
        keyExtractor={(item, index) => `${idOf(item) || index}`}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isLoadingChats && hasLoadedChats}
            onRefresh={() => {
              loadUsers();
              loadConversations();
            }}
            tintColor={palette.accent}
            colors={[palette.accent]}
            progressBackgroundColor={palette.surface}
          />
        }
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
      />

      {/* Profile sheet */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Your profile</Text>
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

            <Pressable onPress={handleUpdateProfile} disabled={isSavingProfile} style={{ marginTop: 22 }}>
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.saveButton, isSavingProfile && { opacity: 0.6 }]}
              >
                {isSavingProfile ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save changes</Text>}
              </LinearGradient>
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  greeting: { color: palette.textMuted, fontSize: 14, fontWeight: "500" },
  title: { color: palette.text, fontSize: 32, fontWeight: "800", letterSpacing: -0.6, marginTop: 2 },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: palette.bgElevated,
    borderWidth: 1,
    borderColor: palette.border,
  },
  searchInput: { flex: 1, color: palette.text, fontSize: 15, height: "100%" },

  listContent: { paddingBottom: 40, flexGrow: 1 },

  section: { marginTop: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 },
  sectionTitle: { color: palette.textMuted, fontSize: 13, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  sectionPad: { paddingHorizontal: 20, marginBottom: 6 },

  onlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(52, 211, 153, 0.1)",
  },
  onlinePillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.success },
  onlinePillText: { color: palette.success, fontSize: 12, fontWeight: "600" },

  peopleStrip: { paddingHorizontal: 14, paddingTop: 14, gap: 4 },
  personChip: { width: 76, alignItems: "center" },
  personChipName: { color: palette.textMuted, fontSize: 12, marginTop: 8, maxWidth: 70 },

  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  rowPressed: { backgroundColor: "rgba(255,255,255,0.03)" },
  rowBody: { flex: 1, marginLeft: 14 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowName: { flex: 1, color: palette.text, fontSize: 16, fontWeight: "600", marginRight: 10 },
  rowNameUnread: { fontWeight: "800" },
  rowTime: { color: palette.textFaint, fontSize: 12 },
  rowBottom: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 8 },
  rowPreview: { flex: 1, color: palette.textMuted, fontSize: 14 },
  rowPreviewUnread: { color: palette.text, fontWeight: "600" },
  youPrefix: { color: palette.textFaint },
  typing: { flex: 1, color: palette.accent, fontSize: 14, fontWeight: "600", fontStyle: "italic" },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.accent },

  onlineDot: { position: "absolute", backgroundColor: palette.success, borderWidth: 2.5, borderColor: palette.bg },

  personRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10 },
  messageChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: palette.accentSoft,
  },
  messageChipText: { color: palette.accent, fontSize: 13, fontWeight: "600" },

  empty: { alignItems: "center", paddingHorizontal: 40, paddingTop: 48 },
  emptyIcon: { width: 68, height: 68, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: "700", marginTop: 12 },
  emptyText: { color: palette.textMuted, fontSize: 14, textAlign: "center", marginTop: 6, lineHeight: 20 },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  emptyButtonText: { color: palette.text, fontSize: 14, fontWeight: "600" },

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

  inputLabel: { color: palette.textMuted, fontSize: 13, fontWeight: "600", marginTop: 22, marginBottom: 8 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 54,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  input: { flex: 1, color: palette.text, fontSize: 16, height: "100%" },

  saveButton: { height: 54, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "700" },
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
