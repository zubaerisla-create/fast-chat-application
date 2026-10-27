import {
  AuthBackground,
  BrandMark,
  ErrorBanner,
  Field,
  InfoBanner,
  OtpInput,
  PasswordStrength,
  PrimaryButton,
  TextButton,
} from "@/components/auth/AuthUI";
import { palette, radius } from "@/constants/design";
import { useAuth } from "@/context/AuthContext";
import authService from "@/services/authService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Mode = "signin" | "signup" | "forgot";

const RESEND_SECONDS = 60;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,30}$/;

const COPY: Record<string, { title: string; subtitle: (email: string) => string }> = {
  "signin-1": { title: "Welcome back", subtitle: () => "Sign in to pick up your conversations." },
  "signup-1": { title: "Create your account", subtitle: () => "Join Fast Chat — it takes less than a minute." },
  "signup-2": { title: "Check your inbox", subtitle: (e) => `Enter the 6-digit code we sent to ${e}.` },
  "forgot-1": { title: "Forgot password?", subtitle: () => "Enter your email and we'll send you a reset code." },
  "forgot-2": { title: "Enter reset code", subtitle: (e) => `We sent a 6-digit code to ${e}.` },
  "forgot-3": { title: "Set a new password", subtitle: () => "Pick something strong that you haven't used before." },
};

