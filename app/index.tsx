import { useAuth } from "@/context/AuthContext";
import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading while checking authentication state
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F172A" }}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  // If the user is not authenticated, redirect to the Signup/Login screen
  if (!isAuthenticated) {
    return <Redirect href="/screens/auth/SignupScreen" />;
  }

  // If the user is authenticated, redirect to the main Home (Tabs) screen
  return <Redirect href="/(tabs)" />;
}
