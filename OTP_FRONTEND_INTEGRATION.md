# OTP Verification Frontend Integration Guide

This guide outlines how to update your React Native application (`fast-chat-application`) to integrate the new OTP verification flow during user signup.

## Overview of the New Flow

1. **Step 1 (User Input)**: The user enters their `username`, `email`, and `password` on the signup screen. Instead of calling `register` directly, the app will call `POST /api/auth/send-otp`.
2. **Step 2 (OTP Entry)**: If the OTP is sent successfully, the UI transitions to an OTP input screen.
3. **Step 3 (Registration)**: The user enters the 6-digit OTP received via email and the app calls `POST /api/auth/register` with the `username`, `email`, `password`, and the `otp`.

---

## 1. Update API Service Functions

Update your authentication API service (likely in `/services/authService.ts` or similar) to include the new `sendOTP` request and update the `register` request:

```javascript
import axios from 'axios';

const API_URL = 'http://your-backend-url/api/auth'; // Replace with your actual backend URL

// 1. Send OTP to the user's email
export const sendOTP = async (email) => {
  try {
    const response = await axios.post(`${API_URL}/send-otp`, { email });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// 2. Register with OTP
export const registerUser = async (username, email, password, otp) => {
  try {
    const response = await axios.post(`${API_URL}/register`, {
      username,
      email,
      password,
      otp,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
```

---

## 2. Update Signup Screen Component

You'll need to manage the state to switch between the "Credentials Input" view and the "OTP Verification" view. Here is a conceptual example using React Native state:

```tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { sendOTP, registerUser } from '../services/authService'; // Adjust path

export default function SignupScreen({ navigation }) {
  // Form State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  
  // UI State
  const [step, setStep] = useState(1); // 1 = Details, 2 = OTP
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!username || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    setLoading(true);
    try {
      await sendOTP(email);
      Alert.alert('Success', 'OTP sent to your email!');
      setStep(2); // Move to OTP entry step
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndRegister = async () => {
    if (!otp) {
      Alert.alert('Error', 'Please enter the OTP');
      return;
    }
    
    setLoading(true);
    try {
      const result = await registerUser(username, email, password, otp);
      Alert.alert('Success', 'Registration successful!');
      
      // Navigate to your main app screen or save token
      // navigation.navigate('Home');
    } catch (error) {
      Alert.alert('Error', error.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {step === 1 ? (
        <View>
          <Text style={styles.title}>Sign Up</Text>
          <TextInput
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            style={styles.input}
          />
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />
          <Button 
            title={loading ? "Sending..." : "Send OTP"} 
            onPress={handleSendOTP} 
            disabled={loading} 
          />
        </View>
      ) : (
        <View>
          <Text style={styles.title}>Verify OTP</Text>
          <Text>An OTP has been sent to {email}</Text>
          <TextInput
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            style={styles.input}
            maxLength={6}
          />
          <Button 
            title={loading ? "Verifying..." : "Verify & Register"} 
            onPress={handleVerifyAndRegister} 
            disabled={loading} 
          />
          <Button 
            title="Go Back" 
            onPress={() => setStep(1)} 
            color="gray" 
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 15, borderRadius: 5 },
});
```

## Important Notes

1. **Environment Variables**: Don't forget to update your `.env` file in the **backend project (`fast-chat`)** with your actual email address:
   ```env
   EMAIL_USER=your-actual-email@gmail.com
   EMAIL_APP_PASSWORD=cbqe klgw radx ghtl
   ```
2. **OTP Expiry**: The OTP will automatically expire and be deleted from the database after 5 minutes.
3. **Resend OTP**: If you need a "Resend OTP" button, simply call the `handleSendOTP` function again from Step 2.
