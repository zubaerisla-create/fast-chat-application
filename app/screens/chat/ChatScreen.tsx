import { VoicePlayer } from "@/components/chat/VoicePlayer";
import { useAuth } from "@/context/AuthContext";
import { useCall } from "@/context/CallContext";
import conversationsService from "@/services/conversationsService";
import socketService from "@/services/socketService";
import uploadService from "@/services/uploadService";
import usersService, { UserProfile } from "@/services/usersService";
import { formatChatSeparatorDate, formatMessageFullTimestamp } from "@/utils/dateFormatter";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

// Module-level ref — shared with _layout.tsx so the push notification hook
// can suppress duplicate banners when the user is already in this chat.
export const activeChatIdRef = { current: null as string | null };

interface Message {
  id: string;
  text: string;
  time: string;
  isMe: boolean;
  timestamp?: string;
  fileUrl?: string;
  fileType?: string;
  isRead?: boolean;
  audioDuration?: number;
}

export default function ChatScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user, onlineUsers } = useAuth();
  const { initiateCall } = useCall();
  const params = useLocalSearchParams<{ name: string; userId: string; conversationId: string }>();

  const chatName = params.name || "User";
  const targetUserId = params.userId;
  const initialConversationId = params.conversationId;

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId || null);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [targetUserProfile, setTargetUserProfile] = useState<UserProfile | null>(null);
  const [sharedMedia, setSharedMedia] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"IMAGES" | "FILES">("IMAGES");
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const conversationIdRef = useRef<string | null>(conversationId);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  // ── Scroll new messages into view (inverted list: prepend = scroll to top = bottom visually) ──
  // Only needed for smooth animated scroll when a new message arrives/is sent.
  // The inverted FlatList naturally starts at the bottom — no initial scroll needed.
  useEffect(() => {
    if (messages.length === 0) return;
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [messages.length]);

  const isRecipientOnline =
    (targetUserId && onlineUsers.includes(targetUserId.toString())) ||
    targetUserProfile?.isOnline;

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false, tabBarStyle: { display: "none" } });
  }, [navigation]);

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  // ── Track active chat for push notification suppression ──────────────────
  // This ref lives in _layout.tsx; we reach it via navigation state.
  // Simpler approach: store conversationId in a module-level ref that the hook reads.
  useFocusEffect(
    useCallback(() => {
      // Mark this conversation as "currently open" so the push hook can suppress
      // duplicate in-app banners while the user is already reading this chat.
      activeChatIdRef.current = conversationId;
      return () => {
        activeChatIdRef.current = null;
      };
    }, [conversationId])
  );

  useEffect(() => {
    const initializeChat = async () => {
      try {
        setIsLoading(true);
        setIsInitializing(true);
        let currentConvId = conversationId;
        if (!currentConvId && targetUserId) {
          const conv = await conversationsService.createOrGetConversation(targetUserId);
          currentConvId = conv.id || (conv as any)._id;
          setConversationId(currentConvId);
        }
        if (targetUserId) {
          usersService.getUserProfile(targetUserId).then(profile => {
            setTargetUserProfile(profile);
            if (profile.lastSeen) setLastSeen(profile.lastSeen);
          }).catch(err => console.error("Error loading target profile:", err));
        }
        if (currentConvId) {
          const fetchedMessages = await conversationsService.getMessages(currentConvId);
          const mappedMessages: Message[] = fetchedMessages.map((msg: any) => {
            const timeSource = msg.createdAt || msg.timestamp || new Date().toISOString();
            return {
              id: msg.id || msg._id,
              text: msg.text,
              time: new Date(timeSource).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              isMe: (msg.senderId?._id || msg.senderId)?.toString() === (user?.id || user?._id)?.toString(),
              timestamp: timeSource,
              fileUrl: msg.fileUrl,
              fileType: msg.fileType,
              isRead: msg.isRead,
              audioDuration: msg.audioDuration,
            };
          });
          setMessages(mappedMessages);
        }
      } catch (error) {
        Alert.alert("Error", "Failed to load conversation");
      } finally {
        setIsLoading(false);
        setIsInitializing(false);
      }
    };
    initializeChat();
  }, [user, targetUserId, conversationId]);

  useEffect(() => {
    if (conversationId) socketService.joinConversation(conversationId);
  }, [conversationId]);

  useEffect(() => {
    const unsubscribeMessage = socketService.on("message_received", (data: any) => {
      const incomingMsg = data.message || data;
      const incomingConvId = (incomingMsg.conversationId?._id || incomingMsg.conversationId)?.toString();
      const currentConvId = conversationIdRef.current?.toString();
      if (!incomingConvId || !currentConvId || incomingConvId === currentConvId) {
        const timeSource = incomingMsg.timestamp || incomingMsg.createdAt || new Date().toISOString();
        const mappedMsg: Message = {
          id: incomingMsg.id || incomingMsg._id || Date.now().toString(),
          text: incomingMsg.text,
          time: new Date(timeSource).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isMe: (incomingMsg.senderId?._id || incomingMsg.senderId)?.toString() === (user?.id || user?._id)?.toString(),
          timestamp: timeSource,
          fileUrl: incomingMsg.fileUrl,
          fileType: incomingMsg.fileType,
          isRead: incomingMsg.isRead,
          audioDuration: incomingMsg.audioDuration,
        };
        setMessages(prev => {
          if (mappedMsg.id && prev.some(m => m.id === mappedMsg.id)) return prev;
          return [...prev, mappedMsg];
        });
        // scrollToEnd is handled by the messages.length useEffect above
      }
    });
    return () => { unsubscribeMessage(); };
  }, [user]);

  useEffect(() => {
    const unsubscribeSeen = socketService.on("messages_seen", (data: any) => {
      const currentConvId = conversationIdRef.current?.toString();
      const incomingConvId = data.conversationId?.toString();
      if (!incomingConvId || !currentConvId || incomingConvId === currentConvId) {
        if (data.messageIds && Array.isArray(data.messageIds)) {
          const seenIds = data.messageIds.map((id: any) => id.toString());
          setMessages(prev => prev.map(msg => seenIds.includes(msg.id?.toString()) ? { ...msg, isRead: true } : msg));
        } else {
          setMessages(prev => prev.map(msg => msg.isMe ? { ...msg, isRead: true } : msg));
        }
      }
    });
    return () => { unsubscribeSeen(); };
  }, []);

  useEffect(() => {
    if (!conversationId || messages.length === 0 || !user) return;
    const unreadMessages = messages.filter(msg => !msg.isMe && !msg.isRead && msg.id);
    if (unreadMessages.length === 0) return;
    const unreadMessageIds = unreadMessages.map(msg => msg.id);
    setMessages(prev => prev.map(msg => unreadMessageIds.includes(msg.id) ? { ...msg, isRead: true } : msg));
    conversationsService.markMessagesRead(conversationId).then(markedIds => {
      if (markedIds && markedIds.length > 0) {
        const userId = (user?.id || user?._id) as string;
        socketService.markMessagesSeen(conversationId, markedIds, userId, targetUserId);
      }
    }).catch(err => console.error("Failed to mark messages read:", err));
  }, [messages.length, conversationId, user]);

  useEffect(() => {
    if (contactModalVisible && targetUserId) fetchContactInfo();
  }, [contactModalVisible, targetUserId]);

  const fetchContactInfo = async () => {
    if (!targetUserId) return;
    try {
      setIsLoadingProfile(true);
      const [profile, media] = await Promise.all([
        usersService.getUserProfile(targetUserId),
        conversationId ? conversationsService.getConversationMedia(conversationId) : Promise.resolve([]),
      ]);
      setTargetUserProfile(profile);
      setSharedMedia(media);
    } catch (error) {
      console.error("Error fetching contact info:", error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !conversationId) return;
    try {
      setIsSending(true);
      const tempId = Date.now().toString();
      const newMessage: Message = {
        id: tempId,
        text: messageText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isMe: true,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, newMessage]);
      const currentText = messageText;
      setMessageText("");
      try {
        const sentMsg = await conversationsService.sendMessage(conversationId, currentText);
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: sentMsg.id || (sentMsg as any)._id } : m));
      } catch (error) {
        console.error("Error sending message via API:", error);
      }
      socketService.emit("send_message", { conversationId, message: currentText });
      // scrollToEnd is handled by the messages.length useEffect
    } catch (error) {
      Alert.alert("Error", "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0].uri) await sendFileMessage(result.assets[0].uri, "image");
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleAttachFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*" });
      if (!result.canceled && result.assets[0].uri) await sendFileMessage(result.assets[0].uri, "file");
    } catch (error) {
      Alert.alert("Error", "Failed to pick document");
    }
  };

  const handleAudioCall = () => {
    if (targetUserId) initiateCall(targetUserId, chatName, "audio");
    else Alert.alert("Error", "User information not available for calling.");
  };

  const handleVideoCall = () => {
    if (targetUserId) initiateCall(targetUserId, chatName, "video");
    else Alert.alert("Error", "User information not available for calling.");
  };

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === "granted") {
        if (recording) {
          try { await recording.stopAndUnloadAsync(); } catch (_) {}
          setRecording(null);
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(newRecording);
        setIsRecording(true);
        setRecordingDuration(0);
        recordingTimerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          ])
        ).start();
      } else {
        Alert.alert("Permission Denied", "Please allow microphone access to record audio.");
      }
    } catch (err) {
      console.error("Failed to start recording", err);
      setIsRecording(false);
      setRecording(null);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    const capturedDuration = recordingDuration;
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    setRecordingDuration(0);
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (uri) await sendFileMessage(uri, "audio", capturedDuration);
    } catch (err) {
      console.error("Failed to stop recording", err);
    }
  };

  const sendFileMessage = async (uri: string, type: string, duration?: number) => {
    if (!conversationId) return;
    try {
      setIsSending(true);
      const uploadResult = await uploadService.uploadFile(uri, type);
      if (!uploadResult.success) throw new Error("Upload failed");
      const publicUrl = uploadResult.url;
      const audioDuration = type === "audio" && duration ? duration : undefined;
      const sentMsg = await conversationsService.sendMessage(
        conversationId,
        type === "image" ? "📷 Image" : type === "audio" ? "🎵 Voice Message" : "📄 File",
        publicUrl, type, uploadResult.fileName, undefined, audioDuration
      );
      const newMessage: Message = {
        id: sentMsg.id || (sentMsg as any)._id,
        text: type === "image" ? "📷 Image" : type === "audio" ? "🎵 Voice Message" : "📄 File",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isMe: true,
        timestamp: new Date().toISOString(),
        fileUrl: publicUrl,
        fileType: type,
        audioDuration,
      };
      setMessages(prev => [...prev, newMessage]);
      socketService.emit("send_message", {
        conversationId,
        message: type === "image" ? "📷 Image" : type === "audio" ? "🎵 Voice Message" : "📄 File",
        fileUrl: publicUrl, fileType: type, senderId: user?.id || user?._id, audioDuration,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to upload and send file. Please check your internet connection.");
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isSelected = selectedMessageId === item.id;
    const currentTimestamp = item.timestamp;
    // In inverted list data is reversed: index+1 is the older (previous) message
    const prevTimestamp = index < messages.length - 1 ? messages[messages.length - 2 - index]?.timestamp : undefined;
    // Show date separator when this message is on a different day than the one before it
    // "before it" in chronological order = index+1 in the reversed array
    const olderItem = messages[messages.length - 2 - index];
    const showDateSeparator =
      index === messages.length - 1 || // oldest message always shows separator
      (currentTimestamp !== undefined &&
        olderItem?.timestamp !== undefined &&
        new Date(currentTimestamp).toDateString() !== new Date(olderItem.timestamp).toDateString());

    const isImageOnly = item.fileType === "image" && item.fileUrl;
    const isAudio = item.fileType === "audio";

    return (
      <View style={{ width: "100%" }}>
        {showDateSeparator && (
          <View style={styles.dateContainer}>
            <LinearGradient
              colors={["#1E293B", "#0F172A"]}
              style={styles.datePill}
            >
              <Text style={styles.dateText}>{formatChatSeparatorDate(item.timestamp)}</Text>
            </LinearGradient>
          </View>
        )}

        {isSelected && (
          <View style={[styles.bubbleTimestampContainer, item.isMe ? { alignSelf: "flex-end", marginRight: 12 } : { alignSelf: "flex-start", marginLeft: 52 }]}>
            <Text style={styles.bubbleTimestampText}>{formatMessageFullTimestamp(item.timestamp)}</Text>
          </View>
        )}

        <View style={[styles.messageContainer, item.isMe ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}>
          {!item.isMe && (
            <View style={styles.avatar}>
              {targetUserProfile?.avatar ? (
                <Image source={{ uri: targetUserProfile.avatar }} style={styles.avatarImage} />
              ) : (
                <LinearGradient colors={["#6366F1", "#8B5CF6"]} style={styles.avatarGradient}>
                  <Text style={styles.avatarText}>{chatName.charAt(0).toUpperCase()}</Text>
                </LinearGradient>
              )}
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedMessageId(prev => prev === item.id ? null : item.id)}
            style={[styles.bubble, item.isMe ? styles.myBubble : styles.theirBubble, isImageOnly && styles.imageBubble]}
          >
            {item.isMe ? (
              <LinearGradient
                colors={["#7C3AED", "#6D28D9"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.bubbleInner, isImageOnly && { padding: 0 }]}
              >
                {item.fileUrl && (
                  isAudio ? (
                    <VoicePlayer url={item.fileUrl} isMe={item.isMe} audioDuration={item.audioDuration} />
                  ) : (
                    <TouchableOpacity onPress={() => setSelectedPreviewImage(item.fileUrl || null)}>
                      <Image source={{ uri: item.fileUrl }} style={styles.messageImage} resizeMode="cover" />
                    </TouchableOpacity>
                  )
                )}
                {!isAudio && (
                  <Text style={styles.myText}>{item.text}</Text>
                )}
                <View style={styles.timeRow}>
                  <Text style={styles.myTimeText}>{item.time}</Text>
                  <Ionicons
                    name={item.isRead ? "checkmark-done" : "checkmark"}
                    size={14}
                    color={item.isRead ? "#A5F3FC" : "rgba(255,255,255,0.5)"}
                    style={{ marginLeft: 3 }}
                  />
                </View>
              </LinearGradient>
            ) : (
              <View style={[styles.bubbleInner, isImageOnly && { padding: 0 }]}>
                {item.fileUrl && (
                  isAudio ? (
                    <VoicePlayer url={item.fileUrl} isMe={item.isMe} audioDuration={item.audioDuration} />
                  ) : (
                    <TouchableOpacity onPress={() => setSelectedPreviewImage(item.fileUrl || null)}>
                      <Image source={{ uri: item.fileUrl }} style={styles.messageImage} resizeMode="cover" />
                    </TouchableOpacity>
                  )
                )}
                {!isAudio && (
                  <Text style={styles.theirText}>{item.text}</Text>
                )}
                <View style={styles.timeRow}>
                  <Text style={styles.theirTimeText}>{item.time}</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <LinearGradient colors={["#0F172A", "#1E1B4B"]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={{ color: "#64748B", marginTop: 12, fontSize: 14 }}>Loading messages...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#0F172A", "#0D1117"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

          {/* ── Header ── */}
          <Animated.View style={[styles.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
            <LinearGradient
              colors={["#1A1F35", "#141929"]}
              style={styles.headerGradient}
            >
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={26} color="#E2E8F0" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.headerUser} onPress={() => setContactModalVisible(true)} activeOpacity={0.8}>
                <View style={styles.headerAvatarWrapper}>
                  {targetUserProfile?.avatar ? (
                    <Image source={{ uri: targetUserProfile.avatar }} style={styles.headerAvatarImage} />
                  ) : (
                    <LinearGradient colors={["#6366F1", "#8B5CF6"]} style={styles.headerAvatarGradient}>
                      <Text style={styles.headerAvatarText}>{chatName.charAt(0).toUpperCase()}</Text>
                    </LinearGradient>
                  )}
                  {isRecipientOnline && <View style={styles.onlineBadge} />}
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.headerName}>{chatName}</Text>
                  <Text style={[styles.status, isRecipientOnline && styles.onlineStatus]}>
                    {isRecipientOnline
                      ? "● Online"
                      : lastSeen
                      ? `Last seen ${new Date(lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "Offline"}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.headerActions}>
                <TouchableOpacity onPress={handleAudioCall} style={styles.iconButton}>
                  <LinearGradient colors={["#1E293B", "#0F172A"]} style={styles.iconButtonGradient}>
                    <Ionicons name="call-outline" size={20} color="#A78BFA" />
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleVideoCall} style={styles.iconButton}>
                  <LinearGradient colors={["#1E293B", "#0F172A"]} style={styles.iconButtonGradient}>
                    <Ionicons name="videocam-outline" size={20} color="#A78BFA" />
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => setContactModalVisible(true)}>
                  <LinearGradient colors={["#1E293B", "#0F172A"]} style={styles.iconButtonGradient}>
                    <Ionicons name="ellipsis-vertical" size={20} color="#A78BFA" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ── Messages ── */}
          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListRef}
              data={[...messages].reverse()}
              renderItem={renderMessage}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesContent}
              initialNumToRender={20}
              maxToRenderPerBatch={10}
              windowSize={10}
              removeClippedSubviews={true}
              inverted
            />

            {/* ── Input Bar ── */}
            <View style={styles.inputWrapper}>
              <LinearGradient colors={["#1A1F35", "#141929"]} style={styles.inputContainer}>
                <TouchableOpacity style={styles.attachButton} onPress={handleAttachImage}>
                  <Ionicons name="image-outline" size={22} color="#6366F1" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachButton} onPress={handleAttachFile}>
                  <Ionicons name="attach" size={22} color="#6366F1" />
                </TouchableOpacity>

                {isRecording ? (
                  <View style={styles.recordingIndicator}>
                    <Animated.View style={[styles.recordingDot, { opacity: pulseAnim }]} />
                    <Text style={styles.recordingTime}>
                      {`${String(Math.floor(recordingDuration / 60)).padStart(2, "0")}:${String(recordingDuration % 60).padStart(2, "0")}`}
                    </Text>
                    <View style={styles.recordingBars}>
                      {[4, 10, 14, 7, 12, 6, 16, 5, 11, 8, 14, 6, 10, 4, 13, 9, 7, 11].map((h, i) => (
                        <View key={i} style={[styles.recordingBar, { height: h }]} />
                      ))}
                    </View>
                  </View>
                ) : (
                  <TextInput
                    style={styles.input}
                    placeholder={`Message ${chatName}...`}
                    placeholderTextColor="#475569"
                    value={messageText}
                    onChangeText={setMessageText}
                    multiline
                    maxLength={1000}
                    editable={!isSending}
                    textAlignVertical="center"
                  />
                )}

                {messageText.trim() ? (
                  <TouchableOpacity
                    style={[styles.sendButton, (isSending || isInitializing) && { opacity: 0.5 }]}
                    onPress={handleSendMessage}
                    disabled={isSending || isInitializing}
                  >
                    <LinearGradient colors={["#7C3AED", "#6D28D9"]} style={styles.sendButtonGradient}>
                      {isSending || isInitializing ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <Ionicons name="send" size={18} color="white" />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.micButton, isRecording && styles.activeMicButton]}
                    onLongPress={startRecording}
                    onPressOut={stopRecording}
                    delayLongPress={200}
                  >
                    <Ionicons
                      name={isRecording ? "radio-button-on" : "mic-outline"}
                      size={22}
                      color={isRecording ? "#EF4444" : "#6366F1"}
                    />
                  </TouchableOpacity>
                )}
              </LinearGradient>
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* ── Contact Info Modal ── */}
        <Modal animationType="slide" transparent visible={contactModalVisible} onRequestClose={() => setContactModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <LinearGradient colors={["#1A1F35", "#0F172A"]} style={styles.modalContent}>
              <View style={styles.modalHandle} />

              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Contact Info</Text>
                <TouchableOpacity onPress={() => setContactModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {isLoadingProfile ? (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                  <ActivityIndicator size="large" color="#8B5CF6" />
                  <Text style={{ color: "#94A3B8", marginTop: 10 }}>Loading profile...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.profileContainer}>
                    <View style={styles.profileAvatarWrapper}>
                      {targetUserProfile?.avatar ? (
                        <Image source={{ uri: targetUserProfile.avatar }} style={styles.profileAvatarImage} />
                      ) : (
                        <LinearGradient colors={["#6366F1", "#8B5CF6"]} style={styles.profileAvatarGradient}>
                          <Text style={styles.profileAvatarText}>{chatName.charAt(0).toUpperCase()}</Text>
                        </LinearGradient>
                      )}
                      {isRecipientOnline && <View style={styles.profileOnlineBadge} />}
                    </View>
                    <Text style={styles.contactName}>{targetUserProfile?.username || chatName}</Text>
                    <Text style={styles.contactEmail}>{targetUserProfile?.email || "No email available"}</Text>
                    <View style={styles.profileActions}>
                      <TouchableOpacity style={styles.profileActionBtn} onPress={handleAudioCall}>
                        <LinearGradient colors={["#1E293B", "#0F172A"]} style={styles.profileActionGradient}>
                          <Ionicons name="call-outline" size={22} color="#A78BFA" />
                        </LinearGradient>
                        <Text style={styles.profileActionLabel}>Audio</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.profileActionBtn} onPress={handleVideoCall}>
                        <LinearGradient colors={["#1E293B", "#0F172A"]} style={styles.profileActionGradient}>
                          <Ionicons name="videocam-outline" size={22} color="#A78BFA" />
                        </LinearGradient>
                        <Text style={styles.profileActionLabel}>Video</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.infoCard}>
                    <Text style={styles.infoLabel}>MEMBER SINCE</Text>
                    <Text style={styles.infoValue}>
                      {targetUserProfile?.createdAt
                        ? new Date(targetUserProfile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
                        : "Recently joined"}
                    </Text>
                  </View>

                  <View style={styles.sharedContentHeader}>
                    <Text style={styles.sectionTitle}>SHARED CONTENT</Text>
                    <View style={styles.tabButtons}>
                      <TouchableOpacity style={[styles.tabButton, activeTab === "IMAGES" && styles.activeTabButton]} onPress={() => setActiveTab("IMAGES")}>
                        <Text style={activeTab === "IMAGES" ? styles.activeTabText : styles.tabText}>Images</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.tabButton, activeTab === "FILES" && styles.activeTabButton]} onPress={() => setActiveTab("FILES")}>
                        <Text style={activeTab === "FILES" ? styles.activeTabText : styles.tabText}>Files</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {activeTab === "IMAGES" ? (
                    <View style={{ flex: 1 }}>
                      {sharedMedia.filter(m => m.fileType === "image").length > 0 ? (
                        <FlatList
                          key="images-grid"
                          data={sharedMedia.filter(m => m.fileType === "image")}
                          numColumns={3}
                          keyExtractor={item => item._id}
                          renderItem={({ item }) => (
                            <TouchableOpacity onPress={() => setSelectedPreviewImage(item.fileUrl || null)} style={{ margin: 3 }}>
                              <Image source={{ uri: item.fileUrl }} style={{ width: (width - 60) / 3, height: (width - 60) / 3, borderRadius: 10 }} />
                            </TouchableOpacity>
                          )}
                          contentContainerStyle={{ paddingBottom: 20 }}
                        />
                      ) : (
                        <View style={styles.noContent}>
                          <Ionicons name="image-outline" size={48} color="#334155" />
                          <Text style={styles.noContentText}>No shared images</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={{ flex: 1 }}>
                      {sharedMedia.filter(m => m.fileType === "file").length > 0 ? (
                        <FlatList
                          key="files-list"
                          data={sharedMedia.filter(m => m.fileType === "file")}
                          keyExtractor={item => item._id}
                          renderItem={({ item }) => (
                            <View style={styles.fileItem}>
                              <View style={styles.fileIcon}>
                                <Ionicons name="document-text-outline" size={22} color="#6366F1" />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: "white", fontSize: 14 }} numberOfLines={1}>{item.fileName || "Unnamed File"}</Text>
                                <Text style={{ color: "#64748B", fontSize: 12 }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                              </View>
                            </View>
                          )}
                          contentContainerStyle={{ paddingBottom: 20 }}
                        />
                      ) : (
                        <View style={styles.noContent}>
                          <Ionicons name="folder-open-outline" size={48} color="#334155" />
                          <Text style={styles.noContentText}>No shared files</Text>
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}
            </LinearGradient>
          </View>
        </Modal>

        {/* ── Full Screen Image Preview ── */}
        <Modal visible={!!selectedPreviewImage} transparent onRequestClose={() => setSelectedPreviewImage(null)} animationType="fade">
          <View style={styles.previewOverlay}>
            <TouchableOpacity style={styles.closePreview} onPress={() => setSelectedPreviewImage(null)}>
              <Ionicons name="close" size={32} color="white" />
            </TouchableOpacity>
            <ScrollView maximumZoomScale={3} minimumZoomScale={1} contentContainerStyle={styles.previewContainer}>
              {selectedPreviewImage && (
                <Image key={selectedPreviewImage} source={{ uri: selectedPreviewImage }} style={{ width, height }} resizeMode="contain" />
              )}
            </ScrollView>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  /* ── Header ── */
  header: { zIndex: 10 },
  headerGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(99,102,241,0.15)",
  },
  backButton: { padding: 6, marginRight: 2 },
  headerUser: { flex: 1, flexDirection: "row", alignItems: "center" },
  headerAvatarWrapper: { position: "relative" },
  headerAvatarImage: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: "#6366F1" },
  headerAvatarGradient: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center" },
  headerAvatarText: { color: "white", fontSize: 18, fontWeight: "700" },
  onlineBadge: {
    position: "absolute", bottom: 1, right: 1,
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: "#10B981", borderWidth: 2, borderColor: "#141929",
  },
  headerName: { color: "#F1F5F9", fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },
  status: { color: "#64748B", fontSize: 12, marginTop: 1 },
  onlineStatus: { color: "#10B981", fontWeight: "600" },
  headerActions: { flexDirection: "row", gap: 6 },
  iconButton: {},
  iconButtonGradient: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(99,102,241,0.2)",
  },

  /* ── Date Separator ── */
  dateContainer: { alignItems: "center", marginVertical: 18 },
  datePill: {
    paddingHorizontal: 16, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(99,102,241,0.2)",
  },
  dateText: { color: "#94A3B8", fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },

  /* ── Timestamp on tap ── */
  bubbleTimestampContainer: { marginBottom: 4, marginTop: 2 },
  bubbleTimestampText: { color: "#64748B", fontSize: 11, fontWeight: "600" },

  /* ── Messages ── */
  messagesList: { flex: 1 },
  messagesContent: { paddingHorizontal: 14, paddingVertical: 12, paddingBottom: 8 },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 6,
    alignItems: "flex-end",
    width: "100%",
  },

  /* ── Avatar ── */
  avatar: { width: 34, height: 34, borderRadius: 17, marginRight: 8, overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%", borderRadius: 17 },
  avatarGradient: { width: "100%", height: "100%", borderRadius: 17, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "white", fontSize: 14, fontWeight: "700" },

  /* ── Bubbles ── */
  bubble: { maxWidth: "78%", borderRadius: 20, overflow: "hidden" },
  imageBubble: { borderRadius: 16 },
  myBubble: { borderBottomRightRadius: 4 },
  theirBubble: { borderBottomLeftRadius: 4, backgroundColor: "#1E293B", borderWidth: 1, borderColor: "rgba(99,102,241,0.12)" },
  bubbleInner: { paddingHorizontal: 14, paddingVertical: 10 },
  myText: { color: "#F1F5F9", fontSize: 15, lineHeight: 22 },
  theirText: { color: "#CBD5E1", fontSize: 15, lineHeight: 22 },
  messageImage: { width: 220, height: 220, borderRadius: 14, marginBottom: 6 },
  timeRow: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end", marginTop: 4 },
  myTimeText: { fontSize: 11, color: "rgba(255,255,255,0.55)" },
  theirTimeText: { fontSize: 11, color: "#475569" },

  /* ── Input ── */
  inputWrapper: { paddingHorizontal: 12, paddingBottom: Platform.OS === "ios" ? 10 : 14, paddingTop: 8 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 28,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 52,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.2)",
  },
  attachButton: { padding: 8, marginBottom: 2 },
  input: {
    flex: 1,
    color: "#E2E8F0",
    fontSize: 15,
    maxHeight: 120,
    minHeight: 40,
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    paddingHorizontal: 6,
  },
  sendButton: { marginBottom: 2 },
  sendButtonGradient: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  micButton: { padding: 8, marginBottom: 2 },
  activeMicButton: { backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 20 },

  /* ── Recording ── */
  recordingIndicator: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, minHeight: 40 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444", marginRight: 8 },
  recordingTime: { color: "#EF4444", fontSize: 14, fontWeight: "700", minWidth: 40, marginRight: 10 },
  recordingBars: { flex: 1, flexDirection: "row", alignItems: "center", gap: 3 },
  recordingBar: { width: 3, borderRadius: 2, backgroundColor: "#EF4444", opacity: 0.75 },

  /* ── Modal ── */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 28, borderTopRightRadius: 28, minHeight: "88%", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#334155", alignSelf: "center", marginBottom: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#F1F5F9" },
  modalCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#1E293B", justifyContent: "center", alignItems: "center" },

  /* ── Profile in modal ── */
  profileContainer: { alignItems: "center", marginBottom: 24 },
  profileAvatarWrapper: { position: "relative", marginBottom: 14 },
  profileAvatarImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: "#6366F1" },
  profileAvatarGradient: { width: 100, height: 100, borderRadius: 50, justifyContent: "center", alignItems: "center" },
  profileAvatarText: { fontSize: 42, fontWeight: "700", color: "white" },
  profileOnlineBadge: {
    position: "absolute", bottom: 4, right: 4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#10B981", borderWidth: 3, borderColor: "#1A1F35",
  },
  contactName: { fontSize: 22, fontWeight: "700", color: "white", marginBottom: 4 },
  contactEmail: { fontSize: 14, color: "#64748B", marginBottom: 20 },
  profileActions: { flexDirection: "row", gap: 20 },
  profileActionBtn: { alignItems: "center", gap: 6 },
  profileActionGradient: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(99,102,241,0.25)" },
  profileActionLabel: { color: "#94A3B8", fontSize: 12, fontWeight: "600" },

  /* ── Info card ── */
  infoCard: { backgroundColor: "#1E293B", borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "rgba(99,102,241,0.1)" },
  infoLabel: { color: "#64748B", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  infoValue: { color: "#E2E8F0", fontSize: 15 },

  /* ── Shared content ── */
  sharedContentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { color: "#64748B", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  tabButtons: { flexDirection: "row", backgroundColor: "#1E293B", borderRadius: 12, padding: 3 },
  tabButton: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 10 },
  activeTabButton: { backgroundColor: "#6366F1" },
  tabText: { color: "#64748B", fontWeight: "600", fontSize: 13 },
  activeTabText: { color: "white", fontWeight: "700", fontSize: 13 },
  noContent: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40 },
  noContentText: { color: "#475569", marginTop: 12, fontSize: 15 },
  fileItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#1E293B", borderRadius: 14, padding: 14, marginBottom: 10, gap: 12 },
  fileIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(99,102,241,0.15)", justifyContent: "center", alignItems: "center" },

  /* ── Image preview ── */
  previewOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  closePreview: { position: "absolute", top: 50, right: 20, zIndex: 10, padding: 10, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20 },
  previewContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center" },

  /* ── Loading ── */
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
});
