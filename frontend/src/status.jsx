/**
 * BẢNG KIỂM TRA TÌNH TRẠNG
 *
 * Ai cũng mở được, không cần đăng nhập, bấm từ chân trang.
 *
 * Mục đích: khi có sự cố, người dùng chỉ cần chụp một màn hình này gửi người phụ
 * trách là đủ thông tin để tìm nguyên nhân — thay vì mô tả "bấm không thấy gì".
 */
import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, X, XCircle } from "lucide-react";

import { API_CAN_CO, api } from "./api";
import { BUILD_ID } from "./build";
import { dsLoi, theoDoiLoi } from "./errors";
import { RED, RED_DARK } from "./ui";

const OK = "#0A7A50";

function Dong({ nhan, dat, giaTri, ghiChu }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0",
                  borderTop: "1px solid #F1EEEF" }}>
      {dat
        ? <CheckCircle2 size={17} style={{ color: OK, flexShrink: 0, marginTop: 1 }} />
        : <XCircle size={17} style={{ color: RED, flexShrink: 0, marginTop: 1 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600 }}>{nhan}</p>
        <p className="mono" style={{ fontSize: 12, color: dat ? "#807A7C" : RED_DARK,
                                     marginTop: 2, wordBreak: "break-all" }}>
          {giaTri}
        </p>
        {!dat && ghiChu && (
          <p style={{ fontSize: 12.5, color: "#6B5426", marginTop: 5, lineHeight: 1.55 }}>{ghiChu}</p>
        )}
      </div>
    </div>
  );
}

export function BangKiemTra({ onClose }) {
  const [tt, setTt] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState(dsLoi());

  const kiemTra = () => {
    setDangTai(true);
    fetch("/api/health")
      .then((r) => r.json().then((d) => ({ ok: r.ok, ...d })))
      .catch((e) => ({ ok: false, loiMang: e.message }))
      .then((d) => { setTt(d); setDangTai(false); });
  };

  useEffect(kiemTra, []);
  useEffect(() => theoDoiLoi(setLoi), []);

  const coMayChu = tt && tt.ok && tt.status === "ok";
  const cungBan = tt?.build === BUILD_ID;
  const duPhienBan = (tt?.api_version || 0) >= API_CAN_CO;

  const chep = () => {
    const noiDung = [
      `Giao diện: ${BUILD_ID}`,
      `Máy chủ: ${tt?.build || "không rõ"}`,
      `api_version: ${tt?.api_version || "không rõ"} (cần ${API_CAN_CO})`,
      `Cơ sở dữ liệu: ${tt?.database || "không rõ"}`,
      `Khởi động: ${tt?.startup_ok === false ? "có lỗi" : "bình thường"}`,
      ...(tt?.startup_errors || []).map((e) => `  - ${e.buoc}: ${e.loi}`),
      `Lỗi giao diện đã ghi nhận: ${loi.length}`,
      ...loi.slice(0, 5).map((e) => `  - [${e.luc}] ${e.nguon}: ${e.thongDiep}`),
      `Trình duyệt: ${navigator.userAgent}`,
    ].join("\n");
    navigator.clipboard?.writeText(noiDung).then(
      () => window.alert("Đã sao chép. Dán vào tin nhắn gửi người phụ trách."),
      () => window.alert(noiDung)
    );
  };

  return (
    <div className="sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: "min(620px,100%)", maxHeight: "92vh",
                                     display: "flex", flexDirection: "column", borderRadius: 16 }}>
        <div className="card-h">
          <span className="card-t">Kiểm tra tình trạng hệ thống</span>
          <button className="btn btn-sm" onClick={onClose}><X size={15} /> Đóng</button>
        </div>

        <div style={{ overflowY: "auto", padding: 18 }}>
          {dangTai ? (
            <p className="muted" style={{ fontSize: 13.5 }}>
              <Loader2 size={14} className="spin" style={{ display: "inline", marginRight: 6 }} />
              Đang kiểm tra…
            </p>
          ) : (
            <>
              <Dong nhan="Kết nối tới máy chủ" dat={coMayChu}
                giaTri={coMayChu ? "Bình thường" : (tt?.loiMang || "Không gọi được máy chủ")}
                ghiChu="Phần xử lý dữ liệu chưa chạy, hoặc mất mạng. Thử tải lại trang." />

              <Dong nhan="Cơ sở dữ liệu" dat={tt?.database === "ok"}
                giaTri={tt?.database === "ok" ? "Bình thường" : (tt?.database_error || "Chưa nối được")}
                ghiChu="Máy chủ sống nhưng chưa nối được cơ sở dữ liệu. Báo người phụ trách." />

              <Dong nhan="Khởi động máy chủ" dat={tt?.startup_ok !== false}
                giaTri={tt?.startup_ok === false
                  ? (tt.startup_errors || []).map((e) => `${e.buoc}: ${e.loi}`).join(" | ")
                  : "Hoàn tất, không có lỗi"}
                ghiChu="Một bước chuẩn bị bị lỗi. Một số chức năng có thể không dùng được." />

              <Dong nhan="Phiên bản giao diện và máy chủ" dat={cungBan}
                giaTri={`Giao diện ${BUILD_ID} · Máy chủ ${tt?.build || "không rõ"}`
                        + (tt?.deploy_label ? ` · nhãn môi trường: ${tt.deploy_label}` : "")}
                ghiChu={"Hai phần đang lệch bản. Thường do nền tảng còn chạy song song nhiều phiên bản cũ. "
                        + "Vào bảng điều khiển, xoá các phiên bản cũ chỉ giữ bản mới nhất, rồi tải lại trang."} />

              <Dong nhan="Phiên bản API" dat={duPhienBan}
                giaTri={`Máy chủ ${tt?.api_version || "không rõ"} · Giao diện cần từ ${API_CAN_CO}`}
                ghiChu="Máy chủ cũ hơn giao diện. Một số nút bấm sẽ báo Not Found." />

              <Dong nhan="Lỗi giao diện đã ghi nhận" dat={loi.length === 0}
                giaTri={loi.length === 0 ? "Không có" : `${loi.length} lỗi`}
                ghiChu="Có lỗi JavaScript. Đây thường là lý do bấm vào không có phản hồi." />

              {loi.length > 0 && (
                <div style={{ marginTop: 12, background: "#FBF4F5", border: "1px solid #EFD8DC",
                              borderRadius: 10, padding: 12 }}>
                  {loi.slice(0, 5).map((e, i) => (
                    <div key={i} style={{ paddingTop: i ? 8 : 0, marginTop: i ? 8 : 0,
                                          borderTop: i ? "1px solid #EFD8DC" : 0 }}>
                      <p className="mono" style={{ fontSize: 11, color: "#9E0C24" }}>
                        [{e.luc}] {e.nguon}
                      </p>
                      <p style={{ fontSize: 12.5, color: "#6B4A50", marginTop: 2 }}>{e.thongDiep}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2" style={{ marginTop: 20, flexWrap: "wrap" }}>
                <button className="btn btn-red" onClick={chep}>
                  Sao chép để gửi người phụ trách
                </button>
                <button className="btn" onClick={kiemTra}>
                  <RefreshCw size={14} /> Kiểm tra lại
                </button>
                <button className="btn" onClick={() => window.location.reload()}>
                  Tải lại trang
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
