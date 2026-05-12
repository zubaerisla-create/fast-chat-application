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
};

export default uploadService;