export default function AuthScreen() {
  const router = useRouter();
  const { login, register, sendOTP, resetPassword } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const trimmedEmail = email.trim().toLowerCase();
  const copy = COPY[`${mode}-${step}`];

  // ── Animations: content fades/slides in on every screen change; tab pill slides ──
  const enter = useRef(new Animated.Value(1)).current;
  const pill = useRef(new Animated.Value(0)).current;
  const [tabWidth, setTabWidth] = useState(0);

  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [mode, step, enter]);

  useEffect(() => {
    Animated.spring(pill, { toValue: mode === "signup" ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
  }, [mode, pill]);

  // ── Resend countdown ──
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const go = (nextMode: Mode, nextStep = 1) => {
    setError("");
    setInfo("");
    setOtp("");
    setMode(nextMode);
    setStep(nextStep);
  };

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await fn();
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const finish = () => router.replace("/(tabs)");

  // ── Actions ──
  const handleSignIn = () =>
    run(async () => {
      if (!EMAIL_REGEX.test(trimmedEmail)) throw new Error("Please enter a valid email.");
      if (!password) throw new Error("Please enter your password.");
      await login(trimmedEmail, password);
      finish();
    });

  const handleSendSignupCode = () =>
    run(async () => {
      if (!USERNAME_REGEX.test(username.trim())) {
        throw new Error("Username must be 3–30 characters: letters, numbers, dots or underscores.");
      }
      if (!EMAIL_REGEX.test(trimmedEmail)) throw new Error("Please enter a valid email.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");
      await sendOTP(trimmedEmail, username.trim());
      setOtp("");
      setResendIn(RESEND_SECONDS);
      setStep(2);
    });

  const handleVerifySignup = (code = otp) =>
    run(async () => {
      if (code.length !== 6) throw new Error("Enter the 6-digit code.");
      await register(username.trim(), trimmedEmail, password, code);
      finish();
    });

  const handleSendResetCode = () =>
    run(async () => {
      if (!EMAIL_REGEX.test(trimmedEmail)) throw new Error("Please enter a valid email.");
      await authService.forgotPassword(trimmedEmail);
      setOtp("");
      setResendIn(RESEND_SECONDS);
      setStep(2);
    });

  const handleVerifyReset = (code = otp) =>
    run(async () => {
      if (code.length !== 6) throw new Error("Enter the 6-digit code.");
      await authService.verifyResetOTP(trimmedEmail, code);
      setPassword("");
      setConfirmPassword("");
      setStep(3);
    });

  const handleResetPassword = () =>
    run(async () => {
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");
      if (password !== confirmPassword) throw new Error("Passwords don't match.");
      await resetPassword(trimmedEmail, otp, password);
      finish();
    });

  const handleResend = () =>
    run(async () => {
      if (mode === "signup") await sendOTP(trimmedEmail, username.trim());
      else await authService.forgotPassword(trimmedEmail);
      setOtp("");
      setResendIn(RESEND_SECONDS);
      setInfo("A new code is on its way.");
    });

  // Submit automatically once all 6 digits are typed
  const onOtpChange = (value: string) => {
    setOtp(value);
    if (value.length === 6 && !busy) {
      if (mode === "signup") handleVerifySignup(value);
      else handleVerifyReset(value);
    }
  };

  const handleBack = () => {
    if (mode === "forgot" && step === 1) go("signin");
    else if (mode === "forgot" && step === 3) go("forgot", 2);
    else go(mode, step - 1);
  };

  const showTabs = step === 1 && mode !== "forgot";
  const showBack = !showTabs;

  // ── Render helpers ──
  const renderOtpStep = (onSubmit: () => void, cta: string) => (
    <>
      <OtpInput value={otp} onChange={onOtpChange} />
      <PrimaryButton title={cta} onPress={onSubmit} loading={busy} disabled={otp.length !== 6} />
      <View style={styles.resendRow}>
        <Text style={styles.mutedText}>Didn&apos;t get it? </Text>
        {resendIn > 0 ? (
          <Text style={styles.mutedText}>Resend in {resendIn}s</Text>
        ) : (
          <TextButton title="Resend code" onPress={handleResend} disabled={busy} />
        )}
      </View>
      <Text style={styles.hint}>Check your spam folder if it doesn&apos;t arrive within a minute.</Text>
    </>
  );

  const renderForm = () => {
    if (mode === "signin") {
      return (
        <>
          <Field
            label="Email"
            icon="mail-outline"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Field
            ref={passwordRef}
            label="Password"
            icon="lock-closed-outline"
            placeholder="Your password"
            secure
            autoCapitalize="none"
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={handleSignIn}
          />
          <View style={styles.forgotRow}>
            <TextButton title="Forgot password?" onPress={() => go("forgot")} />
          </View>
          <PrimaryButton title="Sign in" icon="arrow-forward" onPress={handleSignIn} loading={busy} />
        </>
      );
    }

    if (mode === "signup" && step === 1) {
      return (
        <>
          <Field
            label="Username"
            icon="at-outline"
            placeholder="your_name"
            autoCapitalize="none"
            autoComplete="username"
            value={username}
            onChangeText={setUsername}
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
          <Field
            ref={emailRef}
            label="Email"
            icon="mail-outline"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Field
            ref={passwordRef}
            label="Password"
            icon="lock-closed-outline"
            placeholder="At least 6 characters"
            secure
            autoCapitalize="none"
            autoComplete="new-password"
            value={password}
            onChangeText={setPassword}
            returnKeyType="go"
            onSubmitEditing={handleSendSignupCode}
          />
          <PasswordStrength password={password} />
          <PrimaryButton title="Continue" icon="arrow-forward" onPress={handleSendSignupCode} loading={busy} />
          <Text style={styles.hint}>We&apos;ll email you a code to verify it&apos;s really you.</Text>
        </>
      );
    }

    if (mode === "signup" && step === 2) {
      return renderOtpStep(() => handleVerifySignup(), "Verify & create account");
    }

    if (mode === "forgot" && step === 1) {
      return (
        <>
          <Field
            label="Email"
            icon="mail-outline"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoFocus
            value={email}
            onChangeText={setEmail}
            returnKeyType="send"
            onSubmitEditing={handleSendResetCode}
          />
          <PrimaryButton title="Send reset code" icon="paper-plane-outline" onPress={handleSendResetCode} loading={busy} />
          <View style={styles.resendRow}>
            <Text style={styles.mutedText}>Remembered it? </Text>
            <TextButton title="Back to sign in" onPress={() => go("signin")} />
          </View>
        </>
      );
    }

    if (mode === "forgot" && step === 2) {
      return renderOtpStep(() => handleVerifyReset(), "Verify code");
    }

    return (
      <>
        <Field
          ref={passwordRef}
          label="New password"
          icon="lock-closed-outline"
          placeholder="At least 6 characters"
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChangeText={setPassword}
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        <PasswordStrength password={password} />
        <Field
          ref={confirmRef}
          label="Confirm password"
          icon="shield-checkmark-outline"
          placeholder="Type it again"
          secure
          autoCapitalize="none"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          returnKeyType="go"
          onSubmitEditing={handleResetPassword}
        />
        <PrimaryButton title="Update password & sign in" onPress={handleResetPassword} loading={busy} />
      </>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={palette.bg} />
      <AuthBackground />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.topBar}>
              {showBack ? (
                <Pressable onPress={handleBack} hitSlop={10} style={styles.backButton}>
                  <Ionicons name="chevron-back" size={22} color={palette.text} />
                </Pressable>
              ) : (
                <View style={{ height: 40 }} />
              )}
            </View>

            <View style={styles.brandRow}>
              <BrandMark size={56} />
              <Text style={styles.brandName}>Fast Chat</Text>
            </View>

            <Animated.View
              style={{
                opacity: enter,
                transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              }}
            >
              <Text style={styles.title}>{copy.title}</Text>
              <Text style={styles.subtitle}>{copy.subtitle(trimmedEmail)}</Text>
            </Animated.View>

            <View style={styles.card}>
              {showTabs && (
                <View
                  style={styles.tabs}
                  onLayout={(e: LayoutChangeEvent) => setTabWidth((e.nativeEvent.layout.width - 8) / 2)}
                >
                  {tabWidth > 0 && (
                    <Animated.View
                      style={[
                        styles.tabPill,
                        {
                          width: tabWidth,
                          transform: [{ translateX: pill.interpolate({ inputRange: [0, 1], outputRange: [0, tabWidth] }) }],
                        },
                      ]}
                    />
                  )}
                  {(["signin", "signup"] as const).map((m) => (
                    <Pressable key={m} style={styles.tab} onPress={() => go(m)}>
                      <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                        {m === "signin" ? "Sign in" : "Sign up"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Animated.View
                style={{
                  opacity: enter,
                  transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                }}
              >
                <ErrorBanner message={error} />
                <InfoBanner message={info} />
                {renderForm()}
              </Animated.View>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 32 },

  topBar: { height: 48, justifyContent: "center" },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: palette.border,
  },

  brandRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8, marginBottom: 28 },
  brandName: { color: palette.text, fontSize: 22, fontWeight: "800", letterSpacing: 0.3 },

  title: { color: palette.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: palette.textMuted, fontSize: 15, lineHeight: 22, marginTop: 8 },

  card: {
    marginTop: 26,
    padding: 20,
    borderRadius: radius.xl,
    backgroundColor: "rgba(13, 19, 34, 0.82)",
    borderWidth: 1,
    borderColor: palette.border,
  },

  tabs: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 4,
  },
  tabPill: {
    position: "absolute",
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: 11,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.borderStrong,
  },
  tab: { flex: 1, height: 42, alignItems: "center", justifyContent: "center" },
  tabText: { color: palette.textMuted, fontSize: 15, fontWeight: "600" },
  tabTextActive: { color: palette.text },

  forgotRow: { alignItems: "flex-end", marginTop: 14 },

  resendRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 22 },
  mutedText: { color: palette.textMuted, fontSize: 14 },
  hint: { color: palette.textFaint, fontSize: 13, textAlign: "center", marginTop: 14, lineHeight: 19 },

});
