import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ErrorBoundary, batLoiToanCuc } from "./errors.jsx";
import "./index.css";

// Bắt các lỗi xảy ra ngoài React để hiện được trong bảng kiểm tra
batLoiToanCuc();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
