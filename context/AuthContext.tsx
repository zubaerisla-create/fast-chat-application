import { clearPushToken, registerForPushNotifications } from "@/hooks/usePushNotifications";
import authService, { User } from "@/services/authService";
import socketService from "@/services/socketService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  sendOTP: (email: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
    otp: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  onlineUsers: string[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  // Check authentication on mount
  useEffect(() => {
    checkAuthentication();

    // Listen for online users
    const unsubscribeOnline = socketService.on("onlineUsersChanged", (users: string[]) => {
      setOnlineUsers(users);
    });

    return () => {
      unsubscribeOnline();
    };
  }, []);

  // Connect socket and notify online status when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const userId = user.id || user._id;
      // First connect, THEN notify online — socket must exist before emitting
      socketService.connect().then(() => {
        if (userId) {
          socketService.notifyOnline(userId.toString());
        }
      });
    }
  }, [isAuthenticated, user]);

  const checkAuthentication = async () => {
    try {
      const storedUser = await authService.getUser();
      const token = await authService.getToken();

      if (storedUser && token) {
        // Set the cached user instantly to avoid UI lag
        setUser(storedUser);
        setIsAuthenticated(true);

        // Register push token now that we have a valid auth token in AsyncStorage
        registerForPushNotifications().catch(err =>
          console.warn("Push token registration failed on startup:", err)
        );

        // Fetch fresh user profile from backend to sync any updates (e.g., avatar changes)
        const userId = storedUser.id || storedUser._id;
        if (userId) {
          try {
            const usersService = require("@/services/usersService").default;
            const freshUser = await usersService.getUserProfile(userId.toString());
            if (freshUser) {
              const updatedUserData = {
                ...storedUser,
                username: freshUser.username,
                email: freshUser.email,
                avatar: freshUser.avatar,
              };
              setUser(updatedUserData);
              await AsyncStorage.setItem("user", JSON.stringify(updatedUserData));
            }
          } catch (fetchError) {
            console.warn("Failed to fetch fresh user profile on startup:", fetchError);
          }
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Auth check error:", error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const { user: loggedInUser } = await authService.login(email, password);
      setUser(loggedInUser);
      setIsAuthenticated(true);
      // Connect socket and notify online after login
      await socketService.connect();
      const userId = loggedInUser.id || loggedInUser._id;
      if (userId) socketService.notifyOnline(userId.toString());
      // Register push token — auth token is now in AsyncStorage
      registerForPushNotifications().catch(err =>
        console.warn("Push token registration failed after login:", err)
      );
    } catch (error) {
      setIsAuthenticated(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const sendOTP = async (email: string) => {
    try {
      setIsLoading(true);
      await authService.sendOTP(email);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    otp: string,
  ) => {
    try {
      setIsLoading(true);
      const { user: newUser } = await authService.register(
        username,
        email,
        password,
        otp,
      );
      setUser(newUser);
      setIsAuthenticated(true);
      // Connect socket and notify online after registration
      await socketService.connect();
      const userId = newUser.id || newUser._id;
      if (userId) socketService.notifyOnline(userId.toString());
      // Register push token — auth token is now in AsyncStorage
      registerForPushNotifications().catch(err =>
        console.warn("Push token registration failed after register:", err)
      );
    } catch (error) {
      setIsAuthenticated(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (idToken: string) => {
    try {
      setIsLoading(true);
      const { user: loggedInUser } = await authService.googleLogin(idToken);
      setUser(loggedInUser);
      setIsAuthenticated(true);

      await socketService.connect();
      const userId = loggedInUser.id || loggedInUser._id;
      if (userId) socketService.notifyOnline(userId.toString());

      registerForPushNotifications().catch(err =>
        console.warn("Push token registration failed after Google login:", err)
      );
    } catch (error) {
      setIsAuthenticated(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      socketService.disconnect();
      // Remove push token from backend before clearing local session
      await clearPushToken();
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async (updatedUser: User) => {
    setUser(updatedUser);
    try {
      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
    } catch (error) {
      console.error("Failed to update user in storage:", error);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    sendOTP,
    login,
    googleLogin,
    register,
    logout,
    updateUser,
    onlineUsers,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
