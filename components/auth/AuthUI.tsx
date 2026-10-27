import { gradients, palette, radius } from "@/constants/design";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { forwardRef, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

/**
 * Deep background with two soft color glows.
 */
export function AuthBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg }]} />
      <LinearGradient colors={gradients.glowViolet} style={styles.glowTop} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
      <LinearGradient colors={gradients.glowBlue} style={styles.glowBottom} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }} />
    </View>
  );
}

/**
 * App mark: gradient tile with a chat glyph.
 */
export function BrandMark({ size = 64 }: { size?: number }) {
  return (
    <View style={[styles.brandShadow, { borderRadius: size * 0.32 }]}>
      <LinearGradient
        colors={gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: size * 0.32, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name="chatbubble-ellipses" size={size * 0.48} color="#fff" />
      </LinearGradient>
    </View>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  secure?: boolean;
};

/**
 * Labeled text field with leading icon, focus ring and optional show/hide toggle.
 */
export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, icon, secure, style, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.field, focused && styles.fieldFocused]}>
        <Ionicons name={icon} size={19} color={focused ? palette.accent : palette.textFaint} style={{ marginRight: 10 }} />
        <TextInput
          ref={ref}
          placeholderTextColor={palette.textFaint}
          selectionColor={palette.accent}
          secureTextEntry={secure && hidden}
          autoCorrect={false}
          {...props}
          style={[styles.fieldInput, style]}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
        />
        {secure && (
          <Pressable hitSlop={12} onPress={() => setHidden((h) => !h)}>
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={palette.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );
});

/**
 * Gradient call-to-action button with loading state.
 */
export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      disabled={inactive}
      style={({ pressed }) => [styles.buttonShadow, { opacity: inactive ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      {({ pressed }) => (
        <LinearGradient
          colors={pressed ? gradients.primaryPressed : gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.button}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.buttonText}>{title}</Text>
              {icon && <Ionicons name={icon} size={18} color="#fff" style={{ marginLeft: 8 }} />}
            </>
          )}
        </LinearGradient>
      )}
    </Pressable>
  );
}

export function TextButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8}>
      {({ pressed }) => (
        <Text style={[styles.textButton, { opacity: disabled ? 0.45 : pressed ? 0.6 : 1 }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="alert-circle" size={18} color={palette.danger} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function InfoBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <View style={styles.infoBanner}>
      <Ionicons name="checkmark-circle" size={18} color={palette.success} />
      <Text style={styles.infoText}>{message}</Text>
    </View>
  );
}

/**
 * Six separate digit boxes backed by one hidden input.
 */
export function OtpInput({ value, onChange, length = 6 }: { value: string; onChange: (v: string) => void; length?: number }) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.otpRow}>
      {Array.from({ length }).map((_, i) => {
        const char = value[i] || "";
        const active = focused && (i === value.length || (i === length - 1 && value.length === length));
        return (
          <View key={i} style={[styles.otpBox, char && styles.otpBoxFilled, active && styles.otpBoxActive]}>
            <Text style={styles.otpChar}>{char}</Text>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.otpHidden}
        caretHidden
      />
    </Pressable>
  );
}

/**
 * 4-segment password strength meter.
 */
export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  let score = 0;
  if (password.length >= 6) {
    score = 1;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  }
  const labels = ["Too short", "Weak", "Okay", "Good", "Strong"];
  const colors = [palette.danger, palette.danger, palette.warning, palette.success, palette.success];

  return (
    <View style={styles.strengthWrap}>
      <View style={styles.strengthBars}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.strengthBar, { backgroundColor: i < score ? colors[score] : palette.border }]} />
        ))}
      </View>
      <Text style={[styles.strengthLabel, { color: colors[score] }]}>{labels[score]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  glowTop: { position: "absolute", top: -160, left: -120, width: 460, height: 460, borderRadius: 230 },
  glowBottom: { position: "absolute", bottom: -200, right: -160, width: 480, height: 480, borderRadius: 240 },

  brandShadow: {
    shadowColor: "#7C5CFF",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },

  fieldWrap: { marginTop: 16 },
  fieldLabel: { color: palette.textMuted, fontSize: 13, fontWeight: "600", marginBottom: 8, marginLeft: 2 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: palette.bgElevated,
    borderWidth: 1,
    borderColor: palette.border,
  },
  fieldFocused: { borderColor: palette.accent, backgroundColor: palette.surface },
  fieldInput: { flex: 1, color: palette.text, fontSize: 16, height: "100%" },

  buttonShadow: {
    marginTop: 28,
    borderRadius: radius.md,
    shadowColor: "#6A5CFF",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  button: { height: 56, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700", letterSpacing: 0.2 },

  textButton: { color: palette.accent, fontSize: 14, fontWeight: "600" },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: palette.dangerSoft,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.25)",
  },
  errorText: { flex: 1, color: "#FCA5A5", fontSize: 14, fontWeight: "500" },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: "rgba(52, 211, 153, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.25)",
  },
  infoText: { flex: 1, color: "#6EE7B7", fontSize: 14, fontWeight: "500" },

  otpRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
  otpBox: {
    width: 48,
    height: 58,
    borderRadius: radius.md,
    backgroundColor: palette.bgElevated,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  otpBoxFilled: { borderColor: palette.borderStrong, backgroundColor: palette.surface },
  otpBoxActive: { borderColor: palette.accent, borderWidth: 1.5 },
  otpChar: { color: palette.text, fontSize: 24, fontWeight: "700" },
  otpHidden: { position: "absolute", width: 1, height: 1, opacity: 0 },

  strengthWrap: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 10 },
  strengthBars: { flex: 1, flexDirection: "row", gap: 6 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: "600", width: 70, textAlign: "right" },
});
