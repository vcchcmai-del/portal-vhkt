import React, { useEffect, useState } from "react";
import { AlertTriangle, CalendarCheck, PenLine } from "lucide-react";
import { api, getUser } from "./api";

/*
 * Bảng điều hành ngày trên trang chủ: 13 cụm, mỗi cụm một ô, nhìn 10 giây biết
 * phải gọi ai.
 *
 * Đọc lại đúng API mà tab Kế hoạch ngày đang dùng — không thêm endpoint tổng
 * hợp riêng, để hai màn hình không bao giờ nói hai con số khác nhau.
 *
 * Khối này tự ẩn khi chưa đăng nhập hoặc khi gọi API hỏng: trang chủ là thứ
 * mọi người mở đầu tiên, một lỗi ở đây không được phép làm trắng cả trang.
 */

const MAU = { do: "#C8102E", vang: "#C97A07", xanh: "#0A7A50", xam: "#8A8284" };

function OCum({ c, onMo }) {
  const chuaDK = !c.dang_ky;
  const mau = chuaDK ? MAU.do : c.tram_xong >= c.tong_tram && c.tong_tram ? MAU.xanh : MAU.vang;
  return (
    <button type="button" onClick={onMo} title={chuaDK ? "Chưa đăng ký kế hoạch hôm nay" : c.ghi_chu || ""}
      style={{
        textAlign: "left", background: "#fff", border: "1px solid #ECE8E9", borderRadius: 10,
        borderLeft: `3px solid ${mau}`, padding: "8px 10px", cursor: "pointer", color: "inherit",
      }}>
      <div style={{ fontWeight: 800, fontSize: 13 }}>{c.center}</div>
      {chuaDK ? (
        <div style={{ fontSize: 11.5, color: MAU.do, fontWeight: 700 }}>Chưa đăng ký</div>
      ) : (
        <>
          <div style={{ fontSize: 11.5, color: "#5A6472" }}>
            Trực {c.ft_truc}{c.ft_nghi ? ` · nghỉ ${c.ft_nghi}` : ""}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: mau }}>
            {c.tram_xong}/{c.tong_tram} trạm
          </div>
        </>
      )}
    </button>
  );
}

/**
 * Nút đăng ký đặt ở góc phải đầu trang chủ, ngay trên dòng ngày tháng.
 *
 * Tách khỏi bảng điều hành bên dưới vì bảng đó chỉ hiện khi gọi được API và có
 * cụm; nút thì phải luôn ở đúng một chỗ cố định để người đăng ký hằng ngày
 * biết bấm vào đâu, không phải đi tìm.
 */
export function NutDangKyNgay({ onGo }) {
  if (!getUser()) return null;
  return (
    <button className="btn btn-sm btn-red" onClick={() => onGo?.("tech-tasks", "kehoach")}
      title="Mở màn hình đăng ký, rồi chọn trung tâm cần đăng ký">
      <PenLine size={13} />Đăng ký kế hoạch ngày
    </button>
  );
}

export function BangDieuHanhNgay({ onGo }) {
  const [data, setData] = useState(null);
  const [an, setAn] = useState(!getUser());

  useEffect(() => {
    if (an) return;
    const ngay = new Date();
    const iso = `${ngay.getFullYear()}-${String(ngay.getMonth() + 1).padStart(2, "0")}-${String(ngay.getDate()).padStart(2, "0")}`;
    api.get(`/api/admin/ke-hoach-ngay?ngay=${iso}`).then(setData).catch(() => setAn(true));
  }, [an]);

  if (an || !data) return null;

  const daDK = (data.danh_sach || []).map((r) => ({
    center: r.center, dang_ky: true, ft_truc: r.ft_truc, ft_nghi: r.ft_nghi,
    tong_tram: r.tong_tram, tram_xong: r.tram_xong, ghi_chu: r.ghi_chu,
  }));
  const chua = (data.chua_dang_ky || []).map((c) => ({ center: c.center, dang_ky: false }));
  const ds = [...chua, ...daDK];           // chưa đăng ký lên trước, đó là việc phải xử lý
  if (!ds.length) return null;

  const tongTram = daDK.reduce((a, r) => a + (r.tong_tram || 0), 0);
  const tramXong = daDK.reduce((a, r) => a + (r.tram_xong || 0), 0);
  const tongTruc = daDK.reduce((a, r) => a + (r.ft_truc || 0), 0);

  return (
    <section className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="flex items-center gap-2"
        style={{ padding: "10px 14px", borderBottom: "1px solid #F1EEEF", flexWrap: "wrap" }}>
        <CalendarCheck size={16} style={{ color: MAU.do }} />
        <b style={{ fontSize: 13.5 }}>Điều hành ngày {data.ngay}</b>
        <span style={{ fontSize: 12.5, color: chua.length ? MAU.do : MAU.xanh, fontWeight: 700 }}>
          {data.da_dang_ky}/{data.tong_cum} cụm đã đăng ký
        </span>
        {!!chua.length && (
          <span style={{ fontSize: 12.5, color: MAU.do }}>
            <AlertTriangle size={13} /> {chua.map((c) => c.center).join(", ")} chưa đăng ký
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 12 }}>
          {tongTruc} FT trực · {tramXong}/{tongTram} trạm xong
        </span>
      </div>
      <div style={{ padding: 12, display: "grid", gap: 8,
                    gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))" }}>
        {ds.map((c) => <OCum key={c.center} c={c} onMo={() => onGo?.("tech-tasks", "kehoach")} />)}
      </div>
    </section>
  );
}
