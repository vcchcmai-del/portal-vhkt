import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Mọi lời gọi /api sẽ được chuyển sang backend, khỏi lo lỗi CORS khi chạy máy cá nhân.
    proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true } },
  },
  build: {
    rollupOptions: {
      output: {
        // Tách thư viện bên ngoài (React, icon...) khỏi code của ứng dụng.
        // Thư viện gần như không đổi giữa các lần phát hành, còn code ứng dụng
        // đổi liên tục — tách riêng thì trình duyệt dùng lại được bản đã tải
        // trước đó cho phần thư viện, chỉ tải lại phần thật sự đổi.
        manualChunks(id) {
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
});
