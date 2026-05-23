/**
 * Formats a date string for the conversation list (Messenger style).
 * - Today: "10:30 AM"
 * - Yesterday: "Yesterday"
 * - Within 7 days: "Wed"
 * - Older: "May 15"
 */
export const formatConversationTime = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (compareDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
    } else if (compareDate.getTime() === yesterday.getTime()) {
      return "Yesterday";
    } else if (compareDate.getTime() > oneWeekAgo.getTime()) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  } catch (error) {
    console.error("Error formatting conversation time:", error);
    return "";
  }
};

/**
 * Formats a date string for a specific message's full details (Messenger style).
 * - Today: "Today 10:30 AM"
 * - Yesterday: "Yesterday 10:30 AM"
 * - Within 7 days: "Wednesday 10:30 AM"
 * - Older: "May 15, 2026, 10:30 AM"
 */
export const formatMessageFullTimestamp = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });

    if (compareDate.getTime() === today.getTime()) {
      return `Today ${timeStr}`;
    } else if (compareDate.getTime() === yesterday.getTime()) {
      return `Yesterday ${timeStr}`;
    } else if (compareDate.getTime() > oneWeekAgo.getTime()) {
      const weekday = date.toLocaleDateString([], { weekday: "long" });
      return `${weekday} ${timeStr}`;
    } else {
      const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
      return `${dateStr}, ${timeStr}`;
    }
  } catch (error) {
    console.error("Error formatting message full timestamp:", error);
    return "";
  }
};

/**
 * Formats a date string for the group separator in the chat view.
 * - Today: "Today"
 * - Yesterday: "Yesterday"
 * - Older: "Wednesday, May 20, 2026"
 */
export const formatChatSeparatorDate = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const compareDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (compareDate.getTime() === today.getTime()) {
      return "Today";
    } else if (compareDate.getTime() === yesterday.getTime()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  } catch (error) {
    console.error("Error formatting chat separator date:", error);
    return "";
  }
};
