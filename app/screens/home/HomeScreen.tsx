import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Chat {
  id: string;
  name: string;
  message: string;
  time: string;
  avatar: string | number;
  color: string;
}

const chats = [
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
  const [modalVisible, setModalVisible] = useState(false);
  const [username, setUsername] = useState("abcde");

  const renderChat = ({ item }: { item: Chat }) => (
    <TouchableOpacity style={styles.chatItem}>
      <View
        style={[styles.avatar, { backgroundColor: item.color || "#10B981" }]}
      >
        {typeof item.avatar === "string" ? (
          <Text style={styles.avatarText}>{item.avatar}</Text>
        ) : (
          <Image source={item.avatar} style={styles.avatarImage} />
        )}
      </View>
      <View style={styles.chatInfo}>
        <Text style={styles.chatName}>{item.name}</Text>
        <Text style={styles.chatMessage}>{item.message}</Text>
      </View>
      <Text style={styles.time}>{item.time}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>fast-chat</Text>
        <View style={styles.headerIcons}>
          <Ionicons name="search" size={24} color="#94A3B8" />
          <Ionicons
            name="settings-outline"
            size={24}
            color="#94A3B8"
            style={{ marginLeft: 20 }}
          />
          <Ionicons
            name="share-outline"
            size={24}
            color="#94A3B8"
            style={{ marginLeft: 20 }}
          />
        </View>
      </View>

      {/* User Profile Bar */}
      <TouchableOpacity
        style={styles.userBar}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>A</Text>
        </View>
        <View>
          <Text style={styles.userName}>{username}</Text>
          <Text style={styles.userEmail}>abcde@gmail.com</Text>
        </View>
      </TouchableOpacity>

      {/* Search Bar */}
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
        />
      </View>

      {/* Messages Section */}
      <View style={styles.messagesHeader}>
        <Text style={styles.sectionTitle}>MESSAGES</Text>
      </View>

      <FlatList
        data={chats}
        renderItem={renderChat}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.profilePictureContainer}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>A</Text>
              </View>
              <View style={styles.cameraButton}>
                <Ionicons name="camera" size={20} color="white" />
              </View>
            </View>
            <Text style={styles.changePhotoText}>CHANGE PROFILE PICTURE</Text>

            <Text style={styles.label}>NEW USERNAME</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.usernameInput}
                value={username}
                onChangeText={setUsername}
              />
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
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.saveText}>Save Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#C084FC",
  },
  headerIcons: {
    flexDirection: "row",
  },
  userBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2937",
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#34D399",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0F172A",
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#E2E8F0",
  },
  userEmail: {
    fontSize: 14,
    color: "#64748B",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E2937",
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: "#E2E8F0",
    fontSize: 16,
  },
  messagesHeader: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  sectionTitle: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  listContent: {
    paddingTop: 8,
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#E2E8F0",
  },
  chatMessage: {
    fontSize: 15,
    color: "#94A3B8",
    marginTop: 2,
  },
  time: {
    color: "#64748B",
    fontSize: 13,
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "#1E2937",
    borderRadius: 20,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#E2E8F0",
  },
  profilePictureContainer: {
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
  },
  profileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#34D399",
    justifyContent: "center",
    alignItems: "center",
  },
  profileAvatarText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#0F172A",
  },
  cameraButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "#8B5CF6",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#1E2937",
  },
  changePhotoText: {
    textAlign: "center",
    color: "#64748B",
    marginBottom: 24,
    fontSize: 14,
  },
  label: {
    color: "#94A3B8",
    fontSize: 13,
    marginBottom: 8,
  },
  inputContainer: {
    backgroundColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  usernameInput: {
    height: 50,
    color: "#E2E8F0",
    fontSize: 17,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#334155",
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelText: {
    color: "#E2E8F0",
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#8B5CF6",
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  saveText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
});
