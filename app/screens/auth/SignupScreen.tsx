import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export default function AuthScreen() {
  const router = useRouter();
  const { login, register, sendOTP, googleLogin, isLoading } = useAuth();

  const [mode, setMode] = useState("signup"); // 'signin' or 'signup'
  const [step, setStep] = useState(1); // 1 = Details, 2 = OTP
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");

  const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || "496809230686-nnd3i14rdhb1plkddn7dl0emnihauas4.apps.googleusercontent.com";
  const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || "496809230686-djde9n55nvgaads7e0o6qak5vjur8b61.apps.googleusercontent.com";

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: ANDROID_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
    iosClientId: WEB_CLIENT_ID,
    scopes: ["openid", "profile", "email"],
    redirectUri: makeRedirectUri({ useProxy: true }),
  });

  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (response?.type === "success") {
        const idToken = response.params?.id_token as string | undefined;
        if (!idToken) {
          setError("Google login failed. Please try again.");
          return;
        }

        try {
          setError("");
          await googleLogin(idToken);
          Alert.alert("Success", "Logged in with Google successfully!");
          router.replace("/(tabs)");
        } catch (err: any) {
          setError(err.message || "Google login failed.");
          Alert.alert("Error", err.message || "Google login failed.");
        }
      }
    };

    handleGoogleResponse();
  }, [response, googleLogin, router]);

  const handleGoogleLogin = async () => {
    setError("");
    if (!request) {
      setError("Google authentication is not ready yet. Please try again.");
      return;
    }

    try {
      await promptAsync({ useProxy: true });
    } catch (err: any) {
      setError(err.message || "Google login failed.");
      Alert.alert("Error", err.message || "Google login failed.");
    }
  };

  const handleSubmit = async () => {
    try {
      setError("");

      // Validate inputs
      if (!email || !password) {
        setError("Email and password are required");
        return;
      }

      if (mode === "signup" && step === 1 && !username) {
        setError("Username is required");
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }

      if (mode === "signup") {
        if (step === 1) {
          // Send OTP
          await sendOTP(email);
          Alert.alert("Success", "OTP sent to your email!");
          setStep(2);
        } else if (step === 2) {
          if (!otp || otp.length !== 6) {
            setError("Please enter a valid 6-digit OTP");
            return;
          }
          // Register with OTP
          await register(username, email, password, otp);
          Alert.alert("Success", "Account created successfully!");
          router.replace("/(tabs)");
        }
      } else {
        // Login
        await login(email, password);
        Alert.alert("Success", "Logged in successfully!");
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
      Alert.alert("Error", err.message || "An error occurred");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.content}>
              {/* Logo */}
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../../assets/images/icon.png')} 
                  style={{ width: 80, height: 80, borderRadius: 20 }} 
                />
              </View>

              {/* Title */}
              <Text style={styles.title}>fast-chat</Text>
              <Text style={styles.subtitle}>Real-time chat. Clean & fast.</Text>

              {/* Tab Switcher */}
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  style={[styles.tab, mode === "signin" && styles.activeTab]}
                  onPress={() => { setMode("signin"); setStep(1); }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      mode === "signin" && styles.activeTabText,
                    ]}
                  >
                    Sign In
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tab, mode === "signup" && styles.activeTab]}
                  onPress={() => { setMode("signup"); setStep(1); }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      mode === "signup" && styles.activeTabText,
                    ]}
                  >
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Error Message */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={20} color="#EF4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Form */}
              <View style={styles.form}>
                {mode === "signup" && step === 2 ? (
                  <>
                    <Text style={styles.label}>ENTER OTP</Text>
                    <Text style={{color: '#94A3B8', marginBottom: 16}}>An OTP has been sent to {email}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="6-digit OTP"
                      placeholderTextColor="#64748B"
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    
                    <TouchableOpacity
                      style={[styles.button, isLoading && styles.buttonDisabled]}
                      onPress={handleSubmit}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <ActivityIndicator color="white" size="large" />
                      ) : (
                        <Text style={styles.buttonText}>Verify & Register</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ marginTop: 20, alignItems: 'center' }}
                      onPress={() => setStep(1)}
                    >
                      <Text style={{ color: '#94A3B8', fontSize: 16, fontWeight: '600' }}>Go Back</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    {mode === "signup" && (
                      <>
                        <Text style={styles.label}>USERNAME</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="your_username"
                          placeholderTextColor="#64748B"
                          value={username}
                          onChangeText={setUsername}
                        />
                      </>
                    )}

                    <Text style={styles.label}>EMAIL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#64748B"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />

                <Text style={styles.label}>PASSWORD</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="••••••••"
                    placeholderTextColor="#64748B"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off" : "eye"}
                      size={22}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.button, isLoading && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" size="large" />
                  ) : (
                    <Text style={styles.buttonText}>
                      {mode === "signup" ? "Send OTP" : "Sign In"}
                    </Text>
                  )}
                </TouchableOpacity>

                {step === 1 && (
                  <>
                    <View style={styles.orSeparator}>
                      <View style={styles.line} />
                      <Text style={styles.orText}>OR</Text>
                      <View style={styles.line} />
                    </View>

                    <TouchableOpacity
                      style={[styles.googleButton, isLoading && styles.buttonDisabled]}
                      onPress={handleGoogleLogin}
                      disabled={isLoading}
                    >
                      <Ionicons name="logo-google" size={22} color="#1F2937" />
                      <Text style={styles.googleButtonText}>
                        Continue with Google
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
                  </>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  content: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  scrollContent: {
    flexGrow: 1,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logo: {
    width: 80,
    height: 80,
    backgroundColor: "#8B5CF6",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  logoDot: {
    width: 24,
    height: 24,
    backgroundColor: "white",
    borderRadius: 12,
  },
  title: {
    fontSize: 42,
    fontWeight: "700",
    color: "#C084FC",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#94A3B8",
    marginBottom: 50,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#1E2937",
    borderRadius: 16,
    padding: 6,
    marginBottom: 32,
    width: "100%",
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: "#8B5CF6",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#94A3B8",
  },
  activeTabText: {
    color: "white",
  },
  form: {
    width: "100%",
  },
  label: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: "#1E2937",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    color: "white",
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E2937",
    borderRadius: 12,
    height: 56,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    color: "white",
    fontSize: 16,
  },
  eyeIcon: {
    paddingHorizontal: 16,
  },
  button: {
    backgroundColor: "#8B5CF6",
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E2937",
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#EF4444",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  orSeparator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    gap: 12,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#334155",
  },
  orText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    height: 56,
    borderRadius: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  googleButtonText: {
    color: "#1F2937",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 10,
  },
});
