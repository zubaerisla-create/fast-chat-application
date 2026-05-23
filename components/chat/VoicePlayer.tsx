import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";

interface VoicePlayerProps {
  url: string;
  isMe: boolean;
  audioDuration?: number;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({ url, isMe, audioDuration }) => {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);

  const togglePlayPause = () => {
    if (player.playing) {
      player.pause();
    } else {
      const current = status?.currentTime || 0;
      const duration = status?.duration || 0;
      // If playback has finished or is near the end, seek back to 0 so it replays instantly
      if (duration > 0 && current >= duration - 0.2) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const progress = (status?.duration && status.duration > 0) ? ((status.currentTime || 0) / status.duration) * 100 : 0;
  const isLoading = status?.isBuffering || false;

  // Choose which time to display
  const getDisplayTime = () => {
    const current = status?.currentTime || 0;
    const duration = status?.duration || 0;

    if (player.playing || current > 0) {
      return formatTime(current);
    }
    if (duration > 0) {
      return formatTime(duration);
    }
    if (audioDuration) {
      return formatTime(audioDuration); // audioDuration is already in seconds
    }
    return "0:00";
  };

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
        <Text style={[styles.timeText, { color: isMe ? "rgba(255,255,255,0.9)" : "#94A3B8" }]}>
          {getDisplayTime()}
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
