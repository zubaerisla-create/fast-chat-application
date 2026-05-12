import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";

interface VoicePlayerProps {
  url: string;
  isMe: boolean;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({ url, isMe }) => {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);

  const togglePlayPause = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const formatTime = (millis: number) => {
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  const progress = status.duration > 0 ? (status.currentTime / status.duration) * 100 : 0;
  const isLoading = status.isBuffering;

  return (
    <View style={[styles.container, isMe ? styles.myContainer : styles.theirContainer]}>
      <TouchableOpacity 
        onPress={togglePlayPause} 
        style={[styles.playButton, isMe ? styles.myPlayButton : styles.theirPlayButton]}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isMe ? "#fff" : "#3B82F6"} />
        ) : (
          <Ionicons name={player.playing ? "pause" : "play"} size={20} color={isMe ? "#fff" : "#3B82F6"} />
        )}
      </TouchableOpacity>
      
      <View style={styles.waveformContainer}>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: isMe ? "#fff" : "#3B82F6" }]} />
        </View>
        <Text style={[styles.timeText, { color: isMe ? "rgba(255,255,255,0.7)" : "#64748B" }]}>
          {formatTime(player.playing || status.currentTime > 0 ? status.currentTime : status.duration)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 16,
    minWidth: 150,
    marginVertical: 4,
  },
  myContainer: {
    backgroundColor: "transparent",
  },
  theirContainer: {
    backgroundColor: "transparent",
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  myPlayButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  theirPlayButton: {
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  waveformContainer: {
    flex: 1,
    marginLeft: 10,
    justifyContent: "center",
  },
  progressBarBackground: {
    height: 3,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 2,
    width: "100%",
    marginBottom: 4,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  timeText: {
    fontSize: 10,
    fontWeight: "600",
  },
});
