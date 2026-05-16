import { VoicePlayer } from "@/components/chat/VoicePlayer";
import { useAuth } from "@/context/AuthContext";
import { useCall } from "@/context/CallContext";
import conversationsService from "@/services/conversationsService";
import socketService from "@/services/socketService";
import uploadService from "@/services/uploadService";
import usersService, { UserProfile } from "@/services/usersService";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

interface Message {
  id: string;
  text: string;
  time: string;
  isMe: boolean;
  timestamp?: string;
  fileUrl?: string;
  fileType?: string;
  isRead?: boolean;
}

export default function ChatScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user, onlineUsers } = useAuth();
  const { initiateCall } = useCall();
  const params = useLocalSearchParams<{ name: string; userId: string; conversationId: string }>();

  // Get params from route
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
  // Keep ref in sync whenever state changes
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [targetUserProfile, setTargetUserProfile] = useState<UserProfile | null>(null);
  const [sharedMedia, setSharedMedia] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"IMAGES" | "FILES">("IMAGES");
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  // Ref to always hold the latest conversationId — fixes stale closure in socket listener
  const conversationIdRef = useRef<string | null>(conversationId);

  // Derive online status from global onlineUsers array + fallback to profile data
  const isRecipientOnline = (targetUserId && onlineUsers.includes(targetUserId.toString())) || targetUserProfile?.isOnline;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
      tabBarStyle: { display: "none" },
    });
  }, [navigation]);

  // Initialize conversation and load messages
  useEffect(() => {
    const initializeChat = async () => {
      console.log("Current User ID in App:", user?.id || user?._id);
      try {
        setIsLoading(true);
        setIsInitializing(true);
        let currentConvId = conversationId;

        // If we don't have a conversationId but have a userId, get/create one
        if (!currentConvId && targetUserId) {
          console.log("Initializing new conversation with userId:", targetUserId);
          const conv = await conversationsService.createOrGetConversation(targetUserId);
          currentConvId = conv.id || (conv as any)._id;
          setConversationId(currentConvId);
        } else if (!currentConvId && !targetUserId) {
          console.warn("No conversationId or targetUserId provided to ChatScreen");
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
              time: new Date(timeSource).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              isMe: (msg.senderId?._id || msg.senderId)?.toString() === (user?.id || user?._id)?.toString(),
              timestamp: timeSource,
              fileUrl: msg.fileUrl,
              fileType: msg.fileType,
              isRead: msg.isRead,
            };
          });
          console.log("Logged messages count:", mappedMessages.length);
          if (mappedMessages.length > 0) {
            console.log("First message isMe:", mappedMessages[0].isMe, "Sender:", fetchedMessages[0].senderId, "Current User:", user?.id || user?._id);
          }
          setMessages(mappedMessages);
        }
      } catch (error) {
        Alert.alert("Error", "Failed to load conversation");
        console.error("Error loading conversation:", error);
      } finally {
        setIsLoading(false);
        setIsInitializing(false);
      }
    };

    initializeChat();
  }, [user, targetUserId, conversationId]); // Added conversationId to dependencies

  // Join room when conversationId changes
  useEffect(() => {
    if (conversationId) {
      socketService.joinConversation(conversationId);
    }
  }, [conversationId]);

  // Setup socket listeners — registered ONCE, uses ref to avoid stale closure
  useEffect(() => {
    const unsubscribeMessage = socketService.on("message_received", (data: any) => {
      console.log("Socket message received in ChatScreen:", data);
      const incomingMsg = data.message || data;

      // Always read from ref so we never capture a stale conversationId
      const incomingConvId = (incomingMsg.conversationId?._id || incomingMsg.conversationId)?.toString();
      const currentConvId = conversationIdRef.current?.toString();

      console.log("Comparing convIds:", incomingConvId, "===", currentConvId);

      // If IDs match, or if we can't compare (both undefined), show the message
      if (!incomingConvId || !currentConvId || incomingConvId === currentConvId) {
        const timeSource = incomingMsg.timestamp || incomingMsg.createdAt || new Date().toISOString();
        const mappedMsg: Message = {
          id: incomingMsg.id || incomingMsg._id || Date.now().toString(),
          text: incomingMsg.text,
          time: new Date(timeSource).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isMe: (incomingMsg.senderId?._id || incomingMsg.senderId)?.toString() === (user?.id || user?._id)?.toString(),
          timestamp: timeSource,
          fileUrl: incomingMsg.fileUrl,
          fileType: incomingMsg.fileType,
          isRead: incomingMsg.isRead,
        };

        // Prevent duplicate messages
        setMessages((prev) => {
          if (mappedMsg.id && prev.some(m => m.id === mappedMsg.id)) return prev;
          return [...prev, mappedMsg];
        });

        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });

    return () => {
      unsubscribeMessage();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Register once per user session — ref handles conversationId updates

  // Listen for read receipts — mark MY sent messages as seen
  useEffect(() => {
    const unsubscribeSeen = socketService.on("messages_seen", (data: any) => {
      console.log("Read receipt received:", data);
      const currentConvId = conversationIdRef.current?.toString();
      const incomingConvId = data.conversationId?.toString();
      
      if (!incomingConvId || !currentConvId || incomingConvId === currentConvId) {
        if (data.messageIds && Array.isArray(data.messageIds)) {
          // Convert all IDs to strings for safe comparison
          const seenIds = data.messageIds.map((id: any) => id.toString());
          setMessages(prev => prev.map(msg => 
            seenIds.includes(msg.id?.toString()) ? { ...msg, isRead: true } : msg
          ));
        } else {
          // If no specific IDs, mark ALL my sent messages as read
          setMessages(prev => prev.map(msg =>
            msg.isMe ? { ...msg, isRead: true } : msg
          ));
        }
      }
    });

    return () => {
      unsubscribeSeen();
    };
  }, []);

  // Mark incoming messages as read
  useEffect(() => {
    if (!conversationId || messages.length === 0 || !user) return;

    const unreadMessages = messages.filter(msg => !msg.isMe && !msg.isRead && msg.id);
    if (unreadMessages.length === 0) return;

    const unreadMessageIds = unreadMessages.map(msg => msg.id);

    // Optimistically mark as read in local state
    setMessages(prev => prev.map(msg =>
      unreadMessageIds.includes(msg.id) ? { ...msg, isRead: true } : msg
    ));

    // Call API — controller will emit messagesSeen to sender via socket
    conversationsService.markMessagesRead(conversationId).then(markedIds => {
      if (markedIds && markedIds.length > 0) {
        // Also emit via socket directly (senderId = person we're chatting with)
        const userId = (user?.id || user?._id) as string;
        socketService.markMessagesSeen(conversationId, markedIds, userId, targetUserId);
      }
    }).catch(err => console.error("Failed to mark messages read:", err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, conversationId, user]);

  useEffect(() => {
    if (contactModalVisible && targetUserId) {
      fetchContactInfo();
    }
  }, [contactModalVisible, targetUserId]);

  const fetchContactInfo = async () => {
    if (!targetUserId) return;
    try {
      setIsLoadingProfile(true);
      const [profile, media] = await Promise.all([
        usersService.getUserProfile(targetUserId),
        conversationId ? conversationsService.getConversationMedia(conversationId) : Promise.resolve([])
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
    if (!messageText.trim() || !conversationId) {
      return;
    }

    try {
      setIsSending(true);

      // Add message to local state optimistically
      const tempId = Date.now().toString();
      const newMessage: Message = {
        id: tempId,
        text: messageText,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isMe: true,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, newMessage]);
      const currentText = messageText;
      setMessageText("");

      // Send via API
      try {
        const sentMsg = await conversationsService.sendMessage(conversationId, currentText);
        // Replace temp ID with real ID from backend
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: sentMsg.id || (sentMsg as any)._id } : m));
      } catch (error) {
        console.error("Error sending message via API:", error);
      }

      // Emit via socket
      socketService.emit("send_message", {
        conversationId,
        message: currentText,
      });

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      Alert.alert("Error", "Failed to send message");
      console.error("Error sending message:", error);
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

      if (!result.canceled && result.assets[0].uri) {
        // Send image message
        await sendFileMessage(result.assets[0].uri, "image");
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleAttachFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
      });

      if (!result.canceled && result.assets[0].uri) {
        await sendFileMessage(result.assets[0].uri, "file");
      }
    } catch (error) {
      console.error("Error picking document:", error);
      Alert.alert("Error", "Failed to pick document");
    }
  };

  const handleAudioCall = () => {
    if (targetUserId) {
      initiateCall(targetUserId, chatName, "audio");
    } else {
      Alert.alert("Error", "User information not available for calling.");
    }
  };

  const handleVideoCall = () => {
    if (targetUserId) {
      initiateCall(targetUserId, chatName, "video");
    } else {
      Alert.alert("Error", "User information not available for calling.");
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === "granted") {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setRecording(recording);
        setIsRecording(true);
      } else {
        Alert.alert("Permission Denied", "Please allow microphone access to record audio.");
      }
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        await sendFileMessage(uri, "audio");
      }
    } catch (err) {
      console.error("Failed to stop recording", err);
    }
  };

  const sendFileMessage = async (uri: string, type: string) => {
    if (!conversationId) return;

    try {
      setIsSending(true);

      // 1. Upload to backend/Cloudinary
      const uploadResult = await uploadService.uploadFile(uri, type);

      if (!uploadResult.success) {
        throw new Error("Upload failed");
      }

      const publicUrl = uploadResult.url;

      // 2. Send message via API with the public URL
      const sentMsg = await conversationsService.sendMessage(
        conversationId,
        type === "image" ? "📷 Image" : type === "audio" ? "🎵 Voice Message" : "📄 File",
        publicUrl,
        type,
        uploadResult.fileName
      );

      const newMessage: Message = {
        id: sentMsg.id || (sentMsg as any)._id,
        text: type === "image" ? "📷 Image" : "📄 File",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isMe: true,
        timestamp: new Date().toISOString(),
        fileUrl: publicUrl,
        fileType: type,
      };

      setMessages((prev) => [...prev, newMessage]);

      // 3. Emit via socket
      socketService.emit("send_message", {
        conversationId,
        message: type === "image" ? "📷 Image" : type === "audio" ? "🎵 Voice Message" : "📄 File",
        fileUrl: publicUrl,
        fileType: type,
        senderId: user?.id || user?._id
      });

    } catch (error) {
      console.error("Error sending file:", error);
      Alert.alert("Error", "Failed to upload and send file. Please check your internet connection.");
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    return (
      <View
        style={[
          styles.messageContainer,
          item.isMe ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" },
        ]}
      >
        {!item.isMe && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {chatName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.bubble,
            item.isMe ? styles.myBubble : styles.theirBubble,
          ]}
        >
          {item.fileUrl && (
            item.fileType === "audio" ? (
              <VoicePlayer url={item.fileUrl} isMe={item.isMe} />
            ) : (
              <TouchableOpacity onPress={() => setSelectedPreviewImage(item.fileUrl || null)}>
                <Image
                  source={{ uri: item.fileUrl }}
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )
          )}
          <Text style={item.isMe ? styles.myText : styles.theirText}>
            {item.text}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end' }}>
            <Text style={styles.timeText}>{item.time}</Text>
            {item.isMe && (
              <Ionicons 
                name={item.isRead ? "checkmark-done" : "checkmark"} 
                size={16} 
                color={item.isRead ? "#34D399" : "#94A3B8"} 
                style={{ marginLeft: 4, marginTop: 4 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1A2333" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A2333" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#E2E8F0" />
        </TouchableOpacity>

        <View style={styles.headerUser}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>
              {chatName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.headerName}>{chatName}</Text>
              {isRecipientOnline && <View style={styles.onlineDot} />}
            </View>
            <Text style={[styles.status, isRecipientOnline && { color: "#10B981" }]}>
              {isRecipientOnline ? "Online" : lastSeen ? `Last seen ${new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Offline"}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleAudioCall} style={styles.iconButton}>
            <Ionicons name="call-outline" size={24} color="#E2E8F0" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleVideoCall} style={styles.iconButton}>
            <Ionicons name="videocam-outline" size={24} color="#E2E8F0" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setContactModalVisible(true)}
          >
            <Ionicons
              name="information-circle-outline"
              size={24}
              color="#E2E8F0"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Date Separator */}
      <View style={styles.dateContainer}>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 24}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
        />

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handleAttachImage}
          >
            <Ionicons name="image-outline" size={24} color="#94A3B8" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handleAttachFile}
          >
            <Ionicons name="attach" size={24} color="#94A3B8" />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder={`Message ${chatName}...`}
            placeholderTextColor="#64748B"
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={1000}
            editable={!isSending}
            textAlignVertical="center"
          />

          {messageText.trim() ? (
            <TouchableOpacity
              style={[styles.sendButton, (isSending || isInitializing) && { opacity: 0.5 }]}
              onPress={handleSendMessage}
              disabled={isSending || isInitializing}
            >
              {isSending || isInitializing ? (
                <ActivityIndicator color="#8B5CF6" size="small" />
              ) : (
                <Ionicons name="send" size={24} color="#8B5CF6" />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.micButton, isRecording && styles.activeMicButton]}
              onLongPress={startRecording}
              onPressOut={stopRecording}
              delayLongPress={200}
            >
              <Ionicons
                name={isRecording ? "radio-button-on" : "mic"}
                size={24}
                color={isRecording ? "#EF4444" : "#94A3B8"}
              />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ==================== Contact Info Modal ==================== */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={contactModalVisible}
        onRequestClose={() => setContactModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <View style={styles.modalIcon}>
                  <Ionicons
                    name="person-circle-outline"
                    size={24}
                    color="#C084FC"
                  />
                </View>
                <Text style={styles.modalTitle}>Contact Info</Text>
              </View>
              <TouchableOpacity onPress={() => setContactModalVisible(false)}>
                <Ionicons name="close" size={28} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {isLoadingProfile ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#8B5CF6" />
                <Text style={{ color: "#94A3B8", marginTop: 10 }}>Loading profile...</Text>
              </View>
            ) : (
              <>
                {/* Profile Picture */}
                <View style={styles.profileContainer}>
                  <View style={styles.profileAvatar}>
                    {targetUserProfile?.avatar ? (
                      <Image
                        source={{ uri: targetUserProfile.avatar }}
                        style={{ width: "100%", height: "100%", borderRadius: 55 }}
                      />
                    ) : (
                      <Text style={styles.profileAvatarText}>
                        {chatName.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.contactName}>{targetUserProfile?.username || chatName}</Text>
                  <Text style={styles.contactEmail}>{targetUserProfile?.email || "No email available"}</Text>
                </View>

                {/* Member Since */}
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>MEMBER SINCE</Text>
                  <Text style={styles.infoValue}>
                    {targetUserProfile?.createdAt
                      ? new Date(targetUserProfile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                      : "Recently joined"}
                  </Text>
                </View>


                {/* Shared Content */}
                <View style={styles.sharedContentHeader}>
                  <Text style={styles.sectionTitle}>SHARED CONTENT</Text>
                  <View style={styles.tabButtons}>
                    <TouchableOpacity
                      style={[styles.tabButton, activeTab === "IMAGES" && styles.activeTabButton]}
                      onPress={() => setActiveTab("IMAGES")}
                    >
                      <Text style={activeTab === "IMAGES" ? styles.activeTabText : styles.tabText}>IMAGES</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tabButton, activeTab === "FILES" && styles.activeTabButton]}
                      onPress={() => setActiveTab("FILES")}
                    >
                      <Text style={activeTab === "FILES" ? styles.activeTabText : styles.tabText}>FILES</Text>
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
                        keyExtractor={(item) => item._id}
                        renderItem={({ item }) => (
                          <TouchableOpacity onPress={() => setSelectedPreviewImage(item.fileUrl || null)} style={{ margin: 4 }}>
                            <Image
                              source={{ uri: item.fileUrl }}
                              style={{ width: (width - 60) / 3, height: (width - 60) / 3, borderRadius: 8 }}
                            />
                          </TouchableOpacity>
                        )}
                        contentContainerStyle={{ paddingBottom: 20 }}
                      />
                    ) : (
                      <View style={styles.noContent}>
                        <Ionicons name="image-outline" size={48} color="#475569" />
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
                        keyExtractor={(item) => item._id}
                        renderItem={({ item }) => (
                          <TouchableOpacity style={styles.infoCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="document-text-outline" size={24} color="#3B82F6" style={{ marginRight: 12 }} />
                              <View>
                                <Text style={{ color: 'white', fontSize: 14 }} numberOfLines={1}>
                                  {item.fileName || "Unnamed File"}
                                </Text>
                                <Text style={{ color: '#94A3B8', fontSize: 12 }}>
                                  {new Date(item.createdAt).toLocaleDateString()}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        )}
                        contentContainerStyle={{ paddingBottom: 20 }}
                      />
                    ) : (
                      <View style={styles.noContent}>
                        <Ionicons name="folder-open-outline" size={48} color="#475569" />
                        <Text style={styles.noContentText}>No shared files</Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Full Screen Image Preview Modal */}
      <Modal
        visible={!!selectedPreviewImage}
        transparent={true}
        onRequestClose={() => setSelectedPreviewImage(null)}
        animationType="fade"
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.closePreview}
            onPress={() => setSelectedPreviewImage(null)}
          >
            <Ionicons name="close" size={32} color="white" />
          </TouchableOpacity>

          <ScrollView
            maximumZoomScale={3}
            minimumZoomScale={1}
            contentContainerStyle={styles.previewContainer}
          >
            {selectedPreviewImage && (
              <Image
                key={selectedPreviewImage}
                source={{ uri: selectedPreviewImage }}
                style={{ width: width, height: height }}
                resizeMode="contain"
              />
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  // ... (previous styles remain the same)
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A2333",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  backButton: { padding: 8 },
  headerUser: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerAvatarText: { color: "white", fontSize: 18, fontWeight: "bold" },
  headerName: { color: "white", fontSize: 18, fontWeight: "600" },
  status: { color: "#94A3B8", fontSize: 13 },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginLeft: 6,
  },
  headerActions: { flexDirection: "row" },
  iconButton: { padding: 10 },

  dateContainer: { alignItems: "center", marginVertical: 15 },
  dateText: {
    color: "#64748B",
    fontSize: 13,
    backgroundColor: "#1E2937",
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
  },
  messagesList: { flex: 1 },
  messagesContent: { padding: 16 },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
    width: "100%",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  avatarText: { color: "white", fontSize: 16, fontWeight: "bold" },
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  theirBubble: { backgroundColor: "#1E2937", borderBottomLeftRadius: 4 },
  myBubble: {
    backgroundColor: "#8B5CF6",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  theirText: { color: "white", fontSize: 16 },
  myText: { color: "white", fontSize: 16 },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  timeText: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
    alignSelf: "flex-end",
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end", // multiline হলে বাটনগুলো নিচে থাকবে
    backgroundColor: "#1E2937",
    marginHorizontal: 12,
    marginBottom: Platform.OS === "ios" ? 12 : 16,
    marginTop: 8,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 52,
  },
  attachButton: { 
    padding: 8,
    marginBottom: 4, // input-এর সাথে align করার জন্য
  },
  input: {
    flex: 1,
    color: "white",
    fontSize: 16,
    maxHeight: 120,
    minHeight: 40,
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    paddingHorizontal: 8,
  },
  micButton: { 
    padding: 8,
    marginBottom: 4,
  },
  activeMicButton: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 20,
  },
  sendButton: {
    padding: 8,
    marginBottom: 4,
    justifyContent: "center",
    alignItems: "center",
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1A2333",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: "85%",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  modalTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalIcon: { marginRight: 10 },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#E2E8F0",
  },
  profileContainer: {
    alignItems: "center",
    marginBottom: 30,
  },
  profileAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#60A5FA",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  profileAvatarText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#0F172A",
  },
  contactName: {
    fontSize: 24,
    fontWeight: "700",
    color: "white",
    marginBottom: 4,
  },
  contactEmail: {
    fontSize: 16,
    color: "#94A3B8",
  },
  infoCard: {
    backgroundColor: "#242E42",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  infoLabel: {
    color: "#94A3B8",
    fontSize: 13,
    marginBottom: 4,
  },
  infoValue: {
    color: "white",
    fontSize: 16,
  },
  sharedContentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
  },
  tabButtons: {
    flexDirection: "row",
    backgroundColor: "#242E42",
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
  },
  activeTabButton: {
    backgroundColor: "#8B5CF6",
  },
  tabText: {
    color: "#94A3B8",
    fontWeight: "600",
  },
  activeTabText: {
    color: "white",
    fontWeight: "600",
  },
  noContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noContentText: {
    color: "#64748B",
    marginTop: 12,
    fontSize: 16,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  closePreview: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  previewContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
