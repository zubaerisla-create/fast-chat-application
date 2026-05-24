import { VoicePlayer } from "@/components/chat/VoicePlayer";
import { useAuth } from "@/context/AuthContext";
import { useCall } from "@/context/CallContext";
import conversationsService, { MessageReaction } from "@/services/conversationsService";
import socketService from "@/services/socketService";
import uploadService from "@/services/uploadService";
import usersService, { UserProfile } from "@/services/usersService";
import { formatChatSeparatorDate, formatMessageFullTimestamp } from "@/utils/dateFormatter";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Clipboard,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

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
  replyToMessageId?: string;
  replyToText?: string;
  replyToSenderId?: string;
  replyToSender?: any;
  senderId?: string;
  reactions?: MessageReaction[];
}

interface SwipeableMessageProps {
  children: React.ReactNode;
  onReply: () => void;
  isMe: boolean;
}

const SwipeableMessage: React.FC<SwipeableMessageProps> = ({ children, onReply, isMe }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const hapticTriggered = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Active horizontal drag, ignore vertical scrolls
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 15;
      },
      onPanResponderMove: (_, gestureState) => {
        let dx = gestureState.dx;

        // Resistance effect when swiping too far
        const maxSwipe = 100;
        if (dx > maxSwipe) {
          dx = maxSwipe + (dx - maxSwipe) * 0.2;
        } else if (dx < -maxSwipe) {
          dx = -maxSwipe + (dx + maxSwipe) * 0.2;
        }

        translateX.setValue(dx);

        const threshold = 60;
        if (Math.abs(dx) >= threshold) {
          if (!hapticTriggered.current) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
            hapticTriggered.current = true;
          }
        } else {
          hapticTriggered.current = false;
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = 60;
        if (Math.abs(gestureState.dx) >= threshold) {
          onReply();
        }
        hapticTriggered.current = false;
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
      },
      onPanResponderTerminate: () => {
        hapticTriggered.current = false;
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Compute transform outputs for the reply icons
  const rightSwipeOpacity = translateX.interpolate({
    inputRange: [0, 40, 60],
    outputRange: [0, 0.5, 1],
    extrapolate: "clamp",
  });

  const rightSwipeScale = translateX.interpolate({
    inputRange: [0, 60],
    outputRange: [0.5, 1],
    extrapolate: "clamp",
  });

  const leftSwipeOpacity = translateX.interpolate({
    inputRange: [-60, -40, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: "clamp",
  });

  const leftSwipeScale = translateX.interpolate({
    inputRange: [-60, 0],
    outputRange: [1, 0.5],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.swipeContainer} {...panResponder.panHandlers}>
      {/* Left Icon (revealed when swiping right) */}
      <Animated.View
        style={[
          styles.replyIconLeft,
          {
            opacity: rightSwipeOpacity,
            transform: [{ scale: rightSwipeScale }],
          },
        ]}
      >
        <Ionicons name="arrow-undo" size={20} color="#8B5CF6" />
      </Animated.View>

      {/* Right Icon (revealed when swiping left) */}
      <Animated.View
        style={[
          styles.replyIconRight,
          {
            opacity: leftSwipeOpacity,
            transform: [{ scale: leftSwipeScale }, { scaleX: -1 }],
          },
        ]}
      >
        <Ionicons name="arrow-undo" size={20} color="#8B5CF6" />
      </Animated.View>

      <Animated.View
        style={[
          { transform: [{ translateX }] },
          isMe ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const getReplySenderName = (
  replyToSenderId?: string,
  replyToSender?: any,
  currentUserId?: string,
  targetUserId?: string,
  chatName?: string
): string => {
  const currentUserIdStr = currentUserId?.toString();
  const recipientIdStr = targetUserId?.toString();

  // Resolve using replyToSenderId
  const replySenderIdStr = replyToSenderId;
  if (replySenderIdStr) {
    if (currentUserIdStr && replySenderIdStr === currentUserIdStr) {
      return "You";
    }
    if (recipientIdStr && replySenderIdStr === recipientIdStr) {
      return chatName || "User";
    }
  }

  // Resolve using replyToSender
  if (replyToSender) {
    if (typeof replyToSender === "string") {
      return replyToSender;
    }
    if (replyToSender.username) {
      return replyToSender.username;
    }
    if (replyToSender.name) {
      return replyToSender.name;
    }
  }

  return "User";
};

const AnimatedDot = ({ delay }: { delay: number }) => {
  const yVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(yVal, {
          toValue: -5,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(yVal, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(400),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [delay, yVal]);

  return (
    <Animated.View
      style={[
        styles.typingDot,
        {
          transform: [{ translateY: yVal }],
        },
      ]}
    />
  );
};

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
  const [replyingTo, setReplyingTo] = useState<{ id: string; text: string; sender: string; senderId: string } | null>(null);
  const [recordedAudioPreview, setRecordedAudioPreview] = useState<{
    uri: string;
    duration: number;
    isUploading: boolean;
    uploadResult?: any;
  } | null>(null);
  const [previewSound, setPreviewSound] = useState<Audio.Sound | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const conversationIdRef = useRef<string | null>(conversationId);
  const inputRef = useRef<TextInput>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  const [isOpponentTyping, setIsOpponentTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCurrentlyTypingRef = useRef(false);

  const [reactionModalVisible, setReactionModalVisible] = useState(false);
  const [reactionTargetMessage, setReactionTargetMessage] = useState<Message | null>(null);

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

  useFocusEffect(
    useCallback(() => {
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
              senderId: (msg.senderId?._id || msg.senderId)?.toString(),
              timestamp: timeSource,
              fileUrl: msg.fileUrl,
              fileType: msg.fileType,
              isRead: msg.isRead,
              audioDuration: msg.audioDuration,
              replyToMessageId: msg.replyToMessageId,
              replyToText: msg.replyToText,
              replyToSender: msg.replyToSender,
              replyToSenderId: msg.replyToSenderId,
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
          senderId: (incomingMsg.senderId?._id || incomingMsg.senderId)?.toString(),
          timestamp: timeSource,
          fileUrl: incomingMsg.fileUrl,
          fileType: incomingMsg.fileType,
          isRead: incomingMsg.isRead,
          audioDuration: incomingMsg.audioDuration,
          replyToMessageId: incomingMsg.replyToMessageId,
          replyToText: incomingMsg.replyToText,
          replyToSender: incomingMsg.replyToSender,
          replyToSenderId: incomingMsg.replyToSenderId,
        };
        setMessages(prev => {
          if (mappedMsg.id && prev.some(m => m.id === mappedMsg.id)) return prev;
          return [...prev, mappedMsg];
        });
      }
    });
    return () => { unsubscribeMessage(); };
  }, [user]);

  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (!conversationId || !targetUserId) return;
    socketService.sendTyping(conversationId, targetUserId, isTyping);
    isCurrentlyTypingRef.current = isTyping;
  }, [conversationId, targetUserId]);

  const handleTextChange = (text: string) => {
    setMessageText(text);

    if (!isCurrentlyTypingRef.current) {
      sendTypingStatus(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 3000);
  };

  const handleFocus = () => {
    sendTypingStatus(true);
  };

  const handleBlur = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    sendTypingStatus(false);
  };

  useEffect(() => {
    const unsubscribeTyping = socketService.on("user_typing", (data: any) => {
      const incomingConvId = data.conversationId?.toString();
      const currentConvId = conversationIdRef.current?.toString();
      const senderId = data.senderId?.toString();
      if (incomingConvId === currentConvId && senderId === targetUserId?.toString()) {
        setIsOpponentTyping(true);
      }
    });

    const unsubscribeStoppedTyping = socketService.on("user_stopped_typing", (data: any) => {
      const incomingConvId = data.conversationId?.toString();
      const currentConvId = conversationIdRef.current?.toString();
      const senderId = data.senderId?.toString();
      if (incomingConvId === currentConvId && senderId === targetUserId?.toString()) {
        setIsOpponentTyping(false);
      }
    });

    return () => {
      unsubscribeTyping();
      unsubscribeStoppedTyping();
    };
  }, [targetUserId]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isCurrentlyTypingRef.current && conversationIdRef.current && targetUserId) {
        socketService.sendTyping(conversationIdRef.current, targetUserId, false);
      }
    };
  }, [targetUserId]);

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
    const unsubscribeReaction = socketService.on("message_reaction_updated", (data: any) => {
      const { messageId, conversationId: incomingConvId, reactions } = data;
      const currentConvId = conversationIdRef.current?.toString();
      if (incomingConvId?.toString() === currentConvId) {
        setMessages(prev => prev.map(msg => {
          if (msg.id === messageId?.toString()) {
            return {
              ...msg,
              reactions: reactions.map((r: any) => ({
                userId: (r.userId?._id || r.userId)?.toString(),
                emoji: r.emoji
              }))
            };
          }
          return msg;
        }));
      }
    });
    return () => { unsubscribeReaction(); };
  }, []);

  useEffect(() => {
    const unsubscribeDelete = socketService.on("message_deleted", (data: any) => {
      const deletedMsgId = data.messageId || data.id || data;
      if (deletedMsgId) {
        setMessages(prev => prev.filter(msg => msg.id !== deletedMsgId.toString()));
      }
    });
    return () => { unsubscribeDelete(); };
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
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    sendTypingStatus(false);
    try {
      setIsSending(true);
      const tempId = Date.now().toString();
      const replyData = replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text,
        sender: replyingTo.sender,
        senderId: replyingTo.senderId
      } : null;

      const newMessage: Message = {
        id: tempId,
        text: messageText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isMe: true,
        timestamp: new Date().toISOString(),
        replyToMessageId: replyData?.id,
        replyToText: replyData?.text,
        replyToSender: replyData?.sender,
        replyToSenderId: replyData?.senderId,
      };
      setMessages(prev => [...prev, newMessage]);
      const currentText = messageText;
      setMessageText("");
      setReplyingTo(null);

      try {
        const sentMsg = await conversationsService.sendMessage(
          conversationId,
          currentText,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          replyData?.id,
          replyData?.text,
          replyData?.senderId
        );
        setMessages(prev => prev.map(m => m.id === tempId ? {
          ...m,
          id: sentMsg.id || (sentMsg as any)._id,
          replyToSenderId: sentMsg.replyToSenderId || m.replyToSenderId,
          replyToSender: sentMsg.replyToSender || m.replyToSender
        } : m));
      } catch (error) {
        console.error("Error sending message via API:", error);
      }
      socketService.emit("send_message", {
        conversationId,
        message: currentText,
        replyToMessageId: replyData?.id,
        replyToText: replyData?.text,
        replyToSenderId: replyData?.senderId,
      });
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

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const startReplyToMessage = (message: Message) => {
    const replySenderId = message.isMe
      ? (user?.id || user?._id)?.toString()
      : targetUserId?.toString();

    setReplyingTo({
      id: message.id,
      text: message.text,
      sender: message.isMe ? "You" : chatName,
      senderId: replySenderId || "",
    });

    // Auto-focus the input field to automatically open the keyboard
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
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
          try { await recording.stopAndUnloadAsync(); } catch (_) { }
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
      if (uri) {
        // Set preview state first with isUploading: true
        setRecordedAudioPreview({
          uri,
          duration: capturedDuration,
          isUploading: true,
        });

        // Trigger background pre-upload
        uploadService.uploadFile(uri, "voice-message").then((uploadResult) => {
          setRecordedAudioPreview(prev => {
            if (!prev || prev.uri !== uri) return prev; // Avoid setting if it has already been cancelled
            return {
              ...prev,
              isUploading: false,
              uploadResult,
            };
          });
        }).catch((err) => {
          console.error("Background upload failed:", err);
          setRecordedAudioPreview(prev => {
            if (!prev || prev.uri !== uri) return prev;
            return {
              ...prev,
              isUploading: false,
            };
          });
        });
      }
    } catch (err) {
      console.error("Failed to stop recording", err);
    }
  };

  const sendFileMessage = async (uri: string, type: string, duration?: number) => {
    if (!conversationId) return;
    try {
      setIsSending(true);
      const replyData = replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text,
        sender: replyingTo.sender,
        senderId: replyingTo.senderId
      } : null;
      setReplyingTo(null);

      const uploadResult = await uploadService.uploadFile(uri, type);
      if (!uploadResult.success) throw new Error("Upload failed");
      const publicUrl = uploadResult.url;
      const audioDuration = type === "audio" && duration ? duration : undefined;
      const sentMsg = await conversationsService.sendMessage(
        conversationId,
        type === "image" ? "📷 Image" : type === "audio" ? "🎵 Voice Message" : "📄 File",
        publicUrl,
        type,
        uploadResult.fileName,
        undefined,
        audioDuration,
        replyData?.id,
        replyData?.text,
        replyData?.senderId
      );
      const newMessage: Message = {
        replyToMessageId: replyData?.id,
        replyToText: replyData?.text,
        replyToSender: replyData?.sender,
        replyToSenderId: replyData?.senderId,
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
        fileUrl: publicUrl,
        fileType: type,
        senderId: user?.id || user?._id,
        audioDuration,
        replyToMessageId: replyData?.id,
        replyToText: replyData?.text,
        replyToSenderId: replyData?.senderId,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to upload and send file. Please check your internet connection.");
    } finally {
      setIsSending(false);
    }
  };

  // Voice Preview play/pause
  const playPreview = async () => {
    if (!recordedAudioPreview) return;
    try {
      if (previewSound) {
        if (isPlayingPreview) {
          await previewSound.pauseAsync();
          setIsPlayingPreview(false);
        } else {
          await previewSound.playAsync();
          setIsPlayingPreview(true);
        }
      } else {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: recordedAudioPreview.uri },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlayingPreview(false);
              sound.setPositionAsync(0);
            }
          }
        );
        setPreviewSound(sound);
        setIsPlayingPreview(true);
      }
    } catch (error) {
      console.error("Error playing preview sound:", error);
    }
  };

  const stopPreview = async () => {
    if (previewSound) {
      try {
        await previewSound.stopAsync();
        await previewSound.unloadAsync();
      } catch (_) { }
      setPreviewSound(null);
      setIsPlayingPreview(false);
    }
  };

  // Discard/Delete voice preview
  const handleDeleteAudioPreview = async () => {
    if (!recordedAudioPreview) return;
    const previewToDiscard = recordedAudioPreview;

    // Clean up local playback
    await stopPreview();
    setRecordedAudioPreview(null);

    // If it has already finished uploading, delete from Cloudinary
    if (previewToDiscard.uploadResult?.publicId) {
      try {
        await uploadService.deleteFile(
          previewToDiscard.uploadResult.publicId,
          "audio"
        );
      } catch (err) {
        console.error("Error cleaning up Cloudinary file on discard:", err);
      }
    }
  };

  // Send voice preview
  const handleSendAudioPreview = async () => {
    if (!recordedAudioPreview || !conversationId) return;

    if (recordedAudioPreview.isUploading) {
      Alert.alert("Uploading", "Please wait for the audio to finish uploading.");
      return;
    }

    if (!recordedAudioPreview.uploadResult?.url) {
      Alert.alert("Upload Failed", "Audio upload failed. Please delete and record again.");
      return;
    }

    try {
      setIsSending(true);
      const publicUrl = recordedAudioPreview.uploadResult.url;
      const audioDuration = recordedAudioPreview.duration;

      const replyData = replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text,
        sender: replyingTo.sender,
        senderId: replyingTo.senderId
      } : null;
      setReplyingTo(null);

      // Clean up local preview sound
      await stopPreview();
      setRecordedAudioPreview(null);

      const sentMsg = await conversationsService.sendMessage(
        conversationId,
        "🎵 Voice Message",
        publicUrl,
        "audio",
        recordedAudioPreview.uploadResult.fileName || "voice-message.mp3",
        undefined,
        audioDuration,
        replyData?.id,
        replyData?.text,
        replyData?.senderId
      );

      const newMessage: Message = {
        replyToMessageId: replyData?.id,
        replyToText: replyData?.text,
        replyToSender: replyData?.sender,
        replyToSenderId: replyData?.senderId,
        id: sentMsg.id || (sentMsg as any)._id,
        text: "🎵 Voice Message",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isMe: true,
        timestamp: new Date().toISOString(),
        fileUrl: publicUrl,
        fileType: "audio",
        audioDuration,
      };
      setMessages(prev => [...prev, newMessage]);

      socketService.emit("send_message", {
        conversationId,
        message: "🎵 Voice Message",
        fileUrl: publicUrl,
        fileType: "audio",
        senderId: user?.id || user?._id,
        audioDuration,
        replyToMessageId: replyData?.id,
        replyToText: replyData?.text,
        replyToSenderId: replyData?.senderId,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to send voice message");
    } finally {
      setIsSending(false);
    }
  };

  const handleLongPressMessage = (message: Message) => {
    setReactionTargetMessage(message);
    setReactionModalVisible(true);
  };

  const handleUnsendMessage = () => {
    if (!reactionTargetMessage) return;
    const msgId = reactionTargetMessage.id;
    Alert.alert(
      "Unsend Message",
      "Are you sure you want to unsend this message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unsend",
          style: "destructive",
          onPress: async () => {
            try {
              await conversationsService.deleteMessage(msgId);
              setMessages(prev => prev.filter(msg => msg.id !== msgId));
            } catch (error) {
              Alert.alert("Error", "Failed to unsend message");
            }
          }
        }
      ]
    );
  };

  const handleReactToMessage = async (emoji: string) => {
    if (!reactionTargetMessage) return;
    const messageId = reactionTargetMessage.id;
    setReactionModalVisible(false);

    try {
      const currentUserId = (user?.id || user?._id)?.toString();
      if (!currentUserId) return;

      // Optimistic update
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const currentReactions = msg.reactions || [];
          const existingIndex = currentReactions.findIndex(r => r.userId === currentUserId);
          let newReactions = [...currentReactions];

          if (existingIndex > -1) {
            if (currentReactions[existingIndex].emoji === emoji) {
              // Remove reaction (toggle behavior)
              newReactions.splice(existingIndex, 1);
            } else {
              // Update reaction
              newReactions[existingIndex] = { userId: currentUserId, emoji };
            }
          } else {
            // Add new reaction
            newReactions.push({ userId: currentUserId, emoji });
          }
          return { ...msg, reactions: newReactions };
        }
        return msg;
      }));

      // Send to server
      const updatedReactions = await conversationsService.reactToMessage(messageId, emoji);

      // Sync authoritative reactions from server
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            reactions: updatedReactions.map((r: any) => ({
              userId: (r.userId?._id || r.userId)?.toString(),
              emoji: r.emoji
            }))
          };
        }
        return msg;
      }));
    } catch (error) {
      console.error("Failed to react to message:", error);
      Alert.alert("Error", "Failed to update reaction");
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const renderReactions = (reactionsList?: MessageReaction[]) => {
      if (!reactionsList || reactionsList.length === 0) return null;

      const emojiGroups: { [key: string]: number } = {};
      reactionsList.forEach(r => {
        emojiGroups[r.emoji] = (emojiGroups[r.emoji] || 0) + 1;
      });

      return (
        <View style={[
          styles.reactionsContainer,
          item.isMe ? styles.myReactionsContainer : styles.theirReactionsContainer
        ]}>
          {Object.keys(emojiGroups).map((emoji) => {
            const count = emojiGroups[emoji];
            return (
              <View key={emoji} style={styles.reactionPill}>
                <Text style={styles.reactionPillEmoji}>{emoji}</Text>
                {count > 1 && <Text style={styles.reactionPillCount}>{count}</Text>}
              </View>
            );
          })}
        </View>
      );
    };

    const isSelected = selectedMessageId === item.id;
    const currentTimestamp = item.timestamp;
    const olderItem = messages[messages.length - 2 - index];
    const showDateSeparator =
      index === messages.length - 1 ||
      (currentTimestamp !== undefined &&
        olderItem?.timestamp !== undefined &&
        new Date(currentTimestamp).toDateString() !== new Date(olderItem.timestamp).toDateString());

    const isImageOnly = item.fileType === "image" && item.fileUrl;
    const isAudio = item.fileType === "audio";

    const replyQuote = item.replyToText ? (
      <View
        style={[
          styles.replyQuoteContainer,
          item.isMe ? styles.myReplyQuoteContainer : styles.theirReplyQuoteContainer,
        ]}
      >
        <View style={styles.replyQuoteContent}>
          <Text
            style={[
              styles.replyQuoteLabel,
              item.isMe ? styles.myReplyQuoteLabel : styles.theirReplyQuoteLabel,
            ]}
          >
            {getReplySenderName(
              item.replyToSenderId,
              item.replyToSender,
              user?.id || user?._id,
              targetUserId,
              chatName
            )}
          </Text>
          <Text
            style={[
              styles.replyQuoteText,
              item.isMe ? styles.myReplyQuoteText : styles.theirReplyQuoteText,
            ]}
            numberOfLines={1}
          >
            {item.replyToText}
          </Text>
        </View>
      </View>
    ) : null;

    return (
      <View style={{ width: "100%" }}>
        {showDateSeparator && (
          <View style={styles.dateContainer}>
            <LinearGradient colors={["#1E293B", "#0F172A"]} style={styles.datePill}>
              <Text style={styles.dateText}>{formatChatSeparatorDate(item.timestamp)}</Text>
            </LinearGradient>
          </View>
        )}

        {isSelected && (
          <View style={[styles.bubbleTimestampContainer, item.isMe ? { alignSelf: "flex-end", marginRight: 12 } : { alignSelf: "flex-start", marginLeft: 52 }]}>
            <Text style={styles.bubbleTimestampText}>{formatMessageFullTimestamp(item.timestamp)}</Text>
          </View>
        )}

        <View
          style={[styles.messageContainer, item.isMe ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}
        >
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

          <SwipeableMessage onReply={() => startReplyToMessage(item)} isMe={item.isMe}>
            <View style={[
              { position: "relative", overflow: "visible" },
              item.isMe ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" },
              item.reactions && item.reactions.length > 0 && { marginBottom: 10 }
            ]}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setSelectedMessageId(prev => prev === item.id ? null : item.id)}
                onLongPress={() => handleLongPressMessage(item)}
                style={[styles.bubble, item.isMe ? styles.myBubble : styles.theirBubble, isImageOnly && styles.imageBubble]}
              >
                {item.isMe ? (
                  <LinearGradient
                    colors={["#7C3AED", "#6D28D9"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.bubbleInner, isImageOnly && { padding: 0 }]}
                  >
                    {replyQuote}
                    {item.fileUrl && (
                      isAudio ? (
                        <VoicePlayer url={item.fileUrl} isMe={item.isMe} audioDuration={item.audioDuration} />
                      ) : (
                        <TouchableOpacity onPress={() => setSelectedPreviewImage(item.fileUrl || null)}>
                          <Image source={{ uri: item.fileUrl }} style={styles.messageImage} resizeMode="cover" />
                        </TouchableOpacity>
                      )
                    )}
                    {!isAudio && <Text style={styles.myText}>{item.text}</Text>}
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
                    {replyQuote}
                    {item.fileUrl && (
                      isAudio ? (
                        <VoicePlayer url={item.fileUrl} isMe={item.isMe} audioDuration={item.audioDuration} />
                      ) : (
                        <TouchableOpacity onPress={() => setSelectedPreviewImage(item.fileUrl || null)}>
                          <Image source={{ uri: item.fileUrl }} style={styles.messageImage} resizeMode="cover" />
                        </TouchableOpacity>
                      )
                    )}
                    {!isAudio && <Text style={styles.theirText}>{item.text}</Text>}
                    <View style={styles.timeRow}>
                      <Text style={styles.theirTimeText}>{item.time}</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
              {renderReactions(item.reactions)}
            </View>
          </SwipeableMessage>
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
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

        {/* ── KeyboardAvoidingView wraps ONLY the content below the header ── */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          // FIX: Use "padding" on BOTH platforms — "height" on Android causes the
          // container to not fully restore its original size after keyboard dismiss.
          behavior="padding"
          // FIX: On Android, offset by 0 so padding is applied cleanly.
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          {/* ── Header lives INSIDE KeyboardAvoidingView but is NOT affected by it ── */}
          <Animated.View
            style={[
              styles.header,
              {
                opacity: headerAnim,
                transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
              },
            ]}
          >
            <LinearGradient colors={["#1A1F35", "#141929"]} style={styles.headerGradient}>
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
                  <Text style={[
                    styles.status,
                    isOpponentTyping ? styles.typingStatus : (isRecipientOnline && styles.onlineStatus)
                  ]}>
                    {isOpponentTyping
                      ? "typing..."
                      : isRecipientOnline
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

          {/* ── Messages List ── */}
          {/* FIX: TouchableWithoutFeedback wraps the FlatList so tapping the
              message area dismisses the keyboard cleanly without any layout jump. */}
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
                // FIX: Allows taps on messages to register while also letting the
                // keyboard dismiss when tapping empty space.
                keyboardShouldPersistTaps="handled"
                // FIX: Prevents the list from automatically scrolling / jumping
                // when the keyboard appears or disappears.
                automaticallyAdjustKeyboardInsets={false}
                automaticallyAdjustsScrollIndicatorInsets={false}
              />
            </View>
          </TouchableWithoutFeedback>

          {/* ── Input Bar ── */}
          <View style={styles.inputWrapper}>
            {isOpponentTyping && (
              <View style={styles.typingIndicatorContainer}>
                <View style={styles.typingBubble}>
                  <View style={styles.typingDotsContainer}>
                    <AnimatedDot delay={0} />
                    <AnimatedDot delay={150} />
                    <AnimatedDot delay={300} />
                  </View>
                  <Text style={styles.typingText}>{chatName} is typing...</Text>
                </View>
              </View>
            )}
            {replyingTo && (
              <View style={styles.replyBanner}>
                <View style={styles.replyBannerIcon}>
                  <Ionicons name="arrow-undo-outline" size={18} color="#8B5CF6" />
                </View>
                <View style={styles.replyBannerTextContainer}>
                  <Text style={styles.replyBannerLabel}>
                    Replying to <Text style={styles.replyBannerLabelBold}>{replyingTo.sender}</Text>
                  </Text>
                  <Text style={styles.replyBannerText} numberOfLines={1}>{replyingTo.text}</Text>
                </View>
                <TouchableOpacity onPress={cancelReply} style={styles.replyCancelButton}>
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            )}
            {recordedAudioPreview ? (
              <LinearGradient colors={["#1E293B", "#0F172A"]} style={styles.previewBannerContainer}>
                {/* Trash/Delete Button */}
                <TouchableOpacity onPress={handleDeleteAudioPreview} style={styles.previewDiscardBtn}>
                  <Ionicons name="trash-outline" size={22} color="#EF4444" />
                </TouchableOpacity>

                {/* Audio Preview controls */}
                <View style={styles.previewPlaybackContainer}>
                  <TouchableOpacity onPress={playPreview} style={styles.previewPlayBtn}>
                    <Ionicons name={isPlayingPreview ? "pause" : "play"} size={20} color="white" />
                  </TouchableOpacity>

                  {/* Visual tracker & Upload status */}
                  <View style={styles.previewWaveContainer}>
                    <Text style={styles.previewDurationText}>
                      Voice Message • {`${String(Math.floor(recordedAudioPreview.duration / 60)).padStart(2, "0")}:${String(recordedAudioPreview.duration % 60).padStart(2, "0")}`}
                    </Text>
                    {recordedAudioPreview.isUploading ? (
                      <View style={styles.uploadingStateContainer}>
                        <ActivityIndicator size="small" color="#8B5CF6" style={{ marginRight: 6 }} />
                        <Text style={styles.uploadingStateText}>Uploading...</Text>
                      </View>
                    ) : (
                      <Text style={styles.uploadingStateTextReady}>Ready to send</Text>
                    )}
                  </View>
                </View>

                {/* Send Button */}
                <TouchableOpacity
                  onPress={handleSendAudioPreview}
                  disabled={recordedAudioPreview.isUploading}
                  style={[styles.previewSendBtn, recordedAudioPreview.isUploading && { opacity: 0.5 }]}
                >
                  <LinearGradient colors={["#7C3AED", "#6D28D9"]} style={styles.previewSendBtnGradient}>
                    <Ionicons name="send" size={18} color="white" />
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            ) : (
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
                    ref={inputRef}
                    style={styles.input}
                    placeholder={`Message ${chatName}...`}
                    placeholderTextColor="#475569"
                    value={messageText}
                    onChangeText={handleTextChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
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
            )}
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

        {/* ── Reaction/Actions Modal ── */}
        <Modal
          animationType="fade"
          transparent
          visible={reactionModalVisible}
          onRequestClose={() => setReactionModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setReactionModalVisible(false)}>
            <View style={styles.reactionOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.reactionMenuContainer}>
                  {/* Emoji Reactions Row */}
                  <View style={styles.emojiRow}>
                    {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        onPress={() => handleReactToMessage(emoji)}
                        style={styles.emojiButton}
                      >
                        <Text style={styles.emojiText}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Actions list */}
                  <View style={styles.actionMenu}>
                    <TouchableOpacity
                      style={styles.actionItem}
                      onPress={() => {
                        setReactionModalVisible(false);
                        if (reactionTargetMessage) {
                          startReplyToMessage(reactionTargetMessage);
                        }
                      }}
                    >
                      <Ionicons name="arrow-undo-outline" size={20} color="#94A3B8" style={styles.actionIcon} />
                      <Text style={styles.actionText}>Reply</Text>
                    </TouchableOpacity>

                    {reactionTargetMessage && !reactionTargetMessage.fileUrl && (
                      <TouchableOpacity
                        style={styles.actionItem}
                        onPress={() => {
                          setReactionModalVisible(false);
                          if (reactionTargetMessage) {
                            Clipboard.setString(reactionTargetMessage.text);
                          }
                        }}
                      >
                        <Ionicons name="copy-outline" size={20} color="#94A3B8" style={styles.actionIcon} />
                        <Text style={styles.actionText}>Copy Text</Text>
                      </TouchableOpacity>
                    )}

                    {reactionTargetMessage?.isMe && (
                      <TouchableOpacity
                        style={[styles.actionItem, styles.deleteActionItem]}
                        onPress={() => {
                          setReactionModalVisible(false);
                          handleUnsendMessage();
                        }}
                      >
                        <Ionicons name="trash-outline" size={20} color="#EF4444" style={styles.actionIcon} />
                        <Text style={[styles.actionText, styles.deleteActionText]}>Unsend</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
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
  typingStatus: { color: "#A78BFA", fontWeight: "600" },
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
  myBubble: {
    borderBottomRightRadius: 4,
    alignSelf: "flex-end",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  theirBubble: {
    borderBottomLeftRadius: 4,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.15)",
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleInner: { paddingHorizontal: 14, paddingVertical: 10 },
  replyQuoteContainer: {
    borderRadius: 12,
    borderLeftWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
    maxWidth: "100%",
  },
  myReplyQuoteContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderLeftColor: "#E9D5FF",
  },
  theirReplyQuoteContainer: {
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    borderLeftColor: "#8B5CF6",
  },
  replyQuoteContent: {
    flexDirection: "column",
  },
  replyQuoteLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 1,
  },
  myReplyQuoteLabel: {
    color: "#DDD6FE",
  },
  theirReplyQuoteLabel: {
    color: "#A78BFA",
  },
  replyQuoteText: {
    fontSize: 12,
    lineHeight: 16,
  },
  myReplyQuoteText: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  theirReplyQuoteText: {
    color: "#94A3B8",
  },
  myText: { color: "#F1F5F9", fontSize: 15, lineHeight: 22, flexShrink: 1 },
  theirText: { color: "#CBD5E1", fontSize: 15, lineHeight: 22, flexShrink: 1 },
  messageImage: { width: 220, height: 220, borderRadius: 14, marginBottom: 6 },
  timeRow: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end", marginTop: 4 },
  myTimeText: { fontSize: 11, color: "rgba(255,255,255,0.55)" },
  theirTimeText: { fontSize: 11, color: "#475569" },

  swipeContainer: {
    position: "relative",
    overflow: "visible",
    flex: 1,
  },
  replyIconLeft: {
    position: "absolute",
    left: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    width: 30,
    zIndex: 1,
  },
  replyIconRight: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    width: 30,
    zIndex: 1,
  },

  /* ── Input ── */
  typingIndicatorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: "flex-start",
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.2)",
  },
  typingDotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
    height: 10,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#A78BFA",
    marginHorizontal: 2,
  },
  typingText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "500",
  },
  inputWrapper: { paddingHorizontal: 12, paddingBottom: Platform.OS === "ios" ? 10 : 14, paddingTop: 8 },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.2)",
    borderLeftWidth: 4,
    borderLeftColor: "#8B5CF6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  replyBannerIcon: {
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  replyBannerTextContainer: { flex: 1, paddingRight: 10 },
  replyBannerLabel: { color: "#94A3B8", fontSize: 11, marginBottom: 1 },
  replyBannerLabelBold: { fontWeight: "700", color: "#DDD6FE" },
  replyBannerText: { color: "#E2E8F0", fontSize: 13, lineHeight: 16 },
  replyCancelButton: { padding: 4 },
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

  /* ── Voice Message Preview Banner ── */
  previewBannerContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 28,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 52,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.2)",
  },
  previewDiscardBtn: {
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  previewPlaybackContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
    backgroundColor: "rgba(30, 41, 59, 0.4)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previewPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  previewWaveContainer: {
    flex: 1,
    justifyContent: "center",
  },
  previewDurationText: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "600",
  },
  uploadingStateContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  uploadingStateText: {
    color: "#8B5CF6",
    fontSize: 11,
    fontWeight: "500",
  },
  uploadingStateTextReady: {
    color: "#10B981",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  previewSendBtn: {
    justifyContent: "center",
    alignItems: "center",
  },
  previewSendBtnGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

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

  /* ── Reaction Actions Overlay & Pill styles ── */
  reactionOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  reactionMenuContainer: {
    width: "80%",
    backgroundColor: "#1E293B",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  emojiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
    marginBottom: 8,
  },
  emojiButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: "#0F172A",
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  emojiText: {
    fontSize: 20,
  },
  actionMenu: {
    marginTop: 8,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  actionIcon: {
    marginRight: 12,
  },
  actionText: {
    color: "#E2E8F0",
    fontSize: 15,
    fontWeight: "500",
  },
  deleteActionItem: {
    borderTopWidth: 1,
    borderTopColor: "#334155",
    marginTop: 8,
    paddingTop: 16,
  },
  deleteActionText: {
    color: "#EF4444",
  },
  reactionsContainer: {
    position: "absolute",
    bottom: -8,
    flexDirection: "row",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#334155",
    zIndex: 10,
    elevation: 3,
  },
  myReactionsContainer: {
    right: 10,
  },
  theirReactionsContainer: {
    left: 10,
  },
  reactionPill: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 1,
  },
  reactionPillEmoji: {
    fontSize: 12,
  },
  reactionPillCount: {
    color: "#94A3B8",
    fontSize: 10,
    marginLeft: 2,
    fontWeight: "600",
  },
});