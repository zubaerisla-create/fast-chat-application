import { Platform } from "react-native";
import apiClient from "@/utils/apiClient";

export interface UploadResponse {
  success: boolean;
  url: string;
  publicId: string;
  fileType: string;
  fileName: string;
  fileSize: number;
}

const uploadService = {
  /**
   * Upload a file to the backend (Cloudinary)
   */
  uploadFile: async (uri: string, name: string = "file"): Promise<UploadResponse> => {
    try {
      const formData = new FormData();
      
      // Clean URI for Android if necessary
      const cleanUri = Platform.OS === "android" ? uri : uri.replace("file://", "");
      
      // Get file extension and determine MIME type
      const uriParts = uri.split('.');
      const fileExt = uriParts[uriParts.length - 1].toLowerCase();
      
      let mimeType = "application/octet-stream";
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
        mimeType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
      } else if (['m4a', 'mp3', 'wav', 'aac', 'ogg'].includes(fileExt)) {
        mimeType = `audio/mpeg`; // More standard for Cloudinary/Multer
      } else if (['mp4', 'mov', 'avi'].includes(fileExt)) {
        mimeType = `video/${fileExt}`;
      }
      
      formData.append("file", {
        uri: cleanUri,
        name: `${name}.${fileExt}`,
        type: mimeType,
      } as any);

      // Force multipart/form-data for this request to override default application/json
      const response = await apiClient.post("/upload", formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        // Important for some Axios versions when sending FormData
        transformRequest: (data) => data,
      });



      return response.data;
    } catch (error) {
      console.error("Upload service error:", error);
      throw error;
    }
  },

  /**
   * Delete an uploaded file directly from Cloudinary
   */
  deleteFile: async (publicId: string, fileType: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiClient.post("/upload/delete", {
        publicId,
        fileType,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to delete uploaded file",
      );
    }
  },
};

export default uploadService;
