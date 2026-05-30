// @ts-nocheck
import messaging from '@react-native-firebase/messaging';
import RNCallKeep from 'react-native-callkeep';
import { Platform } from 'react-native';
import VoipPushNotification from 'react-native-voip-push-notification';

// Options for react-native-callkeep
export const callKeepOptions = {
  ios: {
    appName: 'FastChat',
    includesCallsInRecents: false,
  },
  android: {
    alertTitle: 'Permissions required',
    alertDescription: 'This application needs to access your phone accounts',
    cancelButton: 'Cancel',
    okButton: 'ok',
    imageName: 'phone_account_icon',
    additionalPermissions: [
      'android.permission.READ_PHONE_STATE',
      'android.permission.MANAGE_OWN_CALLS'
    ],
    foregroundService: {
      channelId: 'com.zubaer_official.fastchatapp.calls',
      channelName: 'Foreground service for calls',
      notificationTitle: 'FastChat is running in background',
    },
  }
};

// Initialize RNCallKeep
export const setupCallKeep = () => {
  try {
    RNCallKeep.setup(callKeepOptions).then(accepted => {
      console.log('[CallKeep] Setup accepted:', accepted);
    });
    if (Platform.OS === 'android') {
      RNCallKeep.setAvailable(true);
    }
  } catch (err) {
    console.error('[CallKeep] Error initializing:', err);
  }
};

// Handle background FCM messages (Android)
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('[FCM] Message handled in the background!', remoteMessage);
  
  if (remoteMessage.data && remoteMessage.data.type === 'voip_call') {
    const callerName = remoteMessage.data.callerName || 'Unknown Caller';
    const uuid = remoteMessage.data.uuid || 'unknown-uuid';
    const hasVideo = remoteMessage.data.callType === 'video';

    // Display the incoming call UI
    RNCallKeep.displayIncomingCall(
      uuid,
      'FastChat',
      callerName,
      'number',
      hasVideo
    );
  }
});

// Handle iOS VoIP Pushes
if (Platform.OS === 'ios') {
  VoipPushNotification.addEventListener('notification', (notification) => {
    console.log('[VoIP Push] Received notification:', notification);
    const { uuid, callerName, hasVideo } = notification;
    
    RNCallKeep.displayIncomingCall(
      uuid,
      'FastChat',
      callerName || 'Unknown Caller',
      'number',
      hasVideo === 'true'
    );
  });
}
