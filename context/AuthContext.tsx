import authService, { User } from "@/services/authService";
import socketService from "@/services/socketService";
import React, { createContext, useContext, useEffect, useState } from "react";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
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
        setUser(storedUser);
        setIsAuthenticated(true);
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
    } catch (error) {
      setIsAuthenticated(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
  ) => {
    try {
      setIsLoading(true);
      const { user: newUser } = await authService.register(
        username,
        email,
        password,
      );
      setUser(newUser);
      setIsAuthenticated(true);
      // Connect socket and notify online after registration
      await socketService.connect();
      const userId = newUser.id || newUser._id;
      if (userId) socketService.notifyOnline(userId.toString());
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
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
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
