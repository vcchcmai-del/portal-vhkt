/**
 * BẮT LỖI GIAO DIỆN
 *
 * Vấn đề cần giải quyết: khi giao diện gặp lỗi JavaScript, React ngừng xử lý sự kiện.
 * Nội dung đã vẽ vẫn nằm trên màn hình nên nhìn như bình thường, nhưng bấm vào đâu
 * cũng không có phản hồi. Người dùng không biết đang hỏng, càng không biết hỏng ở đâu.
 *
 * Ba lớp bảo vệ:
 *   1. ErrorBoundary  — bắt lỗi khi vẽ giao diện, hiện màn hình báo lỗi đọc được.
 *   2. batLoiToanCuc  — bắt lỗi ngoài React (sự kiện, lời hứa bị từ chối).
 *   3. BangKiemTra    — bảng tra cứu tình trạng, ai cũng mở được, không cần đăng nhập.
 */
import React from "react";

/* ------------------------------------------------------------------ *
 * Kho lỗi: giữ lại các lỗi đã xảy ra để hiển thị trong bảng kiểm tra
 * ------------------------------------------------------------------ */

const KHO_LOI = [];
const NGHE = new Set();

export function ghiLoi(nguon, thongDiep, chiTiet) {
  const muc = {
    luc: new Date().toLocaleTimeString("vi-VN"),
    nguon,
    thongDiep: String(thongDiep || "").slice(0, 400),
    chiTiet: String(chiTiet || "").slice(0, 1200),
  };
  KHO_LOI.unshift(muc);
  if (KHO_LOI.length > 20) KHO_LOI.pop();
  NGHE.forEach((fn) => { try { fn([...KHO_LOI]); } catch { /* bỏ qua */ } });
}

export function dsLoi() { return [...KHO_LOI]; }

export function theoDoiLoi(fn) {
  NGHE.add(fn);
  return () => NGHE.delete(fn);
}

/** Bắt các lỗi xảy ra ngoài phạm vi React. Gọi một lần khi khởi động. */
export function batLoiToanCuc() {
  window.addEventListener("error", (e) => {
    ghiLoi("JavaScript", e.message, `${e.filename || ""}:${e.lineno || ""}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    ghiLoi("Tác vụ nền", r?.message || String(r), r?.stack || "");
  });
}

/* ------------------------------------------------------------------ *
 * Màn hình báo lỗi khi giao diện không vẽ được
 * ------------------------------------------------------------------ */

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { loi: null, chiTiet: null };
  }

  static getDerivedStateFromError(loi) {
    return { loi };
  }

  componentDidCatch(loi, info) {
    ghiLoi("Giao diện", loi?.message || String(loi), info?.componentStack || loi?.stack || "");
  }

  render() {
    if (!this.state.loi) return this.props.children;

    const loi = this.state.loi;
    return (
      <div style={{ minHeight: "100vh", background: "#FAF9F9", display: "grid",
                    placeItems: "center", padding: 24,
                    fontFamily: "'Be Vietnam Pro', system-ui, sans-serif" }}>
        <div style={{ maxWidth: 620, background: "#fff", border: "1px solid #E7E3E4",
                      borderRadius: 16, padding: 28 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "#FBF4F5",
                        display: "grid", placeItems: "center", fontSize: 24 }}>⚠</div>

          <h1 style={{ fontSize: 20, fontWeight: 800, marginTop: 16, color: "#1C1A1B" }}>
            Giao diện gặp lỗi và đã dừng
          </h1>
          <p style={{ fontSize: 14, color: "#4B4749", marginTop: 10, lineHeight: 1.65 }}>
            Trang không hiển thị tiếp được. Đây là lỗi phía giao diện, dữ liệu của bạn
            trên máy chủ không bị ảnh hưởng.
          </p>

          <div style={{ background: "#FBF4F5", border: "1px solid #EFD8DC", borderRadius: 10,
                        padding: 14, marginTop: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#9E0C24" }}>Nội dung lỗi</p>
            <p style={{ fontSize: 12.5, color: "#6B4A50", marginTop: 6,
                        fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-word" }}>
              {loi?.message || String(loi)}
            </p>
          </div>

          <p style={{ fontSize: 13, color: "#4B4749", marginTop: 16, lineHeight: 1.65 }}>
            Bấm <strong>Tải lại trang</strong> để dùng tiếp. Nếu lặp lại nhiều lần,
            chụp màn hình này gửi người phụ trách — nội dung lỗi ở trên cho biết
            hỏng ở đâu.
          </p>

          <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
            <button onClick={() => window.location.reload()}
              style={{ background: "#C8102E", color: "#fff", border: 0, borderRadius: 10,
                       padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer",
                       fontFamily: "inherit" }}>
              Tải lại trang
            </button>
            <button onClick={() => {
                try { localStorage.clear(); } catch { /* bỏ qua */ }
                window.location.reload();
              }}
              style={{ background: "#fff", color: "#1C1A1B", border: "1px solid #E7E3E4",
                       borderRadius: 10, padding: "10px 18px", fontWeight: 600, fontSize: 14,
                       cursor: "pointer", fontFamily: "inherit" }}>
              Xoá dữ liệu tạm rồi tải lại
            </button>
          </div>
        </div>
      </div>
    );
  }
}
