/**
 * Các phân hệ người dùng thường xem.
 * Dữ liệu lấy từ API, nếu API chưa sẵn sàng thì dùng dữ liệu dự phòng trong data.js
 */
import React, { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, Award, BarChart3, BookOpen, Building2, Cake, Calendar,
  Check, ChevronLeft, ChevronRight, Clock, CloudRain, Download, Droplets, FileText, Hash,
  Image as ImageIcon, Lightbulb, Lock, MapPin, Megaphone, MessageSquare, PartyPopper,
  Plus, Rocket, Send, Signal, Star, ThumbsUp, TrendingUp, Trophy, UserPlus, Users,
  Video, Wind, Wrench, X, Quote, Pin,
  Activity, CalendarDays, ClipboardList, Coins, ShieldCheck,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend,
  Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { api, adapt, useRemote } from "./api";
import * as D from "./data";
import { Avatar, Card, Check as CheckBox, Delta, Empty, RED, RED_DARK, initials, norm, tooltipStyle } from "./ui";

/* ============================== TRANG CHỦ ============================== */

function Weather() {
  const hours = [
    { h: "14h", r: 20 }, { h: "15h", r: 65 }, { h: "16h", r: 85 },
    { h: "17h", r: 70 }, { h: "18h", r: 40 }, { h: "19h", r: 15 },
  ];
  return (
    <Card title="Thời tiết và cảnh báo VHKT" icon={CloudRain}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mono" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, color: RED }}>31°C</div>
          <p className="dim" style={{ fontSize: 13, marginTop: 6 }}>TP. Hồ Chí Minh · Mưa rào rải rác</p>
        </div>
        <div style={{ textAlign: "right", fontSize: 12.5 }} className="dim">
          <p className="flex items-center gap-1.5 justify-end"><Droplets size={13} /> Độ ẩm 84%</p>
          <p className="flex items-center gap-1.5 justify-end" style={{ marginTop: 4 }}><Wind size={13} /> Gió ĐN 18 km/h</p>
        </div>
      </div>

      <div style={{ background: "#FDF6F7", border: "1px solid #EFE0E3", borderRadius: 11, padding: "11px 13px", marginTop: 14, display: "flex", gap: 10 }}>
        <AlertTriangle size={17} style={{ color: RED, flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontWeight: 700, fontSize: 13 }}>Cảnh báo mưa dông diện rộng 15:00 – 18:00</p>
          <p className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>
            Khu vực Quận 12, Hóc Môn, Bình Chánh. Đề nghị ca trực chuẩn bị phương án dự phòng nguồn
            và tạm dừng thi công trên cao.
          </p>
        </div>
      </div>

      <div className="flex items-end gap-2" style={{ marginTop: 14, height: 62 }}>
        {hours.map((x) => (
          <div key={x.h} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ height: 40, display: "flex", alignItems: "flex-end" }}>
              <div style={{ width: "100%", height: `${x.r}%`, background: x.r > 60 ? RED : "#E5E1E2", borderRadius: "4px 4px 0 0" }} />
            </div>
            <span className="mono muted" style={{ fontSize: 10.5 }}>{x.h}</span>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>Xác suất mưa theo giờ</p>
    </Card>
  );
}

// Sáu ô chỉ số mặc định, dùng khi chưa nối Google Sheet
const STAT_FB = [
  { ma: "kpi", nhan: "HOÀN THÀNH KPI THÁNG", gia_tri: "68", don_vi: "%", muc_tieu: "Mục tiêu: 100%", mau: "green", tien_do: 68, lon: true },
  { ma: "wo_dung_han", nhan: "WO ĐÚNG HẠN", gia_tri: "1.28", don_vi: "%", muc_tieu: "Mục tiêu: ≤ 3%", ghi_chu: "Đạt", mau: "orange", lon: true },
  { ma: "tien_phat", nhan: "TIỀN PHẠT THÁNG", gia_tri: "0", don_vi: "đ", muc_tieu: "Mục tiêu: 0 đ", mau: "blue" },
  { ma: "su_co_ngay", nhan: "SỰ CỐ NGÀY", gia_tri: "12", don_vi: "", ghi_chu: "Hôm nay", mau: "purple" },
  { ma: "wo_qua_han", nhan: "WO QUÁ HẠN", gia_tri: "28", don_vi: "", ghi_chu: "Quá hạn", mau: "orange" },
  { ma: "an_toan", nhan: "AN TOÀN", gia_tri: "100", don_vi: "%", ghi_chu: "Không sự cố", mau: "teal" },
];

// Biểu tượng cho từng ô chỉ số, khớp với bản thiết kế đã duyệt
const STAT_ICONS = {
  kpi: TrendingUp, wo_dung_han: ClipboardList, tien_phat: Coins,
  su_co_ngay: CalendarDays, wo_qua_han: Wrench, an_toan: ShieldCheck,
  xlcs_3h: Signal, kpi_tkm_3h: Activity, kpi_tkm_10h: Activity, kpi_tkm_24h: Activity,
  cell_h_tong: Wrench, ksub_min: Clock,
};

function StatIcon({ ma, size = 26 }) {
  const Ico = STAT_ICONS[ma] || Activity;
  return <Ico size={size} strokeWidth={2.4} />;
}

const MEET_LABEL = {
  truc_tiep: "Trực tiếp", cau_truyen_hinh: "Cầu truyền hình",
  zoom: "Zoom", google_meet: "Google Meet", teams: "Teams", khac: "Khác",
};

/** Một dòng lịch công tác, hiện kèm thành phần tham gia và cách vào họp. */
function SchedRow({ s }) {
  const [hienIP, setHienIP] = useState(false);
  const loai = s.meeting_type || "truc_tiep";
  const online = ["zoom", "google_meet", "teams"].includes(loai);
  const laLink = (s.meeting_info || "").toLowerCase().startsWith("http");

  const chepIP = () => {
    navigator.clipboard?.writeText(s.meeting_info || "").then(
      () => { setHienIP(true); setTimeout(() => setHienIP(false), 1800); },
      () => {}
    );
  };

  return (
    <div className="cnct-sched">
      <span className="cnct-sched-time">{s.time}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p className="cnct-sched-title">{s.title}</p>

        <p className="cnct-sched-meta">
          {s.place && <span><MapPin size={12} /> {s.place}</span>}
          {s.host && <span><Users size={12} /> {s.host}</span>}
          {loai !== "truc_tiep" && (
            <span style={{ color: RED, fontWeight: 700 }}>
              <Video size={12} /> {MEET_LABEL[loai] || loai}
            </span>
          )}
        </p>

        {s.participants && (
          <p className="cnct-sched-meta" style={{ marginTop: 3 }}>
            <span><Users size={12} /> Thành phần: {s.participants}</span>
          </p>
        )}

        {s.meeting_info && (
          <div style={{ marginTop: 7 }}>
            {online && laLink ? (
              <a className="btn btn-sm btn-red" href={s.meeting_info} target="_blank" rel="noreferrer"
                style={{ textDecoration: "none" }}>
                <Video size={13} /> Vào phòng họp
              </a>
            ) : (
              <button className="btn btn-sm" onClick={chepIP} title="Bấm để sao chép">
                <Signal size={13} />
                <span className="mono">{s.meeting_info}</span>
                {hienIP && <span style={{ color: "#0A7A50", fontWeight: 700 }}>đã chép</span>}
              </button>
            )}
            {(s.meeting_id || s.meeting_pass) && (
              <p className="muted mono" style={{ fontSize: 11.5, marginTop: 5 }}>
                {s.meeting_id && <>Mã: {s.meeting_id}</>}
                {s.meeting_id && s.meeting_pass && " · "}
                {s.meeting_pass && <>Mật khẩu: {s.meeting_pass}</>}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Dòng ghi chú dưới mỗi ô chỉ số trang chủ — hiện đúng tháng lấy số (mỗi chỉ
 * tiêu có thể có tháng mới nhất khác nhau tuỳ bảng nào vừa nhập số), kèm thẻ
 * Đạt/Chưa đạt target và Cải thiện/Suy giảm so cùng kỳ nếu có đủ dữ liệu đối
 * chiếu. Chỉ tiêu chưa có logic đánh giá (doanh thu, tiền phạt tháng...) vẫn
 * hiện ghi chú/mục tiêu cũ như trước.
 */
function ChiSoGhiChu({ s }) {
  if (!s.ky_nhan) return s.ghi_chu ? <p className="cnct-stat-sub">{s.ghi_chu}</p> : (s.muc_tieu ? <p className="cnct-stat-sub">{s.muc_tieu}</p> : null);
  const the = { fontSize: 10.5, padding: "2px 7px" };
  return (
    <div style={{ marginTop: 2 }}>
      <p className="cnct-stat-sub" style={{ margin: 0 }}>{s.ky_nhan}</p>
      {(s.dat != null || s.cai_thien != null) && (
        <div className="flex items-center gap-1.5" style={{ marginTop: 5, flexWrap: "wrap" }}>
          {s.dat != null && <span className={`tag ${s.dat ? "tag-green" : "tag-red"}`} style={the}>{s.dat ? "Đạt target" : "Chưa đạt"}</span>}
          {s.cai_thien != null && <span className={`tag ${s.cai_thien ? "tag-green" : "tag-red"}`} style={the}>{s.cai_thien ? "Cải thiện" : "Suy giảm"}</span>}
        </div>
      )}
    </div>
  );
}

export function HomeView({ onGo, onOpenNews, config }) {
  const [home] = useRemote("/api/home", null);
  const [APPS] = useRemote("/api/apps", D.APPS_FB, adapt.apps);

  // Chỉ số lấy từ Google Sheet nếu đã cấu hình, chưa có thì dùng số mặc định
  const stats = home?.home_stats?.length ? home.home_stats : STAT_FB;
  const soLaMau = !!home && !home.home_stats?.length;
  const big = stats.slice(0, 2);
  const small = stats.slice(2);

  // Khi máy chủ đã trả lời mà không có lịch, hiện đúng là trống.
  // Chỉ dùng lịch mẫu lúc chưa gọi được máy chủ, để trang không rỗng khi xem thử.
  const schedule = home ? (home.schedule || []) : D.SCHEDULE_FB;
  const apps = APPS.slice(0, 7);

  const num = (s) => {
    const v = parseFloat(String(s.tien_do ?? s.gia_tri ?? "").replace(",", "."));
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
  };

  return (
    <div className="cnct-home-v2">
      <div className="cnct-kpi-row">
        {big.map((s) => (
          <section key={s.ma} className={`cnct-kpi-card ${s.mau || "green"}`}>
            <div className="cnct-kpi-icon"><StatIcon ma={s.ma} size={26} /></div>
            <div className="cnct-kpi-label">{s.nhan}</div>
            <div className="cnct-kpi-value">{s.gia_tri}{s.don_vi}</div>
            {s.tien_do != null ? (
              <>
                <div className="cnct-kpi-sub">{s.muc_tieu}</div>
                <div className="cnct-progress"><i style={{ width: `${num(s)}%` }} /></div>
              </>
            ) : <ChiSoGhiChu s={s} />}
          </section>
        ))}
      </div>

      {soLaMau && (
        <p style={{ background: "#FFF8E8", color: "#6B5426", fontSize: 12.5,
                    padding: "9px 13px", borderRadius: 10, lineHeight: 1.6 }}>
          Các ô chỉ số đang hiển thị <strong>số liệu mẫu</strong> vì chưa có số thật.
          Nhập số tại Quản trị → Nhập dữ liệu hàng loạt, nhóm Số liệu Dashboard,
          hoặc nối bảng tính tại Nguồn dữ liệu Sheet.
        </p>
      )}

      <div className="cnct-stats">
        {small.map((s) => (
          <section key={s.ma} className={`cnct-stat ${s.mau || ""}`}>
            <div className="cnct-stat-icon"><StatIcon ma={s.ma} size={22} /></div>
            <div className="cnct-stat-label">{s.nhan}</div>
            <div className="cnct-stat-value">{s.gia_tri}{s.don_vi ? ` ${s.don_vi}` : ""}</div>
            <ChiSoGhiChu s={s} />
          </section>
        ))}
      </div>

      <section className="cnct-apps">
        <div className="cnct-apps-head">
          <div className="cnct-apps-title">TRUNG TÂM ỨNG DỤNG</div>
          <button className="cnct-apps-more" onClick={() => onGo("apps")}>Xem tất cả ›</button>
        </div>
        <div className="cnct-app-list">
          {apps.map((a, i) => (
            <a key={a.id || a.name} className="cnct-app"
              href={a.url && a.url !== "#" ? a.url : "#"}
              target={a.url && a.url !== "#" ? "_blank" : undefined} rel="noreferrer">
              <div className="cnct-app-icon" style={{ color: [RED, "#09a7a1", "#7c4bdc", "#0f6cbd", "#0a9b55", "#5b5fc7", "#f28a14"][i % 7], overflow: "hidden" }}>
                {a.icon_url ? <img src={a.icon_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit" }} /> : (a.name?.[0] || "•")}
              </div>
              <div className="cnct-app-name">{a.name}</div>
            </a>
          ))}
        </div>
      </section>

      <div className="cnct-bottom-grid">
        <LichCongTacPanel homeSchedule={schedule} homeFromSheet={!!home?.schedule_from_sheet} homeScheduleLocked={!!home?.schedule_locked} />

        <BirthdayPanel />
      </div>
    </div>
  );
}

/** "YYYY-MM-DD" theo giờ địa phương — không dùng toISOString() vì nó quy đổi sang UTC,
 * dễ lệch ngày với múi giờ Việt Nam (UTC+7) vào những giờ gần nửa đêm. */
function ngayISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Lịch công tác — mặc định hiện hôm nay (dùng luôn dữ liệu đã có từ /api/home,
 * không gọi thêm), cho phép bấm chuyển ngày trước/sau để xem lịch ngày khác.
 */
function LichCongTacPanel({ homeSchedule, homeFromSheet, homeScheduleLocked }) {
  const [offset, setOffset] = useState(0);
  const [duLieu, setDuLieu] = useState({ schedule: homeSchedule, schedule_from_sheet: homeFromSheet, schedule_locked: homeScheduleLocked });
  const [dangTai, setDangTai] = useState(false);

  const ngay = new Date();
  ngay.setDate(ngay.getDate() + offset);
  const ngayStr = ngayISO(ngay);

  useEffect(() => {
    // Đồng bộ lại mỗi khi kết quả /api/home mới trả về (đến sau, không đồng
    // bộ với lúc mount) — nếu chỉ phụ thuộc "offset" thì lần đầu component
    // dựng lên trước khi /api/home trả lời xong sẽ kẹt mãi ở dữ liệu mẫu lúc
    // khởi tạo, kể cả sau khi máy chủ đã trả lời đúng lịch thật/khoá đăng nhập.
    if (offset === 0) { setDuLieu({ schedule: homeSchedule, schedule_from_sheet: homeFromSheet, schedule_locked: homeScheduleLocked }); return; }
    let con = true;
    setDangTai(true);
    api.get(`/api/schedule-of-day?ngay=${ngayStr}`)
      .then((d) => { if (con) setDuLieu(d); })
      .catch(() => { if (con) setDuLieu({ schedule: [], schedule_from_sheet: false, schedule_locked: homeScheduleLocked }); })
      .finally(() => con && setDangTai(false));
    return () => { con = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, homeSchedule, homeFromSheet, homeScheduleLocked]);

  const nhanNgay = offset === 0 ? "Hôm nay" : offset === 1 ? "Ngày mai" : offset === -1 ? "Hôm qua" : ngay.toLocaleDateString("vi-VN");
  const schedule = duLieu.schedule || [];

  return (
    <section className="cnct-panel">
      <div className="cnct-panel-head">
        <div className="cnct-panel-title"><Calendar size={17} /> LỊCH CÔNG TÁC {nhanNgay.toUpperCase()}</div>
        <div className="flex items-center gap-1.5">
          <button className="btn btn-sm" onClick={() => setOffset((o) => o - 1)} aria-label="Xem ngày trước"><ChevronLeft size={14} /></button>
          <span className="cnct-panel-note">{duLieu.schedule_from_sheet ? "Nguồn: Google Sheet" : ngay.toLocaleDateString("vi-VN")}</span>
          <button className="btn btn-sm" onClick={() => setOffset((o) => o + 1)} aria-label="Xem ngày sau"><ChevronRight size={14} /></button>
          {offset !== 0 && (
            <button className="btn btn-sm" onClick={() => setOffset(0)}>Hôm nay</button>
          )}
        </div>
      </div>
      {dangTai ? (
        <p className="cnct-empty">Đang tải…</p>
      ) : duLieu.schedule_locked ? (
        <p className="cnct-empty">
          <Lock size={14} style={{ verticalAlign: -2, marginRight: 5 }} />
          Đăng nhập để xem lịch công tác — nội dung có thể chứa thông tin họp, link/mã Zoom.
        </p>
      ) : schedule.length === 0 ? (
        <p className="cnct-empty">
          {offset === 0 ? "Hôm nay" : "Ngày này"} chưa có lịch công tác. Quản trị viên nhập tại
          Quản trị → Lịch công tác tuần.
        </p>
      ) : schedule.map((s, i) => <SchedRow key={i} s={s} />)}
    </section>
  );
}

/** Sinh nhật trong tháng — khôi phục từ Góc văn hoá cũ, đặt ở trang chủ. */
function BirthdayPanel() {
  const [birthdays] = useRemote("/api/birthdays", null);
  const [wishes, setWishes] = useState({});
  const bdays = birthdays?.length ? birthdays : [];

  return (
    <section className="cnct-panel">
      <div className="cnct-panel-head">
        <div className="cnct-panel-title"><Cake size={17} /> SINH NHẬT TRONG THÁNG</div>
      </div>
      {bdays.length === 0 ? (
        <p className="cnct-empty">Chưa có dữ liệu sinh nhật trong tháng này.</p>
      ) : bdays.map((b, i) => (
        <div key={i} className="flex items-center gap-3" style={{ padding: "12px 16px", borderTop: i ? "1px solid #F1EEEF" : 0 }}>
          <Avatar name={b.name} color={b.color} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 600, fontSize: 13.5 }}>{b.name}</p>
            <p className="muted" style={{ fontSize: 12 }}>{b.dept} · {b.day}</p>
          </div>
          <button className="btn btn-sm" onClick={() => setWishes((w) => ({ ...w, [b.name]: true }))}
            style={wishes[b.name] ? { background: RED, borderColor: RED, color: "#fff" } : undefined}>
            {wishes[b.name] ? <><Check size={13} /> Đã chúc</> : <><PartyPopper size={13} /> Chúc mừng</>}
          </button>
        </div>
      ))}
    </section>
  );
}



/* ====================== KHUNG DÙNG CHUNG CHO CÁC CỬA SỔ XEM CHI TIẾT ====================== */

/** Khung cửa sổ: đóng bằng nút, bấm ra ngoài, hoặc phím Esc. */
function Sheet({ title, icon: Icon, onClose, children, rong }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const cu = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = cu; };
  }, [onClose]);

  return (
    <div className="sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: rong ? "min(820px,100%)" : "min(620px,100%)",
                                     maxHeight: "92vh", display: "flex", flexDirection: "column",
                                     borderRadius: 16, overflow: "hidden" }}>
        <div className="card-h">
          <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
            {Icon && <Icon size={16} style={{ color: RED, flexShrink: 0 }} />}
            <span className="card-t" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {title}
            </span>
          </div>
          <button className="btn btn-sm" onClick={onClose}><X size={15} /> Đóng</button>
        </div>
        <div style={{ overflowY: "auto", padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

/** Xem ảnh phóng to toàn màn hình. */
function Lightbox({ src, caption, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,18,19,.93)", zIndex: 95,
               display: "grid", placeItems: "center", cursor: "zoom-out", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: "100%", maxHeight: "100%" }}>
        {src
          ? <img src={src} alt="" style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: 10 }} />
          : <div style={{ width: "min(560px,80vw)", height: "50vh", background: RED_DARK,
                          borderRadius: 12, display: "grid", placeItems: "center" }}>
              <ImageIcon size={54} color="#fff" />
            </div>}
        {caption && <p style={{ color: "#fff", marginTop: 14, fontSize: 14.5, fontWeight: 600 }}>{caption}</p>}
        <p style={{ color: "rgba(255,255,255,.6)", marginTop: 6, fontSize: 12 }}>Bấm bất kỳ đâu để đóng</p>
      </div>
    </div>
  );
}

/* ============================== TRANG ĐỌC BẢN TIN ============================== */

/**
 * Cửa sổ đọc bản tin đầy đủ: ảnh đại diện, nội dung, ảnh đính kèm.
 * Mở bằng cách bấm vào bất kỳ thẻ tin nào ở trang chủ hoặc mục Truyền thông.
 */
export function NewsReader({ news, onClose }) {
  const [anhLon, setAnhLon] = useState(null);

  // Đóng bằng phím Esc, và khoá cuộn nền phía sau
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { if (anhLon) setAnhLon(null); else onClose(); }
    };
    document.addEventListener("keydown", onKey);
    const cu = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = cu; };
  }, [onClose, anhLon]);

  if (!news) return null;
  const gallery = Array.isArray(news.gallery) ? news.gallery : [];

  return (
    <div className="sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: "min(820px,100%)", maxHeight: "92vh",
                                     display: "flex", flexDirection: "column", borderRadius: 16, overflow: "hidden" }}>
        <div className="card-h">
          <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
            <Megaphone size={16} style={{ color: RED, flexShrink: 0 }} />
            <span className="card-t" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {news.tag || news.cat || "Bản tin"}
            </span>
          </div>
          <button className="btn btn-sm" onClick={onClose}><X size={15} /> Đóng</button>
        </div>

        <div style={{ overflowY: "auto", padding: 0 }}>
          {news.cover_url && (
            <img src={news.cover_url} alt="" style={{ width: "100%", maxHeight: 300, objectFit: "cover", display: "block" }} />
          )}

          <div style={{ padding: 22 }}>
            <h1 style={{ fontSize: 23, fontWeight: 800, lineHeight: 1.3, letterSpacing: "-.02em" }}>
              {news.title}
            </h1>
            <p className="muted mono" style={{ fontSize: 12, marginTop: 10 }}>
              {[news.date, news.author, news.cat].filter(Boolean).join("  ·  ")}
            </p>

            {news.excerpt && (
              <p className="dim" style={{ fontSize: 15, fontWeight: 500, marginTop: 16, lineHeight: 1.65,
                                          paddingLeft: 14, borderLeft: `3px solid ${RED}` }}>
                {news.excerpt}
              </p>
            )}

            {news.body ? (
              <div style={{ fontSize: 14.5, lineHeight: 1.8, marginTop: 18, whiteSpace: "pre-wrap" }}>
                {news.body}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 13.5, marginTop: 18, fontStyle: "italic" }}>
                Bản tin này chưa có nội dung chi tiết. Người đăng bổ sung tại
                Quản trị → Quản lý bản tin.
              </p>
            )}

            {gallery.length > 0 && (
              <>
                <p className="eyebrow-grey" style={{ marginTop: 24, marginBottom: 10 }}>
                  Ảnh đính kèm ({gallery.length})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {gallery.map((url, i) => (
                    <img key={url + i} src={url} alt="" onClick={() => setAnhLon(url)}
                      style={{ width: "100%", height: 110, objectFit: "cover",
                               borderRadius: 10, cursor: "zoom-in", border: "1px solid #E7E3E4" }} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {anhLon && (
        <div onClick={() => setAnhLon(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(20,18,19,.92)", zIndex: 90,
                   display: "grid", placeItems: "center", cursor: "zoom-out", padding: 24 }}>
          <img src={anhLon} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 10 }} />
        </div>
      )}
    </div>
  );
}

/* ============================== TRUYỀN THÔNG ============================== */


/**
 * Album ảnh và video.
 * Ảnh bấm vào phóng to ngay tại trang; video bấm vào mở tab mới.
 */
function AlbumCard() {
  const [items] = useRemote("/api/media", null);
  const [xem, setXem] = useState(null);
  const [loc, setLoc] = useState("all");

  const ds = items || [];
  const hien = loc === "all" ? ds : ds.filter((m) => m.kind === loc);

  const mo = (m) => {
    if (m.kind === "video") {
      if (m.url && m.url !== "#") window.open(m.url, "_blank", "noopener");
      else window.alert("Video này chưa được gắn đường dẫn.\n\nQuản trị viên bổ sung tại Quản trị → Album ảnh và video.");
      return;
    }
    setXem(m);
  };

  return (
    <>
      <Card title="Album ảnh và video" icon={ImageIcon} pad={false}
        action={
          <div className="flex gap-1.5">
            {[["all", "Tất cả"], ["image", "Ảnh"], ["video", "Video"]].map(([v, l]) => (
              <button key={v} className={`chip ${loc === v ? "on" : ""}`}
                style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={() => setLoc(v)}>
                {l}
              </button>
            ))}
          </div>
        }>
        {hien.length === 0 ? (
          <Empty title="Chưa có ảnh hoặc video nào."
            hint="Quản trị viên bổ sung tại Quản trị → Album ảnh và video." />
        ) : (
          <div className="grid grid-cols-2" style={{ padding: 12, gap: 10 }}>
            {hien.map((m) => {
              const anh = m.kind === "video" ? m.thumb_url : (m.url || m.thumb_url);
              return (
                <div key={m.id} onClick={() => mo(m)}
                  style={{ borderRadius: 11, overflow: "hidden", cursor: "pointer" }}>
                  <div style={{ height: 92, background: m.color || RED, display: "grid",
                                placeItems: "center", position: "relative", borderRadius: 11,
                                overflow: "hidden" }}>
                    {anh
                      ? <img src={anh} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : (m.kind === "video" ? <Video size={22} color="#fff" /> : <ImageIcon size={22} color="#fff" />)}
                    {m.kind === "video" && (
                      <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
                                     background: "rgba(20,18,19,.35)" }}>
                        <span style={{ width: 34, height: 34, borderRadius: "50%", background: "#fff",
                                       display: "grid", placeItems: "center", color: RED, fontSize: 14 }}>▶</span>
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>{m.title}</p>
                  <p className="muted" style={{ fontSize: 11 }}>
                    {[m.author, m.album].filter(Boolean).join(" · ")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {xem && (
        <Lightbox src={xem.url || xem.thumb_url}
          caption={`${xem.title}${xem.author ? " — " + xem.author : ""}`}
          onClose={() => setXem(null)} />
      )}
    </>
  );
}

export function NewsView({ openId, onOpened }) {
  const [NEWS] = useRemote("/api/news", D.NEWS_FB, adapt.news);
  const cats = ["Tất cả", "Hoạt động", "Phong trào", "Gương điển hình", "Văn hoá", "Bản tin"];
  const [cat, setCat] = useState("Tất cả");
  const [doc, setDoc] = useState(null);   // bản tin đang mở để đọc

  // Bấm tin từ trang chủ: mở đúng bản tin đó ngay khi danh sách tải xong
  useEffect(() => {
    if (openId && NEWS.length) {
      const found = NEWS.find((n) => n.id === openId);
      if (found) { setDoc(found); onOpened?.(); }
    }
  }, [openId, NEWS]);
  const list = cat === "Tất cả" ? NEWS : NEWS.filter((n) => n.cat === cat);
  const [f, ...rest] = list;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 scroll-x" style={{ paddingBottom: 2 }}>
        {cats.map((c) => <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>)}
      </div>

      {f && (
        <article className="card" style={{ overflow: "hidden", cursor: "pointer" }} onClick={() => setDoc(f)}>
          <div style={{ height: 190, background: f.cover_url ? "#fff" : `linear-gradient(115deg, ${RED} 0%, ${RED_DARK} 62%, #8E0518 100%)`, position: "relative" }}>
            {f.cover_url && <img src={f.cover_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", padding: 22,
                          background: f.cover_url ? "linear-gradient(transparent, rgba(140,10,30,.85))" : "none" }}>
              <div>
                <span className="tag" style={{ background: "rgba(255,255,255,.2)", color: "#fff" }}>{f.tag}</span>
                <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", marginTop: 10, maxWidth: 640, lineHeight: 1.25 }}>{f.title}</h2>
              </div>
            </div>
          </div>
          <div style={{ padding: 18 }}>
            <p className="dim" style={{ fontSize: 14 }}>{f.excerpt}</p>
            <p className="muted mono" style={{ fontSize: 11.5, marginTop: 10 }}>{f.date} · {f.author}</p>
          </div>
        </article>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rest.map((n) => (
          <article key={n.id} className="card row-hover" style={{ padding: 16, cursor: "pointer" }} onClick={() => setDoc(n)}>
            <span className="tag tag-grey">{n.tag}</span>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginTop: 9, letterSpacing: "-.01em", lineHeight: 1.35 }}>{n.title}</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{n.excerpt}</p>
            <p className="muted mono" style={{ fontSize: 11, marginTop: 10 }}>{n.date} · {n.author}</p>
            <p className="link" style={{ fontSize: 12.5, marginTop: 8 }}>Đọc tiếp ›</p>
          </article>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <AlbumCard />

        <Card title="Bản tin hằng tuần" icon={FileText} pad={false}>
          {[31, 30, 29, 28].map((s, i) => (
            <div key={s} className="row-hover flex items-center gap-3" style={{ padding: "13px 16px", borderTop: i ? "1px solid #F1EEEF" : 0 }}>
              <div className="thumb mono" style={{ width: 40, height: 40, background: i ? RED_DARK : RED, fontSize: 13 }}>{s}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 13.5 }}>Bản tin nội bộ số {s}/2026</p>
                <p className="muted" style={{ fontSize: 12 }}>PDF · 12 trang</p>
              </div>
              <button className="btn btn-sm"><Download size={13} /> Tải</button>
            </div>
          ))}
        </Card>
      </div>

      {doc && <NewsReader news={doc} onClose={() => setDoc(null)} />}
    </div>
  );
}

/* ============================== ỨNG DỤNG ============================== */

export function AppsView() {
  const [APPS] = useRemote("/api/apps", D.APPS_FB, adapt.apps);
  const cats = ["Tất cả", ...Array.from(new Set(APPS.map((a) => a.cat)))];
  const [cat, setCat] = useState("Tất cả");
  const list = cat === "Tất cả" ? APPS : APPS.filter((a) => a.cat === cat);

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-center gap-3" style={{ padding: 14, borderLeft: `3px solid ${RED}` }}>
        <Rocket size={18} style={{ color: RED }} />
        <p className="dim" style={{ fontSize: 13.5 }}>
          Một cú nhấp để mở ứng dụng công việc. Không phải nhớ từng đường dẫn.
        </p>
      </div>

      <div className="flex gap-2 scroll-x">
        {cats.map((c) => <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>)}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {list.map((a) => (
          <a key={a.id || a.name} href={a.url} target={a.url !== "#" ? "_blank" : undefined} rel="noreferrer"
            className="card row-hover" style={{ padding: 16, textDecoration: "none", color: "inherit", display: "block" }}>
            <div className="flex items-start justify-between">
              <div className="thumb" style={{ width: 42, height: 42, background: a.color, fontSize: 16 }}>{a.name[0]}</div>
              <ArrowUpRight size={16} className="muted" />
            </div>
            <h3 style={{ fontWeight: 700, fontSize: 14.5, marginTop: 12 }}>{a.name}</h3>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 4, minHeight: 34 }}>{a.description}</p>
            <span className="tag tag-red" style={{ marginTop: 8 }}>{a.cat}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ============================== TÀI LIỆU ============================== */

export function DocsView() {
  const [DOCS] = useRemote("/api/documents", D.DOCS_FB, adapt.docs);
  const [q, setQ] = useState("");
  const [nhomTuMayChu] = useRemote("/api/document-categories", null);
  const [cat, setCat] = useState("Tất cả");

  // Chỉ hiện nhóm nào thật sự có tài liệu, để bộ lọc không đầy nhóm rỗng
  const nhomCoTaiLieu = new Set(DOCS.map((d) => d.cat).filter(Boolean));
  const cats = ["Tất cả", ...(nhomTuMayChu || []).filter((c) => nhomCoTaiLieu.has(c))];

  const list = DOCS.filter((d) => {
    const okCat = cat === "Tất cả" || d.cat === cat;
    const t = norm(q).trim();
    const okQ = !t || norm(`${d.title} ${d.body || ""} ${d.code}`).includes(t);
    return okCat && okQ;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="card" style={{ padding: 16 }}>
        <div className="search-box">
          <BookOpen size={18} style={{ color: RED }} />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm toàn văn trong kho tài liệu — thử “xăng dầu”, “an toàn”, “PAKH”" />
        </div>
        <div className="flex gap-2 scroll-x" style={{ marginTop: 12 }}>
          {cats.map((c) => <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>)}
        </div>
      </div>

      <Card title={`Tài liệu (${list.length})`} icon={BookOpen} pad={false}>
        {list.length === 0
          ? <Empty title="Chưa có tài liệu nào khớp." hint="Bỏ bớt từ khoá, hoặc chọn lại nhóm tài liệu." />
          : list.map((d, i) => <DocRow key={d.id} d={d} dau={i === 0} />)}
      </Card>
    </div>
  );
}


/**
 * Một dòng tài liệu. Bấm vào đâu cũng mở được tệp.
 * Tài liệu chưa gắn tệp thì báo rõ thay vì mở ra trang trắng.
 */
function DocRow({ d, dau }) {
  const [nhac, setNhac] = useState(false);
  const coTep = !!(d.file_url && d.file_url.trim() && d.file_url !== "#");

  const moTaiLieu = () => {
    if (!coTep) { setNhac(true); setTimeout(() => setNhac(false), 4000); return; }
    // Ghi nhận lượt tải rồi mở tệp. Không chặn việc mở nếu ghi nhận lỗi.
    api.post(`/api/documents/${d.id}/download`).catch(() => {});
    window.open(d.file_url, "_blank", "noopener");
  };

  return (
    <div className="row-hover" style={{ borderTop: dau ? 0 : "1px solid #F1EEEF" }}>
      <div className="flex items-center gap-3" onClick={moTaiLieu}
        style={{ padding: "13px 16px", cursor: "pointer" }}>
        <FileText size={19} style={{ color: coTep ? RED : "#C6C1C2", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 13.5 }}>{d.title}</p>
          <p className="muted mono" style={{ fontSize: 11.5, marginTop: 3 }}>
            {[d.code, d.cat, d.size, d.date && `Cập nhật ${d.date}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        {coTep ? (
          <span className="btn btn-sm"><Download size={13} /><span className="hidden sm:inline">Tải về</span></span>
        ) : (
          <span className="tag tag-grey">Chưa có tệp</span>
        )}
      </div>

      {nhac && (
        <p style={{ background: "#FFF8E8", color: "#6B5426", fontSize: 12.5,
                    padding: "9px 16px", borderTop: "1px solid #F0DFB4" }}>
          Tài liệu này chưa được gắn tệp. Quản trị viên vào
          <strong> Quản trị → Quản lý tài liệu</strong>, sửa tài liệu và điền ô
          “Đường dẫn tệp”.
        </p>
      )}
    </div>
  );
}

/* ============================== DASHBOARD ============================== */

/**
 * DASHBOARD
 *
 * Số liệu lấy từ máy chủ theo thứ tự ưu tiên:
 *   1. Google Sheet nếu đã cấu hình nguồn
 *   2. Bảng số liệu trong cơ sở dữ liệu
 *   3. Dữ liệu mẫu, chỉ khi hai nguồn trên đều trống
 *
 * Trạng thái nguồn hiện ngay trên biểu đồ để người xem biết con số đến từ đâu.
 */

// Bảy bảng số liệu, kèm cách vẽ và dữ liệu mẫu dùng khi chưa có số thật
const BOARDS = {
  KPI: {
    nhan: "Tiền phạt & Doanh thu", ma: "KPI", icon: Coins,
    tieuDe: "Tiền phạt và doanh thu theo tháng",
    mau: [],
    ve: "cot-kep",
  },
  HIRE: {
    nhan: "Tuyển dụng", ma: "HIRE", icon: UserPlus,
    tieuDe: "Tiến độ tuyển dụng",
    mau: D.D_HIRE.map((r) => ({ name: r.b, "Số lượng": r.v })),
    ve: "cot-don",
  },
  WO: {
    nhan: "Rời mạng CĐBR", ma: "WO", icon: Users,
    tieuDe: "Tỷ lệ và số lượng khách hàng rời mạng CĐBR — theo tỉnh, trung tâm",
    mau: [],
    ve: "cot-kep",
  },
  PAKH: {
    nhan: "Sự cố truyền dẫn", ma: "PAKH", icon: AlertTriangle,
    tieuDe: "Số sự cố truyền dẫn theo tháng — BDG / VTU / VCC HCM",
    mau: D.D_PAKH.map((r) => ({ name: r.m, "Tiếp nhận": r.nhan, "Đã xử lý": r.xuly })),
    ve: "vung",
  },
  FUEL: {
    nhan: "Ksub*min", ma: "FUEL", icon: Clock,
    tieuDe: "Ksub*min theo tháng — BDG / VTU / VCC HCM",
    mau: D.D_FUEL.map((r) => ({ name: r.t, "Định mức": r.dm, "Thực chi": r.tt })),
    ve: "cot-ngang",
  },
  OUTPUT: {
    nhan: "GĐTT & Cell*h", ma: "OUTPUT", icon: Wrench,
    tieuDe: "Gián đoạn thông tin (GĐTT) & Cell*h tổng theo tháng",
    mau: D.D_OUT.map((r) => ({ name: r.m, "Sản lượng": r.v })),
    ve: "duong",
  },
  NETWORK: {
    nhan: "XLCS CĐBR", ma: "NETWORK", icon: Signal,
    tieuDe: "Xử lý sự cố CĐBR theo tháng",
    mau: D.D_NET.map((r) => ({ name: r.m, "Availability": r.av, "Số sự cố": r.sc })),
    ve: "cot-duong",
  },
  VHKT: {
    nhan: "TKM CĐBR", ma: "VHKT", icon: Activity,
    tieuDe: "Triển khai mới CĐBR theo tháng (dây mới/dây sẵn, KPI TKM 3h/10h/24h)",
    mau: [],
    ve: "duong",
  },
};

const MAU_VE = [RED, "#DCD7D8", "#F2A007", "#0E9C99", "#7C3AED"];

// Màu cố định theo mã đơn vị (thay vì theo thứ tự) — BDG xanh dương, VTU xám
// đậm, mức toàn chi nhánh đỏ, không lệ thuộc thứ tự sắp xếp. Giữ luôn tên cũ
// để dữ liệu chưa chuẩn hoá xong vẫn đúng màu.
const MAU_THEO_TINH = {
  BDG: "#0E6CD6", VTU: "#4B5563", "VCC HCM": RED,
  "Bình Dương": "#0E6CD6", "Bà Rịa - Vũng Tàu": "#4B5563", "TP.HCM": RED,
};
function mauTinh(ten, idx) { return MAU_THEO_TINH[ten] || MAU_VE[idx % MAU_VE.length]; }

const dinhDangPhanTram = (v) => (v == null ? "" : `${Number(v).toFixed(2)}%`);

/** Danh sách năm (giảm dần) xuất hiện trong một tập kỳ "YYYY-MM". */
/**
 * Danh sách biểu đồ nhỏ xếp dọc, mỗi biểu đồ vẽ đúng một chuỗi số liệu — dùng khi
 * gộp nhiều chuỗi vào chung một biểu đồ sẽ khiến nhãn số chồng lên nhau, khó đọc
 * (ví dụ 3 mức KPI TKM 3h/10h/24h giá trị sát nhau). Mỗi biểu đồ vẫn hiện số tại
 * từng điểm mốc.
 */
function DanhSachBieuDoDoc({ data, dsChuoi, nhanChuoi, mauMap, dinhDang = (v) => (v == null ? "" : `${v}`) }) {
  const truc = { tick: { fontSize: 11 }, stroke: "#A9A3A5" };
  return (
    <div className="flex flex-col gap-4">
      {dsChuoi.map((chuoi, i) => {
        const mau = (mauMap && mauMap[chuoi]) || MAU_VE[i % MAU_VE.length];
        const coTarget = data.some((r) => r[`${chuoi}__target`] != null);
        return (
          <div key={chuoi}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: "#57494B", marginBottom: 2 }}>{nhanChuoi?.[chuoi] || chuoi}</p>
            <ResponsiveContainer width="100%" height={165}>
              <LineChart data={data} margin={{ top: 18, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFECED" vertical={false} />
                <XAxis dataKey="name" {...truc} />
                <YAxis {...truc} width={40} />
                <Tooltip {...tooltipStyle} formatter={(v) => dinhDang(v)} />
                {coTarget && <Legend wrapperStyle={{ fontSize: 11 }} height={20} />}
                {coTarget && (
                  <Line type="monotone" dataKey={`${chuoi}__target`} name="Target" stroke="#A9A3A5"
                    strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                )}
                <Line type="monotone" dataKey={chuoi} name={nhanChuoi?.[chuoi] || chuoi} stroke={mau} strokeWidth={2.5} dot={{ r: 3 }} connectNulls>
                  <LabelList dataKey={chuoi} position="top" fontSize={10} formatter={dinhDang} fill={mau} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}

/** Dựng dữ liệu {name, [chuoi]: giá trị, [chuoi]__target: target} từ "compare", lọc theo danh sách chỉ tiêu và năm. */
function BieuDoNhieuChiTieu({ compare, chiTieuList, nhanChiTieu, nam, dinhDang = (v) => (v == null ? "" : `${v}`), mauMap }) {
  const rows = (compare || []).filter((c) => chiTieuList.includes(c.chi_tieu) && (!nam || nam === "all" || c.ky?.startsWith(nam)));
  if (!rows.length) return <Empty title="Chưa có số liệu." />;

  const kyList = [...new Set(rows.map((r) => r.ky))].sort();
  const laTatCaNam = nam === "all";
  const data = kyList.map((k) => {
    const [namK, thangK] = k.split("-");
    const hang = { name: `T${parseInt(thangK, 10)}${laTatCaNam ? `/${namK.slice(2)}` : ""}` };
    chiTieuList.forEach((ct) => {
      const r = rows.find((r) => r.ky === k && r.chi_tieu === ct);
      hang[ct] = r?.thuc_hien ?? null;
      hang[`${ct}__target`] = r?.target ?? null;
    });
    return hang;
  });

  return <DanhSachBieuDoDoc data={data} dsChuoi={chiTieuList} nhanChuoi={nhanChiTieu} mauMap={mauMap} dinhDang={dinhDang} />;
}

/** Lấy tên các cột số liệu, bỏ cột nhãn. */
function cotSoLieu(series) {
  const keys = new Set();
  series.forEach((r) => Object.keys(r).forEach((k) => k !== "name" && keys.add(k)));
  return [...keys];
}

function BieuDo({ kieu, series }) {
  const cot = cotSoLieu(series);
  const truc = { tick: { fontSize: 12 }, stroke: "#A9A3A5" };
  const luoi = <CartesianGrid strokeDasharray="3 3" stroke="#EFECED" vertical={false} />;

  if (kieu === "cot-ngang") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={series} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EFECED" horizontal={false} />
          <XAxis type="number" {...truc} />
          <YAxis type="category" dataKey="name" width={110} {...truc} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12.5 }} />
          {cot.map((c, i) => (
            <Bar key={c} dataKey={c} name={c} radius={[0, 4, 4, 0]} barSize={14}>
              {series.map((r, j) => {
                // Cột thực chi vượt định mức thì tô đỏ để nhìn ra ngay
                const vuot = cot.length === 2 && i === 1 && r[cot[1]] > r[cot[0]];
                return <Cell key={j} fill={i === 0 ? "#DCD7D8" : (vuot ? RED : "#0E9C99")} />;
              })}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (kieu === "vung") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={series}>
          <defs>
            <linearGradient id="gradDash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={RED} stopOpacity={0.3} />
              <stop offset="100%" stopColor={RED} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {luoi}
          <XAxis dataKey="name" {...truc} />
          <YAxis {...truc} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12.5 }} />
          {cot.map((c, i) => (
            <Area key={c} type="monotone" dataKey={c} name={c} strokeWidth={2.5}
              stroke={i === 0 ? RED : "#0E9C99"} fill={i === 0 ? "url(#gradDash)" : "transparent"} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (kieu === "duong") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={series}>
          {luoi}
          <XAxis dataKey="name" {...truc} />
          <YAxis {...truc} />
          <Tooltip {...tooltipStyle} />
          {cot.length > 1 && <Legend wrapperStyle={{ fontSize: 12.5 }} />}
          {cot.map((c, i) => (
            <Line key={c} type="monotone" dataKey={c} name={c}
              stroke={MAU_VE[i % MAU_VE.length]} strokeWidth={3} dot={{ r: 4 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (kieu === "cot-duong" && cot.length >= 2) {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={series}>
          {luoi}
          <XAxis dataKey="name" {...truc} />
          <YAxis yAxisId="l" {...truc} />
          <YAxis yAxisId="r" orientation="right" {...truc} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12.5 }} />
          <Bar yAxisId="r" dataKey={cot[1]} name={cot[1]} fill="#DCD7D8" radius={[4, 4, 0, 0]} barSize={26} />
          <Line yAxisId="l" type="monotone" dataKey={cot[0]} name={cot[0]} stroke={RED} strokeWidth={2.5} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  // Mặc định: cột, một hoặc nhiều nhóm
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={series}>
        {luoi}
        <XAxis dataKey="name" {...truc} />
        <YAxis {...truc} />
        <Tooltip {...tooltipStyle} />
        {cot.length > 1 && <Legend wrapperStyle={{ fontSize: 12.5 }} />}
        {cot.map((c, i) => (
          <Bar key={c} dataKey={c} name={c} radius={[4, 4, 0, 0]} barSize={cot.length > 1 ? 22 : 44}
            fill={cot.length === 1 ? RED : (i === 0 ? "#DCD7D8" : RED)} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Lọc series chung của bảng, chỉ giữ đúng một chỉ tiêu — dùng khi một bảng gồm nhiều chỉ tiêu khác bản chất (ví dụ Rời mạng: số lượng + tỷ lệ). */
function seriesMotChiTieu(series, chiTieu) {
  return (series || []).map((r) => ({ name: r.name, [chiTieu]: r[chiTieu] })).filter((r) => r[chiTieu] != null);
}

/**
 * Biểu đồ xu thế theo tháng: Target (nếu có) + năm hiện tại + cùng kỳ năm trước,
 * dựng từ dữ liệu "compare" (đã đối chiếu sẵn ở máy chủ). Dùng cho Tiền phạt/Doanh thu
 * và Tỷ lệ rời mạng CĐBR. `hienSo` bật hiển thị số ngay trên biểu đồ (định dạng theo `dinhDang`).
 */
function TrendChart({ compare, chiTieu, hienSo = true, namHienTai, dinhDang = (v) => (v == null ? "" : `${Number(v).toFixed(2)}%`) }) {
  const rows = (compare || []).filter((c) => !chiTieu || c.chi_tieu === chiTieu);
  if (!rows.length) return <Empty title="Chưa có số liệu đối chiếu." hint="Cần nhập cả bảng chính và bảng Target." />;

  const namMoiNhat = namHienTai || Math.max(...rows.map((c) => parseInt((c.ky || "0-0").split("-")[0], 10) || 0));
  const cuaNamNay = rows.filter((c) => parseInt((c.ky || "0-0").split("-")[0], 10) === namMoiNhat);
  if (!cuaNamNay.length) return <Empty title="Chưa có số liệu đối chiếu." hint={`Chưa có số liệu năm ${namMoiNhat}.`} />;

  const nhanNamNay = String(namMoiNhat);
  const nhanNamTruoc = String(namMoiNhat - 1);
  const truc = { tick: { fontSize: 12 }, stroke: "#A9A3A5" };
  const nhanSo = { position: "top", fontSize: 10.5, formatter: dinhDang };

  const data = cuaNamNay
    .sort((a, b) => a.ky.localeCompare(b.ky))
    .map((c) => ({
      name: `T${parseInt(c.ky.split("-")[1], 10)}`,
      Target: c.target,
      [nhanNamNay]: c.thuc_hien,
      [nhanNamTruoc]: c.cung_ky_truoc,
    }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 22, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EFECED" vertical={false} />
        <XAxis dataKey="name" {...truc} />
        <YAxis {...truc} />
        <Tooltip {...tooltipStyle} formatter={(v) => dinhDang(v)} />
        <Legend wrapperStyle={{ fontSize: 12.5 }} />
        <Line type="monotone" dataKey="Target" stroke="#A9A3A5" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
        <Line type="monotone" dataKey={nhanNamTruoc} stroke={RED} strokeDasharray="5 3" dot={{ r: 3 }} strokeWidth={2}>
          {hienSo && <LabelList dataKey={nhanNamTruoc} {...nhanSo} fill={RED} />}
        </Line>
        <Line type="monotone" dataKey={nhanNamNay} stroke="#0E6CD6" dot={{ r: 3 }} strokeWidth={2.5}>
          {hienSo && <LabelList dataKey={nhanNamNay} {...nhanSo} fill="#0E6CD6" />}
        </Line>
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Cảnh báo trung tâm chưa đạt KPI vận hành — nhóm theo trung tâm, liệt kê các chỉ tiêu vượt target. */
function CanhBaoTrungTam({ danhSach }) {
  if (!danhSach?.length) return null;
  return (
    <Card title="Trung tâm chưa đạt KPI vận hành" icon={AlertTriangle} pad={false}>
      <div style={{ padding: "6px 18px 16px" }}>
        {danhSach.map((c) => (
          <div key={c.trung_tam} style={{ padding: "9px 0", borderBottom: "1px solid #EFECED", fontSize: 13.5 }}>
            <b>{c.trung_tam}:</b> <span style={{ color: RED_DARK }}>{c.chi_tieu_khong_dat.join(", ")}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

const MAU_TRON = [RED, "#0E6CD6", "#F2A007", "#0E9C99", "#7C3AED", "#B45309", "#0A7A50", "#DB2777", "#4B5563", "#65A30D", "#DC2626", "#0891B2", "#7E22CE", "#CA8A04", "#059669"];

/** Biểu đồ cột số lượng KH rời mạng theo tỉnh, mỗi tỉnh một màu riêng (cố định theo tên). */
function SoLuongRoMangTheoTinh({ theoTinh }) {
  if (!theoTinh?.length) return null;
  const truc = { tick: { fontSize: 12 }, stroke: "#A9A3A5" };
  const kyDuNhat = [...new Set(theoTinh.flatMap((t) => t.theo_thang.map((r) => r.ky)))].sort();
  const data = kyDuNhat.map((ky) => {
    const hang = { name: `T${parseInt(ky.split("-")[1], 10)}` };
    theoTinh.forEach((t) => { hang[t.ten] = t.theo_thang.find((r) => r.ky === ky)?.gia_tri ?? null; });
    return hang;
  });
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 8, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EFECED" vertical={false} />
        <XAxis dataKey="name" {...truc} />
        <YAxis {...truc} />
        <Tooltip {...tooltipStyle} formatter={(v) => v?.toLocaleString("vi-VN")} />
        <Legend wrapperStyle={{ fontSize: 12.5 }} />
        {theoTinh.map((t, i) => (
          <Bar key={t.ten} dataKey={t.ten} name={t.ten} radius={[4, 4, 0, 0]} fill={mauTinh(t.ten, i)}>
            <LabelList dataKey={t.ten} position="top" fontSize={9.5} formatter={(v) => v?.toLocaleString("vi-VN")} fill={mauTinh(t.ten, i)} />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Biểu đồ xu thế một chỉ tiêu theo tháng, một đường mỗi tỉnh/đơn vị — dựng từ
 * "compare" đã đối chiếu sẵn ở máy chủ. Dùng cho các bảng chi tiết theo tỉnh
 * (Sự cố truyền dẫn, Ksub*min, GĐTT & Cell*h) — khác TrendChart ở chỗ so sánh
 * NHIỀU đơn vị cùng lúc thay vì Target/năm nay/năm trước của một đơn vị.
 */
function BieuDoTheoTinh({ compare, chiTieu, nam }) {
  const rowsCa = (compare || []).filter((c) => c.chi_tieu === chiTieu && c.don_vi);
  const rows = rowsCa.filter((c) => !nam || nam === "all" || c.ky?.startsWith(nam));
  if (!rows.length) return <Empty title="Chưa có số liệu đối chiếu." hint="Cần nhập số liệu kèm tên tỉnh/đơn vị." />;

  const donVi = [...new Set(rows.map((r) => r.don_vi))].sort(sapXepDonVi);
  const ky = [...new Set(rows.map((r) => r.ky))].sort();
  const laTatCaNam = nam === "all";
  const data = ky.map((k) => {
    const [namK, thang] = k.split("-");
    const hang = { name: `T${parseInt(thang, 10)}${laTatCaNam ? `/${namK.slice(2)}` : ""}` };
    donVi.forEach((dv) => {
      const r = rows.find((r) => r.ky === k && r.don_vi === dv);
      hang[dv] = r?.thuc_hien ?? null;
      hang[`${dv}__target`] = r?.target ?? null;
    });
    return hang;
  });
  const mauMap = Object.fromEntries(donVi.map((dv, i) => [dv, mauTinh(dv, i)]));

  return <DanhSachBieuDoDoc data={data} dsChuoi={donVi} mauMap={mauMap} dinhDang={(v) => v?.toLocaleString("vi-VN")} />;
}

/** Bảng chi tiết rời mạng theo huyện, gộp nhóm theo tỉnh — kèm thuê bao FTTH và bình quân. */
function BangRoMangTheoHuyen({ diaBan }) {
  if (!diaBan?.tinh?.length && !diaBan?.huyen?.length) return null;
  // Cột tháng xếp mới nhất trước, cũ dần về sau (yêu cầu người dùng).
  const kyTinh = [...new Set((diaBan.tinh || []).flatMap((t) => t.theo_thang.map((r) => r.ky)))].sort().reverse();
  const kyHuyen = [...new Set((diaBan.huyen || []).flatMap((h) => h.tl_theo_thang.map((r) => r.ky)))].sort().reverse();
  const theoThang = (thang, ky) => (thang || []).find((r) => r.ky === ky)?.gia_tri;
  const nhomTheoTinh = {};
  (diaBan.huyen || []).forEach((h) => { (nhomTheoTinh[h.tinh] ||= []).push(h); });

  return (
    <>
      {diaBan.tinh?.length > 0 && (
        <Card title="Số lượng KH rời mạng theo tỉnh" icon={MapPin} pad={false}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tỉnh</th>
                  {kyTinh.map((k) => <th key={k} style={{ textAlign: "right" }}>{`T${parseInt(k.split("-")[1], 10)}`}</th>)}
                  <th style={{ textAlign: "right" }}>Bình quân</th>
                </tr>
              </thead>
              <tbody>
                {diaBan.tinh.map((t) => (
                  <tr key={t.ten}>
                    <td style={{ fontWeight: 600 }}>{t.ten}</td>
                    {kyTinh.map((k) => <td key={k} className="mono" style={{ textAlign: "right" }}>{theoThang(t.theo_thang, k)?.toLocaleString("vi-VN") ?? "—"}</td>)}
                    <td className="mono" style={{ textAlign: "right", fontWeight: 600 }}>{t.binh_quan?.toLocaleString("vi-VN") ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {Object.entries(nhomTheoTinh).map(([tinh, danhSach]) => (
        <Card key={tinh} title={`Rời mạng CĐBR theo huyện — ${tinh}`} icon={MapPin} pad={false}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Huyện</th>
                  <th style={{ textAlign: "right" }}>Thuê bao FTTH</th>
                  {kyHuyen.map((k) => <th key={`sl-${k}`} style={{ textAlign: "right" }}>{`SL T${parseInt(k.split("-")[1], 10)}`}</th>)}
                  {kyHuyen.map((k) => <th key={`tl-${k}`} style={{ textAlign: "right" }}>{`TL T${parseInt(k.split("-")[1], 10)}`}</th>)}
                  <th style={{ textAlign: "right" }}>BQ tỷ lệ</th>
                  <th style={{ textAlign: "right" }}>BQ 3 tháng</th>
                </tr>
              </thead>
              <tbody>
                {danhSach.map((h) => (
                  <tr key={h.huyen}>
                    <td style={{ fontWeight: 600 }}>{h.huyen}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{h.thue_bao?.toLocaleString("vi-VN") ?? "—"}</td>
                    {kyHuyen.map((k) => <td key={`sl-${k}`} className="mono" style={{ textAlign: "right" }}>{theoThang(h.sl_theo_thang, k)?.toLocaleString("vi-VN") ?? "—"}</td>)}
                    {kyHuyen.map((k) => {
                      const v = theoThang(h.tl_theo_thang, k);
                      return <td key={`tl-${k}`} className="mono" style={{ textAlign: "right", color: v != null && v > 0.61 ? RED_DARK : undefined }}>{v != null ? `${v.toFixed(2)}%` : "—"}</td>;
                    })}
                    <td className="mono" style={{ textAlign: "right", fontWeight: 600 }}>{h.tl_binh_quan != null ? `${h.tl_binh_quan.toFixed(2)}%` : "—"}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{h.tl_binh_quan_3_thang != null ? `${h.tl_binh_quan_3_thang.toFixed(2)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </>
  );
}

/** Ghi chú kỳ gần nhất trên các biểu đồ lũy kế theo tháng — kỳ cuối là số lũy kế đến hết tháng đó, không phải phát sinh riêng trong tháng. */
function GhiChuLuyKe({ kyGanNhat }) {
  if (!kyGanNhat) return null;
  const thang = parseInt((kyGanNhat.split("-")[1] || ""), 10);
  return (
    <p className="muted" style={{ fontSize: 12, marginTop: 8, fontStyle: "italic" }}>
      * Số liệu {`T${thang < 10 ? "0" + thang : thang}`} là lũy kế đến hết tháng {thang < 10 ? "0" + thang : thang},
      không phải số phát sinh riêng trong tháng.
    </p>
  );
}

/** Biểu đồ xu thế tổng tiền phạt Tổng/VTT/VTNet theo tháng (triệu đồng). */
function NhomPhatTrend({ xuHuong, nam }) {
  const loc = (xuHuong || []).filter((r) => !nam || nam === "all" || r.name?.startsWith(nam));
  if (!loc.length) return null;
  const truc = { tick: { fontSize: 12 }, stroke: "#A9A3A5" };
  const laTatCaNam = nam === "all";
  const data = loc.map((r) => ({
    ...r, "Tổng": (r.VTT || 0) + (r.VTNet || 0),
    name: `T${parseInt(r.name.split("-")[1], 10)}${laTatCaNam ? `/${r.name.split("-")[0].slice(2)}` : ""}`,
  }));
  const nhanSo = { position: "top", fontSize: 10.5, formatter: (v) => v.toLocaleString("vi-VN") };
  return (
    <>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 22, right: 14, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EFECED" vertical={false} />
          <XAxis dataKey="name" {...truc} interval={loc.length > 12 ? 1 : 0} />
          <YAxis {...truc} label={{ value: "Triệu đồng", angle: -90, position: "insideLeft", fontSize: 11, fill: "#A9A3A5" }} />
          <Tooltip {...tooltipStyle} formatter={(v) => `${v.toLocaleString("vi-VN")} triệu`} />
          <Legend wrapperStyle={{ fontSize: 12.5 }} />
          <Line type="monotone" dataKey="Tổng" stroke="#4B5563" strokeDasharray="4 3" dot={{ r: 3 }} strokeWidth={2}>
            <LabelList dataKey="Tổng" {...nhanSo} fill="#4B5563" />
          </Line>
          <Line type="monotone" dataKey="VTNet" stroke="#0E6CD6" dot={{ r: 3 }} strokeWidth={2.5}>
            <LabelList dataKey="VTNet" {...nhanSo} fill="#0E6CD6" />
          </Line>
          <Line type="monotone" dataKey="VTT" stroke="#F2A007" dot={{ r: 3 }} strokeWidth={2.5}>
            <LabelList dataKey="VTT" {...nhanSo} fill="#B45309" />
          </Line>
        </LineChart>
      </ResponsiveContainer>
      <GhiChuLuyKe kyGanNhat={loc[loc.length - 1]?.name} />
    </>
  );
}

/**
 * Biểu đồ tròn cơ cấu nguyên nhân phạt của một nhóm (VTT hoặc VTNet) — chọn
 * được đúng một tháng hoặc luỹ kế 6 tháng gần nhất qua ô lọc, mặc định mở ra
 * ở tháng mới nhất. Sắp xếp giảm dần, chú giải riêng bên dưới (giãn dòng)
 * thay vì nhãn chồng nhau trên lát cắt — nhóm có tới 14-15 nguyên nhân nên
 * nhãn trực tiếp trên biểu đồ tròn rất dễ đè lên nhau.
 */
function NhomPhatPie({ title, nhom }) {
  const kyList = nhom?.ky_list || [];
  const [locTheo, setLocTheo] = useState(kyList.length ? kyList[kyList.length - 1] : "luy_ke_6t");
  useEffect(() => {
    if (kyList.length) setLocTheo(kyList[kyList.length - 1]);
  }, [kyList.length ? kyList[kyList.length - 1] : null]);

  if (!kyList.length) return null;
  const coCau = locTheo === "luy_ke_6t" ? (nhom.luy_ke_6_thang || []) : (nhom.theo_ky?.[locTheo] || []);
  const sapXep = [...coCau].sort((a, b) => b.value - a.value);
  const tong = sapXep.reduce((s, x) => s + x.value, 0);
  const soKyLuyKe = Math.min(kyList.length, 6);
  const nhanBoLoc = locTheo === "luy_ke_6t" ? `Luỹ kế ${soKyLuyKe} tháng gần nhất` : `Kỳ ${locTheo}`;
  return (
    <Card title={title} pad={false}
      action={
        <select className="inp" value={locTheo} onChange={(e) => setLocTheo(e.target.value)}
          style={{ maxWidth: 190, fontSize: 12.5, padding: "5px 9px" }}>
          {[...kyList].reverse().map((k) => <option key={k} value={k}>Kỳ {k}</option>)}
          <option value="luy_ke_6t">Luỹ kế {soKyLuyKe} tháng gần nhất</option>
        </select>
      }>
      {!sapXep.length ? (
        <p className="muted" style={{ padding: "16px 18px" }}>Chưa có số liệu cho {nhanBoLoc.toLowerCase()}.</p>
      ) : (
        <div style={{ padding: "8px 18px 18px" }}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={sapXep} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={100} paddingAngle={1.5}>
                {sapXep.map((_, i) => <Cell key={i} fill={MAU_TRON[i % MAU_TRON.length]} />)}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v) => `${v.toLocaleString("vi-VN")} triệu (${Math.round((v / tong) * 100)}%)`} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "9px 16px", marginTop: 10 }}>
            {sapXep.map((x, i) => (
              <div key={x.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: MAU_TRON[i % MAU_TRON.length], flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</span>
                <b className="mono">{Math.round((x.value / tong) * 100)}%</b>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/**
 * Bảng số liệu phạt theo tháng: phạt VTT/VTNet, tổng, lũy kế tổng phạt, tỷ lệ
 * phạt/doanh thu từng tháng và tỷ lệ phạt trung bình lũy kế (trung bình cộng
 * các tháng đã có số liệu, không phải tổng — tỷ lệ % không cộng dồn được).
 */
function BangChiTietPhat({ xuHuong, compare, nam }) {
  const loc = (xuHuong || []).filter((r) => !nam || nam === "all" || r.name?.startsWith(nam));
  if (!loc.length) return null;
  const tiLeTheoKy = {};
  (compare || []).forEach((c) => { if (c.chi_tieu === "Tiền phạt/Doanh thu") tiLeTheoKy[c.ky] = c.thuc_hien; });

  let luyKe = 0;
  let tongTiLe = 0;
  let soThangCoTiLe = 0;
  // Lũy kế phải cộng dồn theo thứ tự thời gian tăng dần, nên tính trước rồi mới
  // đảo lại để HIỂN THỊ tháng mới nhất lên đầu (yêu cầu người dùng).
  const hang = [...loc].sort((a, b) => a.name.localeCompare(b.name)).map((r) => {
    const tong = (r.VTT || 0) + (r.VTNet || 0);
    luyKe += tong;
    const tiLe = tiLeTheoKy[r.name];
    if (tiLe != null) { tongTiLe += tiLe; soThangCoTiLe += 1; }
    return {
      ky: r.name, thang: `T${parseInt(r.name.split("-")[1], 10)}${nam === "all" ? `/${r.name.split("-")[0].slice(2)}` : ""}`,
      vtt: r.VTT || 0, vtnet: r.VTNet || 0, tong, luyKe, tiLe,
      tiLeTbLuyKe: soThangCoTiLe ? tongTiLe / soThangCoTiLe : null,
    };
  }).reverse();

  return (
    <Card title="Số liệu chi tiết phạt theo tháng" icon={ClipboardList} pad={false}>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Tháng</th>
              <th style={{ textAlign: "right" }}>Phạt VTT (triệu)</th>
              <th style={{ textAlign: "right" }}>Phạt VTNet (triệu)</th>
              <th style={{ textAlign: "right" }}>Tổng phạt (triệu)</th>
              <th style={{ textAlign: "right" }}>Lũy kế tổng phạt (triệu)</th>
              <th style={{ textAlign: "right" }}>Tỷ lệ phạt/DT</th>
              <th style={{ textAlign: "right" }}>TB lũy kế tỷ lệ phạt/DT</th>
            </tr>
          </thead>
          <tbody>
            {hang.map((h) => (
              <tr key={h.ky}>
                <td className="mono">{h.thang}</td>
                <td className="mono" style={{ textAlign: "right" }}>{h.vtt.toLocaleString("vi-VN")}</td>
                <td className="mono" style={{ textAlign: "right" }}>{h.vtnet.toLocaleString("vi-VN")}</td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 600 }}>{h.tong.toLocaleString("vi-VN")}</td>
                <td className="mono" style={{ textAlign: "right", color: RED_DARK }}>{h.luyKe.toLocaleString("vi-VN")}</td>
                <td className="mono" style={{ textAlign: "right" }}>{h.tiLe != null ? `${h.tiLe.toFixed(2)}%` : "—"}</td>
                <td className="mono" style={{ textAlign: "right", fontWeight: 600 }}>{h.tiLeTbLuyKe != null ? `${h.tiLeTbLuyKe.toFixed(2)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "0 18px 16px" }}>
        <GhiChuLuyKe kyGanNhat={hang[0]?.ky} />
      </div>
    </Card>
  );
}

/**
 * Bảng đánh giá KPI theo mẫu chuẩn: TT | KPI | Đơn vị | Target | Thực hiện |
 * So target (Kết quả/Đánh giá) | Cùng kỳ (Kết quả/Đánh giá/Giá trị) — chỉ lấy
 * kỳ mới nhất. `huongTot`: "thap" (càng thấp càng tốt, mặc định — sự cố,
 * ksub*min, GĐTT, tiền phạt, rời mạng) hoặc "cao" (càng cao càng tốt — XLCS,
 * KPI TKM).
 */
function BangDanhGiaKPI({ compare, chiTieuList, huongTot = "thap", nhanChiTieu }) {
  const rowsCa = (compare || []).filter((c) => chiTieuList.includes(c.chi_tieu));
  if (!rowsCa.length) return null;
  const kyMoiNhat = rowsCa.reduce((max, r) => (r.ky > max ? r.ky : max), rowsCa[0].ky);
  const rows = rowsCa.filter((r) => r.ky === kyMoiNhat);
  if (!rows.length) return null;

  const nhom = chiTieuList
    .map((ct) => ({ chiTieu: ct, hang: rows.filter((r) => r.chi_tieu === ct).sort((a, b) => sapXepDonVi(a.don_vi, b.don_vi)) }))
    .filter((n) => n.hang.length > 0);

  // Kết quả luôn là chênh lệch thô (Thực hiện - Target)/Target: dương nghĩa là
  // thực hiện VƯỢT target. huongTot chỉ quyết định vượt là tốt hay xấu —
  // càng thấp càng tốt (sự cố, ksub*min, GĐTT, tiền phạt, rời mạng) thì vượt
  // (dương) là chưa đạt/tồi đi; càng cao càng tốt (XLCS, KPI TKM) thì vượt là đạt.
  const soTarget = (r) => (r.target == null ? null : ((r.thuc_hien - r.target) / r.target) * 100);

  return (
    <Card title={`Đánh giá KPI so với target & cùng kỳ — kỳ ${kyMoiNhat}`} icon={ShieldCheck} pad={false}>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>TT</th><th>KPI</th><th>Đơn vị</th>
              <th style={{ textAlign: "right" }}>Target</th><th style={{ textAlign: "right" }}>Thực hiện</th>
              <th style={{ textAlign: "right" }}>So target — Kết quả</th><th>So target — Đánh giá</th>
              <th style={{ textAlign: "right" }}>Cùng kỳ — Kết quả</th><th>Cùng kỳ — Đánh giá</th>
              <th style={{ textAlign: "right" }}>Cùng kỳ — Giá trị</th>
            </tr>
          </thead>
          <tbody>
            {nhom.map((n, idx) => n.hang.map((r, j) => {
              const kq = soTarget(r);
              // "thap": vượt target (kq dương) là chưa đạt. "cao": vượt target (kq dương) là đạt.
              const dat = kq == null ? null : (huongTot === "thap" ? kq <= 0 : kq >= 0);
              const kqCk = r.chenh_lech_cung_ky_phan_tram;
              const totCungKy = kqCk == null ? null : (huongTot === "thap" ? kqCk <= 0 : kqCk >= 0);
              const nhanCungKy = huongTot === "thap"
                ? (totCungKy ? "Cải thiện" : "Kém đi")
                : (totCungKy ? "Tăng trưởng" : "Suy giảm");
              return (
                <tr key={`${n.chiTieu}-${r.don_vi || j}`}>
                  {j === 0 && <td className="mono" rowSpan={n.hang.length} style={{ textAlign: "center", fontWeight: 700 }}>{idx + 1}</td>}
                  {j === 0 && <td rowSpan={n.hang.length} style={{ fontWeight: 700 }}>{nhanChiTieu?.[n.chiTieu] || n.chiTieu}</td>}
                  <td className="muted">{r.don_vi || "Chi nhánh"}</td>
                  <td className="mono muted" style={{ textAlign: "right" }}>{soTheoChiTieu(r.target, n.chiTieu)}</td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 600 }}>{soTheoChiTieu(r.thuc_hien, n.chiTieu)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{kq != null ? `${kq > 0 ? "+" : ""}${kq.toFixed(2)}%` : "—"}</td>
                  <td>{dat == null ? <span className="muted">—</span> : <span className={`tag ${dat ? "tag-green" : "tag-red"}`}>{dat ? "Đạt" : "Chưa đạt"}</span>}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{kqCk != null ? `${kqCk > 0 ? "+" : ""}${kqCk}%` : "—"}</td>
                  <td>{totCungKy == null ? <span className="muted">—</span> : <span className={`tag ${totCungKy ? "tag-green" : "tag-amber"}`}>{nhanCungKy}</span>}</td>
                  <td className="mono muted" style={{ textAlign: "right" }}>{soTheoChiTieu(r.cung_ky_truoc, n.chiTieu)}</td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function NhanNguon({ nguon }) {
  const nhan = {
    sheet: ["Nguồn: Google Sheet", "tag-green"],
    database: ["Nguồn: dữ liệu trong hệ thống", "tag-grey"],
    mau: ["Đang hiển thị số liệu mẫu", "tag-amber"],
  }[nguon] || ["", "tag-grey"];
  return <span className={`tag ${nhan[1]}`}>{nhan[0]}</span>;
}

// So sánh cùng kỳ trên toàn Dashboard luôn lấy năm 2026 làm năm hiện tại (đối
// chiếu với 2025) — không cho chọn năm khác để tránh rối, theo yêu cầu người dùng.
const NAM_HIEN_TAI = "2026";

// Thứ tự hiển thị các chỉ tiêu trong cùng một kỳ ở bảng "Đối chiếu chỉ tiêu &
// cùng kỳ năm trước" — mặc định (chưa liệt kê) giữ nguyên thứ tự dữ liệu trả về.
const THU_TU_CHI_TIEU = {
  "Số PA phát sinh trong tháng": 0, "XLCS 3h": 1, "XLCS 10h": 2, "XLCS 24h": 3,
  "Tổng triển khai đã NT": 0, "Triển khai đã NT dây mới": 1, "Triển khai đã NT dây sẵn": 2,
  "KPI TKM 3H": 3, "KPI TKM 10H": 4, "KPI TKM 24H": 5,
};

// Thứ tự đơn vị dùng chung cho MỌI bảng và biểu đồ: mức toàn chi nhánh trước,
// rồi Bình Dương, rồi Vũng Tàu — đúng thứ tự đọc của báo cáo gốc. Trung tâm và
// huyện không nằm trong danh sách thì xếp sau, theo vần.
const THU_TU_DON_VI = { "VCC HCM": 0, BDG: 1, VTU: 2 };
export function sapXepDonVi(a, b) {
  const x = THU_TU_DON_VI[a] ?? 50, y = THU_TU_DON_VI[b] ?? 50;
  return x - y || (a || "").localeCompare(b || "", "vi");
}

/**
 * Đơn vị đo của từng chỉ tiêu, để bảng hiện "0,93%" chứ không phải "0,93" trơ
 * trọi — người đọc không phải tự nhớ chỉ tiêu nào là tỷ lệ, chỉ tiêu nào là số
 * tuyệt đối. Chỉ tiêu chưa liệt kê mà tên bắt đầu bằng "Tỷ lệ" thì mặc định là %.
 */
const DON_VI_CHI_TIEU = {
  "Tiền phạt/Doanh thu": "%", "Tỷ lệ phạt/DT VTT": "%", "Tỷ lệ phạt/DT VTNet": "%",
  "XLCS 3h": "%", "XLCS 10h": "%", "XLCS 24h": "%",
  "KPI TKM 3H": "%", "KPI TKM 10H": "%", "KPI TKM 24H": "%",
  "Doanh thu": "triệu đ",
};
export function donViChiTieu(ct) {
  return DON_VI_CHI_TIEU[ct] ?? (/^Tỷ lệ/.test(ct || "") ? "%" : "");
}
/** Số kèm đơn vị, hoặc "—" khi chưa có số. */
export function soTheoChiTieu(v, ct) {
  if (v == null) return "—";
  const dv = donViChiTieu(ct);
  const so = v.toLocaleString("vi-VN");
  return dv === "%" ? `${so}%` : dv ? `${so} ${dv}` : so;
}

export function DashView() {
  const [ma, setMa] = useState("KPI");
  const [duLieu, setDuLieu] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");

  const board = BOARDS[ma];

  useEffect(() => {
    let con = true;
    setDangTai(true); setLoi("");
    api.get(`/api/dashboard/${ma}`)
      .then((d) => { if (con) setDuLieu(d); })
      .catch((e) => {
        if (!con) return;
        setDuLieu(null);
        // 404 nghĩa là chưa có số liệu, không phải lỗi hệ thống
        if (!/404|chưa có số liệu/i.test(e.message)) setLoi(e.message);
      })
      .finally(() => con && setDangTai(false));
    return () => { con = false; };
  }, [ma]);

  const coSoThat = duLieu?.series?.length > 0;
  const seriesGoc = coSoThat ? duLieu.series : board.mau;
  // Chuỗi có thể là theo đơn vị (VCC HCM/BDG/VTU) hoặc theo kỳ. Theo đơn vị thì
  // xếp đúng thứ tự báo cáo; theo kỳ thì kỳ mới nhất lên trước như cũ.
  const laChuoiTheoDonVi = seriesGoc.some((r) => THU_TU_DON_VI[r.name] != null);
  const series = laChuoiTheoDonVi
    ? [...seriesGoc].sort((a, b) => sapXepDonVi(a.name, b.name))
    : seriesGoc;
  const nguon = coSoThat ? (duLieu.source || "database") : "mau";
  const laKPI = ma === "KPI";     // Tiền phạt & Doanh thu — biểu đồ xu thế Target/năm nay/năm trước
  const laWO = ma === "WO";       // Rời mạng CĐBR — 2 biểu đồ: cột (số lượng) + xu thế (tỷ lệ)
  const laVHKT = ma === "VHKT";   // KPI vận hành — kèm cảnh báo trung tâm chưa đạt
  const laPAKH = ma === "PAKH";   // Sự cố truyền dẫn — theo tỉnh
  const laFUEL = ma === "FUEL";   // Ksub*min — theo tỉnh
  const laOUTPUT = ma === "OUTPUT"; // GĐTT & Cell*h — theo tỉnh
  const laNETWORK = ma === "NETWORK"; // XLCS CĐBR — Số PA phát sinh + XLCS 3h/10h/24h
  const laTheoTinh = laPAKH || laFUEL || laOUTPUT;
  // Chiều "tốt" của bảng đang xem — dùng để tô màu/đánh giá đúng chiều ở bảng đối chiếu nhiều tháng bên dưới.
  const huongTotHienTai = (laPAKH || laFUEL || laOUTPUT || laWO || laKPI) ? "thap" : (laNETWORK || laVHKT) ? "cao" : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 scroll-x">
        {Object.values(BOARDS).map((b) => (
          <button key={b.ma} className={`chip ${ma === b.ma ? "on" : ""}`} onClick={() => setMa(b.ma)}>
            {b.nhan}
          </button>
        ))}
      </div>

      {loi && (
        <div className="card" style={{ padding: 14, borderLeft: `3px solid ${RED}` }}>
          <p style={{ fontSize: 13.5, color: RED_DARK }}>{loi}</p>
        </div>
      )}

      {dangTai ? (
        <Card title={board.tieuDe} icon={board.icon}>
          <p className="muted" style={{ fontSize: 13.5, padding: "40px 0", textAlign: "center" }}>
            Đang tải số liệu…
          </p>
        </Card>
      ) : laKPI ? (
        <>
          <Card title={board.tieuDe} icon={board.icon} action={<NhanNguon nguon={nguon} />}>
            <TrendChart compare={duLieu?.compare} chiTieu="Tiền phạt/Doanh thu" namHienTai={2026} />
          </Card>
          <Card title="Tỷ lệ phạt/doanh thu — Tổng / VTT / VTNet" icon={board.icon}>
            <BieuDoNhieuChiTieu compare={duLieu?.compare} nam={NAM_HIEN_TAI}
              chiTieuList={["Tiền phạt/Doanh thu", "Tỷ lệ phạt/DT VTNet", "Tỷ lệ phạt/DT VTT"]}
              nhanChiTieu={{ "Tiền phạt/Doanh thu": "Tổng", "Tỷ lệ phạt/DT VTNet": "VTNet", "Tỷ lệ phạt/DT VTT": "VTT" }}
              mauMap={{ "Tiền phạt/Doanh thu": "#4B5563", "Tỷ lệ phạt/DT VTNet": "#0E6CD6", "Tỷ lệ phạt/DT VTT": "#F2A007" }}
              dinhDang={dinhDangPhanTram} />
          </Card>
          {duLieu?.nhom_phat && (
            <>
              <Card title="Nhóm nguyên nhân phạt Tổng / VTT / VTNet — tiền phạt theo tháng" icon={board.icon}>
                <NhomPhatTrend xuHuong={duLieu.nhom_phat.xu_huong} nam={NAM_HIEN_TAI} />
              </Card>
              <div className="grid lg:grid-cols-2 gap-4">
                <NhomPhatPie title="Cơ cấu nguyên nhân phạt VTNet" nhom={duLieu.nhom_phat.vtnet} />
                <NhomPhatPie title="Cơ cấu nguyên nhân phạt VTT" nhom={duLieu.nhom_phat.vtt} />
              </div>
              <BangChiTietPhat xuHuong={duLieu.nhom_phat.xu_huong} compare={duLieu?.compare} nam={NAM_HIEN_TAI} />
            </>
          )}
          <BangDanhGiaKPI compare={duLieu?.compare} huongTot="thap"
            chiTieuList={["Tiền phạt/Doanh thu", "Tỷ lệ phạt/DT VTNet", "Tỷ lệ phạt/DT VTT"]}
            nhanChiTieu={{ "Tiền phạt/Doanh thu": "Tổng", "Tỷ lệ phạt/DT VTNet": "VTNet", "Tỷ lệ phạt/DT VTT": "VTT" }} />
        </>
      ) : laWO ? (
        <>
          <Card title="Số lượng KH rời mạng" icon={board.icon} action={<NhanNguon nguon={nguon} />}>
            {duLieu?.dia_ban?.tinh?.length > 0
              ? <SoLuongRoMangTheoTinh theoTinh={duLieu.dia_ban.tinh} />
              : <BieuDo kieu="cot-don" series={seriesMotChiTieu(series, "Số lượng KH rời mạng")} />}
          </Card>
          <Card title="Tỷ lệ rời mạng CĐBR" icon={board.icon}>
            <TrendChart compare={duLieu?.compare} chiTieu="Tỷ lệ rời mạng CĐBR" namHienTai={2026} />
          </Card>
          <BangDanhGiaKPI compare={duLieu?.compare} chiTieuList={["Tỷ lệ rời mạng CĐBR"]} huongTot="thap" />
          <BangRoMangTheoHuyen diaBan={duLieu?.dia_ban} />
        </>
      ) : laPAKH ? (
        <>
          <Card title="Số sự cố truyền dẫn theo tháng" icon={board.icon} action={<NhanNguon nguon={nguon} />}>
            <BieuDoTheoTinh compare={duLieu?.compare} chiTieu="Số sự cố truyền dẫn" nam={NAM_HIEN_TAI} />
          </Card>
          <BangDanhGiaKPI compare={duLieu?.compare} chiTieuList={["Số sự cố truyền dẫn"]} huongTot="thap" />
        </>
      ) : laFUEL ? (
        <>
          <Card title="Ksub*min theo tháng" icon={board.icon} action={<NhanNguon nguon={nguon} />}>
            <BieuDoTheoTinh compare={duLieu?.compare} chiTieu="Ksub*min" nam={NAM_HIEN_TAI} />
          </Card>
          <BangDanhGiaKPI compare={duLieu?.compare} chiTieuList={["Ksub*min"]} huongTot="thap" />
        </>
      ) : laOUTPUT ? (
        <>
          <Card title="Cell*h tổng theo tháng" icon={board.icon} action={<NhanNguon nguon={nguon} />}>
            <BieuDoTheoTinh compare={duLieu?.compare} chiTieu="Cell*h tổng" nam={NAM_HIEN_TAI} />
          </Card>
          <Card title="GĐTT trạm thường" icon={board.icon}>
            <BieuDoTheoTinh compare={duLieu?.compare} chiTieu="GĐTT trạm thường" nam={NAM_HIEN_TAI} />
          </Card>
          <Card title="GĐTT trạm ưu tiên" icon={board.icon}>
            <BieuDoTheoTinh compare={duLieu?.compare} chiTieu="GĐTT trạm ưu tiên" nam={NAM_HIEN_TAI} />
          </Card>
          <BangDanhGiaKPI compare={duLieu?.compare} huongTot="thap"
            chiTieuList={["Cell*h tổng", "GĐTT trạm thường", "GĐTT trạm ưu tiên"]} />
        </>
      ) : laNETWORK ? (
        <>
          <Card title="Số phản ánh phát sinh trong tháng" icon={board.icon} action={<NhanNguon nguon={nguon} />}>
            <BieuDoNhieuChiTieu compare={duLieu?.compare} nam={NAM_HIEN_TAI} chiTieuList={["Số PA phát sinh trong tháng"]}
              dinhDang={(v) => v?.toLocaleString("vi-VN")} mauMap={{ "Số PA phát sinh trong tháng": "#4B5563" }} />
          </Card>
          <Card title="XLCS trong 3h / 10h / 24h" icon={board.icon}>
            <BieuDoNhieuChiTieu compare={duLieu?.compare} nam={NAM_HIEN_TAI}
              chiTieuList={["XLCS 3h", "XLCS 10h", "XLCS 24h"]}
              mauMap={{ "XLCS 3h": RED, "XLCS 10h": "#0E6CD6", "XLCS 24h": "#0A7A50" }}
              dinhDang={dinhDangPhanTram} />
          </Card>
          <BangDanhGiaKPI compare={duLieu?.compare} huongTot="cao"
            chiTieuList={["XLCS 3h", "XLCS 10h", "XLCS 24h"]} />
        </>
      ) : laVHKT ? (
        <>
          <Card title="Triển khai mới CĐBR — dây mới / dây sẵn" icon={board.icon} action={<NhanNguon nguon={nguon} />}>
            <BieuDoNhieuChiTieu compare={duLieu?.compare} nam={NAM_HIEN_TAI}
              chiTieuList={["Triển khai đã NT dây mới", "Triển khai đã NT dây sẵn"]}
              nhanChiTieu={{ "Triển khai đã NT dây mới": "Dây mới", "Triển khai đã NT dây sẵn": "Dây sẵn" }}
              mauMap={{ "Triển khai đã NT dây mới": "#0E6CD6", "Triển khai đã NT dây sẵn": "#4B5563" }}
              dinhDang={(v) => v?.toLocaleString("vi-VN")} />
          </Card>
          <Card title="KPI TKM 3h / 10h / 24h">
            <BieuDoNhieuChiTieu compare={duLieu?.compare} nam={NAM_HIEN_TAI}
              chiTieuList={["KPI TKM 3H", "KPI TKM 10H", "KPI TKM 24H"]}
              mauMap={{ "KPI TKM 3H": RED, "KPI TKM 10H": "#0E6CD6", "KPI TKM 24H": "#0A7A50" }}
              dinhDang={dinhDangPhanTram} />
          </Card>
          <BangDanhGiaKPI compare={duLieu?.compare} huongTot="cao"
            chiTieuList={["KPI TKM 3H", "KPI TKM 10H", "KPI TKM 24H"]} />
        </>
      ) : (
        <Card title={board.tieuDe} icon={board.icon} action={<NhanNguon nguon={nguon} />}>
          <BieuDo kieu={board.ve} series={series} />

          {nguon === "mau" && (
            <p style={{ background: "#FFF8E8", color: "#6B5426", fontSize: 12.5,
                        padding: "10px 13px", borderRadius: 9, marginTop: 12, lineHeight: 1.6 }}>
              Chưa có số liệu thật cho bảng này nên đang hiển thị số liệu mẫu.
              Nhập số tại <strong>Quản trị → Quản lý dashboard</strong>, hoặc nối bảng tính tại{" "}
              <strong>Nguồn dữ liệu Sheet</strong>.
            </p>
          )}
        </Card>
      )}

      {laVHKT && <CanhBaoTrungTam danhSach={duLieu?.canh_bao_trung_tam} />}

      {duLieu?.compare?.length > 0 && (
        <Card title="Đối chiếu chỉ tiêu & cùng kỳ năm trước" icon={ArrowUpRight} pad={false}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Kỳ</th><th>Chỉ tiêu</th><th>Đơn vị</th><th style={{ textAlign: "right" }}>Thực hiện</th>
                  <th style={{ textAlign: "right" }}>Target</th><th style={{ textAlign: "right" }}>So target</th><th>Đánh giá</th>
                  <th style={{ textAlign: "right" }}>Cùng kỳ trước</th><th style={{ textAlign: "right" }}>Chênh lệch</th><th>Đánh giá</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const hang = [...duLieu.compare].sort((a, b) =>
                    b.ky.localeCompare(a.ky)
                    || (THU_TU_CHI_TIEU[a.chi_tieu] ?? 99) - (THU_TU_CHI_TIEU[b.chi_tieu] ?? 99)
                    || (a.chi_tieu || "").localeCompare(b.chi_tieu || "", "vi")
                    || sapXepDonVi(a.don_vi, b.don_vi));
                  // Gộp ô "Kỳ" cho các dòng liên tiếp cùng tháng (rowSpan), giống mẫu báo cáo.
                  const soDongTheoKy = hang.map((c, i) => i === 0 || hang[i - 1].ky !== c.ky ? hang.filter((x) => x.ky === c.ky).length : 0);
                  return hang.map((c, i) => {
                    // Chênh lệch thô: dương = thực hiện vượt target/cùng kỳ trước. huongTot quyết định
                    // vượt là tốt (huongTot="cao") hay xấu (huongTot="thap", mặc định khi chưa rõ bảng).
                    const hg = huongTotHienTai || "thap";
                    const soTarget = c.target ? ((c.thuc_hien - c.target) / c.target) * 100 : null;
                    const dat = soTarget == null ? null : (hg === "thap" ? soTarget <= 0 : soTarget >= 0);
                    const kqCk = c.chenh_lech_cung_ky_phan_tram;
                    const totCungKy = kqCk == null ? null : (hg === "thap" ? kqCk <= 0 : kqCk >= 0);
                    return (
                    <tr key={i}>
                      {soDongTheoKy[i] > 0 && (
                        <td className="mono" rowSpan={soDongTheoKy[i]} style={{ verticalAlign: "top", borderRight: "1px solid #EEE" }}>{c.ky}</td>
                      )}
                      <td style={{ fontWeight: 600 }}>{c.chi_tieu}</td>
                      <td className="muted">{c.don_vi || "—"}</td>
                      <td className="mono" style={{ textAlign: "right" }}>{soTheoChiTieu(c.thuc_hien, c.chi_tieu)}</td>
                      <td className="mono muted" style={{ textAlign: "right" }}>{soTheoChiTieu(c.target, c.chi_tieu)}</td>
                      <td className="mono" style={{ textAlign: "right", color: dat == null ? undefined : (dat ? "#0A7A50" : RED) }}>
                        {soTarget != null ? `${soTarget > 0 ? "+" : ""}${soTarget.toFixed(2)}%` : "—"}
                      </td>
                      <td>{dat == null ? <span className="muted">—</span> : <span className={`tag ${dat ? "tag-green" : "tag-red"}`}>{dat ? "Đạt target" : "Không đạt target"}</span>}</td>
                      <td className="mono muted" style={{ textAlign: "right" }}>{soTheoChiTieu(c.cung_ky_truoc, c.chi_tieu)}</td>
                      <td className="mono" style={{ textAlign: "right", color: totCungKy == null ? undefined : (totCungKy ? "#0A7A50" : RED) }}>
                        {kqCk != null ? `${kqCk > 0 ? "+" : ""}${kqCk}%` : "—"}
                      </td>
                      <td>{totCungKy == null ? <span className="muted">—</span> : <span className={`tag ${totCungKy ? "tag-green" : "tag-red"}`}>{totCungKy ? "Cải thiện" : "Suy giảm"}</span>}</td>
                    </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {coSoThat && !laTheoTinh && (
        <Card title="Số liệu chi tiết" icon={BarChart3} pad={false}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Kỳ / Đơn vị</th>
                  {cotSoLieu(series).map((c) => <th key={c} style={{ textAlign: "right" }}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {(laChuoiTheoDonVi
                  ? series
                  : [...series].sort((a, b) => String(b.name).localeCompare(String(a.name)))
                ).map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    {cotSoLieu(series).map((c) => (
                      <td key={c} className="mono" style={{ textAlign: "right" }}>
                        {r[c] != null ? soTheoChiTieu(Number(r[c]), c) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {ma === "HIRE" && <DashRecruitmentPanel />}
    </div>
  );
}

/** Khung tuyển dụng cố định ở cuối trang Dashboard, lấy đúng dữ liệu tuyển dụng thật đang có. */
function DashRecruitmentPanel() {
  const [s] = useRemote("/api/recruitment/summary", null);
  if (!s) return null;
  const statusCount = (key) => s.by_status?.find((x) => x.status === key)?.count ?? 0;
  const the = [
    ["Tổng hồ sơ nhận", s.total ?? 0, RED],
    ["Thiếu OFT", s.staffing?.total_oft_gap ?? 0, "#B45309"],
    ["Thiếu FT", s.staffing?.total_ft_gap ?? 0, "#B45309"],
    ["HS đang trao đổi", statusCount("negotiating"), undefined],
  ];
  return (
    <Card title="Tuyển dụng" icon={UserPlus} pad={false}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={{ padding: 16 }}>
        {the.map(([nhan, gt, mau]) => (
          <div key={nhan}>
            <p className="muted" style={{ fontSize: 12 }}>{nhan}</p>
            <p style={{ fontSize: 24, fontWeight: 800, marginTop: 5, color: mau }}>{gt}</p>
          </div>
        ))}
      </div>
      {(s.staffing?.centers || []).length > 0 && (
        <div style={{ overflowX: "auto", borderTop: "1px solid #EFECED" }}>
          <table className="tbl">
            <thead><tr><th>Trung tâm</th><th style={{ textAlign: "right" }}>Thiếu OFT</th><th style={{ textAlign: "right" }}>Thiếu FT</th><th style={{ textAlign: "right" }}>Tổng thiếu</th></tr></thead>
            <tbody>
              {s.staffing.centers.map((c) => (
                <tr key={c.center}>
                  <td>{c.center}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{c.oft_gap}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{c.ft_gap}</td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 700, color: c.total_gap >= 8 ? RED : undefined }}>{c.total_gap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ============================== SÁNG KIẾN ============================== */

export function IdeasView() {
  const [remote] = useRemote("/api/ideas", D.IDEAS_FB, adapt.ideas);
  const [ideas, setIdeas] = useState(D.IDEAS_FB);
  useEffect(() => setIdeas(remote), [remote]);

  const [voted, setVoted] = useState({});
  const [xem, setXem] = useState(null);      // sáng kiến đang xem chi tiết
  const [form, setForm] = useState(false);
  const [title, setTitle] = useState("");
  const [benefit, setBenefit] = useState("");

  const vote = (id) => {
    if (voted[id]) return;
    setVoted((v) => ({ ...v, [id]: true }));
    setIdeas((l) => l.map((i) => (i.id === id ? { ...i, votes: i.votes + 1 } : i)));
    api.post(`/api/ideas/${id}/vote`).catch(() => {});
  };

  const submit = () => {
    if (!title.trim()) return;
    setIdeas((l) => [{
      id: Date.now(), title, author: "Bạn", dept: "Phòng VHKT", status: "Chờ duyệt",
      votes: 0, saved: benefit || "Chưa ước tính", date: new Date().toLocaleDateString("vi-VN"),
    }, ...l]);
    api.post("/api/ideas", { title, benefit }).catch(() => {});
    setTitle(""); setBenefit(""); setForm(false);
  };

  const tagOf = (s) => (s === "Đã áp dụng" ? "tag-green" : s === "Đang triển khai" ? "tag-amber" : "tag-grey");

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-center justify-between gap-4" style={{ padding: 16, flexWrap: "wrap", borderLeft: `3px solid ${RED}` }}>
        <div className="flex items-center gap-3">
          <Lightbulb size={20} style={{ color: RED }} />
          <div>
            <p style={{ fontWeight: 700, fontSize: 14.5 }}>Sáng kiến quý III/2026</p>
            <p className="muted" style={{ fontSize: 12.5 }}>{ideas.length} sáng kiến · Hội đồng chấm ngày 26/08</p>
          </div>
        </div>
        <button className="btn btn-red" onClick={() => setForm(true)}><Plus size={15} /> Đăng sáng kiến</button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {ideas.map((i) => (
          <div key={i.id} className="card row-hover" style={{ padding: 16, cursor: "pointer" }}
            onClick={() => setXem(i)}>
            <div className="flex items-start justify-between gap-3">
              <span className={`tag ${tagOf(i.status)}`}>{i.status}</span>
              <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); vote(i.id); }}
                style={voted[i.id] ? { background: RED, borderColor: RED, color: "#fff" } : undefined}>
                <ThumbsUp size={13} /> <span className="mono">{i.votes}</span>
              </button>
            </div>
            <h3 style={{ fontWeight: 700, fontSize: 14.5, marginTop: 10, lineHeight: 1.35 }}>{i.title}</h3>
            <p style={{ fontSize: 12.5, marginTop: 8, color: "#0A7A50", fontWeight: 600 }}>
              <Check size={13} style={{ display: "inline", marginRight: 4 }} />{i.saved}
            </p>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{i.author} · {i.dept} · {i.date}</p>
            <p className="link" style={{ fontSize: 12.5, marginTop: 8 }}>Xem chi tiết ›</p>
            <div className="bar-track" style={{ marginTop: 12 }}>
              <div className="bar-fill" style={{ background: RED, width: i.status === "Đã áp dụng" ? "100%" : i.status === "Đang triển khai" ? "60%" : "25%" }} />
            </div>
          </div>
        ))}
      </div>

      {xem && (
        <Sheet rong title="Chi tiết sáng kiến" icon={Lightbulb} onClose={() => setXem(null)}>
          <div className="flex items-center gap-2" style={{ marginBottom: 12, flexWrap: "wrap" }}>
            <span className={`tag ${tagOf(xem.status)}`}>{xem.status}</span>
            <span className="tag tag-grey"><ThumbsUp size={11} /> {xem.votes} bình chọn</span>
          </div>

          <h2 style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.35 }}>{xem.title}</h2>

          <p style={{ fontSize: 14, marginTop: 12, color: "#0A7A50", fontWeight: 600 }}>
            <Check size={14} style={{ display: "inline", marginRight: 5 }} />
            Lợi ích: {xem.saved || xem.benefit || "Chưa ước tính"}
          </p>

          <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
            Người đề xuất: {xem.author} · {xem.dept} · {xem.date}
          </p>

          {xem.body ? (
            <div style={{ fontSize: 14.5, lineHeight: 1.8, marginTop: 18, whiteSpace: "pre-wrap",
                          paddingTop: 16, borderTop: "1px solid #F1EEEF" }}>
              {xem.body}
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 13.5, marginTop: 18, fontStyle: "italic",
                                          paddingTop: 16, borderTop: "1px solid #F1EEEF" }}>
              Sáng kiến này chưa có mô tả chi tiết.
            </p>
          )}

          <div className="flex gap-2" style={{ marginTop: 22 }}>
            <button className="btn btn-red" disabled={!!voted[xem.id]}
              onClick={() => { vote(xem.id); setXem({ ...xem, votes: xem.votes + (voted[xem.id] ? 0 : 1) }); }}>
              <ThumbsUp size={15} /> {voted[xem.id] ? "Đã bình chọn" : "Bình chọn"}
            </button>
          </div>
        </Sheet>
      )}

      {form && (
        <div className="sheet" onClick={(e) => e.target === e.currentTarget && setForm(false)}>
          <div className="card" style={{ width: "min(520px,100%)", padding: 20, borderRadius: 16 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <h3 style={{ fontWeight: 800, fontSize: 17 }}>Đăng sáng kiến</h3>
              <button className="btn btn-sm" onClick={() => setForm(false)}><X size={14} /></button>
            </div>
            <label className="field"><span>Tên sáng kiến</span>
              <input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mô tả ngắn gọn cách làm mới" />
            </label>
            <label className="field"><span>Lợi ích mang lại</span>
              <textarea className="inp" rows={3} value={benefit} onChange={(e) => setBenefit(e.target.value)}
                placeholder="Ví dụ: rút ngắn 15 phút mỗi lượt kiểm tra trạm" />
            </label>
            <div className="flex gap-2">
              <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={() => setForm(false)}>Huỷ</button>
              <button className="btn btn-red" style={{ flex: 1, justifyContent: "center" }} onClick={submit}>Gửi sáng kiến</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== VĂN HOÁ ============================== */


/**
 * Cuộc thi ảnh. Lấy ảnh từ album, chọn những mục thuộc album có chữ "thi ảnh".
 * Bình chọn lưu tại máy người dùng, mỗi người chọn một tác phẩm.
 */
function ThiAnh() {
  const [media] = useRemote("/api/media?kind=image", null);
  const [chon, setChon] = useState(null);
  const [xem, setXem] = useState(null);

  const ds = (media || []).filter((m) => /thi ảnh|cuộc thi/i.test(m.album || ""));

  if (!media) return null;

  if (ds.length === 0) {
    return (
      <Card title="Cuộc thi ảnh" icon={Trophy}>
        <Empty title="Chưa có cuộc thi ảnh nào đang diễn ra."
          hint="Quản trị viên thêm ảnh tại Quản trị → Album ảnh và video, đặt tên album chứa chữ “thi ảnh”." />
      </Card>
    );
  }

  return (
    <>
      <Card title={`Cuộc thi ảnh: ${ds[0].album}`} icon={Trophy}
        action={<span className="muted" style={{ fontSize: 12 }}>{ds.length} tác phẩm</span>}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {ds.map((m) => (
            <div key={m.id}>
              <div onClick={() => setXem(m)} title="Bấm để xem ảnh lớn"
                style={{ height: 130, background: m.color || RED, borderRadius: 12,
                         display: "grid", placeItems: "center", cursor: "zoom-in", overflow: "hidden" }}>
                {m.url
                  ? <img src={m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <ImageIcon size={26} color="#fff" />}
              </div>
              <p style={{ fontWeight: 600, fontSize: 13, marginTop: 8 }}>{m.title}</p>
              <p className="muted" style={{ fontSize: 12 }}>{m.author}</p>
              <button className="btn btn-sm"
                style={{ marginTop: 8, width: "100%", justifyContent: "center",
                         ...(chon === m.id ? { background: RED, borderColor: RED, color: "#fff" } : {}) }}
                onClick={() => setChon(m.id)}>
                <Star size={13} /> {chon === m.id ? "Đã bình chọn" : "Bình chọn"}
              </button>
            </div>
          ))}
        </div>
        {chon && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
            Mỗi người bình chọn một tác phẩm.
          </p>
        )}
      </Card>

      {xem && <Lightbox src={xem.url} caption={`${xem.title} — ${xem.author || ""}`} onClose={() => setXem(null)} />}
    </>
  );
}

export function CultureView() {
  const [birthdays] = useRemote("/api/birthdays", null);
  const [events] = useRemote("/api/events", D.EVENTS_FB);
  const [wishes, setWishes] = useState({});
  const [anh, setAnh] = useState(null);        // ảnh đang xem phóng to
  const [suKien, setSuKien] = useState(null);  // sự kiện đang xem chi tiết

  const bdays = birthdays?.length ? birthdays : [];
  const evts = events?.length ? events : D.EVENTS_FB;
  const dm = (iso) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Sinh nhật trong tháng" icon={Cake} pad={false}>
          {bdays.length === 0
            ? <Empty title="Chưa có dữ liệu sinh nhật." hint="Quản trị viên nhập ngày sinh tại Quản trị → Quản lý nhân viên." />
            : bdays.map((b, i) => (
              <div key={i} className="flex items-center gap-3" style={{ padding: "12px 16px", borderTop: i ? "1px solid #F1EEEF" : 0 }}>
                <Avatar name={b.name} color={b.color} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 13.5 }}>{b.name}</p>
                  <p className="muted" style={{ fontSize: 12 }}>{b.dept} · {b.day}</p>
                </div>
                <button className="btn btn-sm" onClick={() => setWishes((w) => ({ ...w, [b.name]: true }))}
                  style={wishes[b.name] ? { background: RED, borderColor: RED, color: "#fff" } : undefined}>
                  {wishes[b.name] ? <><Check size={13} /> Đã chúc</> : <><PartyPopper size={13} /> Chúc mừng</>}
                </button>
              </div>
            ))}
        </Card>

        <Card title="Sự kiện sắp diễn ra" icon={Calendar} pad={false}>
          {evts.length === 0
            ? <Empty title="Chưa có sự kiện nào." hint="Quản trị viên thêm tại Quản trị → Góc văn hoá." />
            : evts.map((e, i) => (
              <div key={e.id || i} className="flex gap-3 row-hover" onClick={() => setSuKien(e)}
                style={{ padding: "13px 16px", borderTop: i ? "1px solid #F1EEEF" : 0, cursor: "pointer" }}>
                <div className="thumb mono" style={{ width: 46, height: 46, background: RED, fontSize: 12 }}>{dm(e.start_at)}</div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 13.5 }}>{e.title}</p>
                  <p className="muted flex items-center gap-3" style={{ fontSize: 12, marginTop: 3, flexWrap: "wrap" }}>
                    {e.place && <span className="flex items-center gap-1"><MapPin size={12} />{e.place}</span>}
                    {e.meeting_type && e.meeting_type !== "truc_tiep" && (
                      <span className="flex items-center gap-1" style={{ color: RED, fontWeight: 700 }}>
                        <Video size={12} /> Trực tuyến
                      </span>
                    )}
                  </p>
                </div>
              </div>
            ))}
        </Card>
      </div>

      <ThiAnh />

      <Card title="Văn hoá Viettel" icon={Award}>
        <div className="grid md:grid-cols-2 gap-3">
          {D.VALUES_8.map((v, i) => (
            <div key={v} className="flex items-start gap-3" style={{ padding: "10px 12px", background: "#F8F6F6", borderRadius: 11 }}>
              <span className="mono" style={{ fontWeight: 700, color: RED, fontSize: 13 }}>0{i + 1}</span>
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      </Card>

      {anh && <Lightbox src={anh.url} caption={anh.title} onClose={() => setAnh(null)} />}

      {suKien && (
        <Sheet title="Chi tiết sự kiện" icon={Calendar} onClose={() => setSuKien(null)}>
          <h2 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.35 }}>{suKien.title}</h2>
          <p className="muted mono" style={{ fontSize: 12.5, marginTop: 8 }}>
            {new Date(suKien.start_at).toLocaleString("vi-VN")}
          </p>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #F1EEEF" }}>
            {suKien.place && (
              <p style={{ fontSize: 13.5, marginBottom: 8 }}>
                <MapPin size={13} style={{ display: "inline", marginRight: 6, color: RED }} />
                Địa điểm: {suKien.place}
              </p>
            )}
            {suKien.host && (
              <p style={{ fontSize: 13.5, marginBottom: 8 }}>
                <Users size={13} style={{ display: "inline", marginRight: 6, color: RED }} />
                Đơn vị tổ chức: {suKien.host}
              </p>
            )}
            {suKien.participants && (
              <p style={{ fontSize: 13.5, marginBottom: 8 }}>
                <Users size={13} style={{ display: "inline", marginRight: 6, color: RED }} />
                Thành phần: {suKien.participants}
              </p>
            )}
          </div>

          {suKien.meeting_info && (
            <div style={{ marginTop: 8 }}>
              {(suKien.meeting_info || "").toLowerCase().startsWith("http")
                ? <a className="btn btn-red" href={suKien.meeting_info} target="_blank" rel="noreferrer"
                    style={{ textDecoration: "none" }}><Video size={15} /> Vào phòng họp</a>
                : <p className="mono" style={{ fontSize: 13 }}>Điểm cầu: {suKien.meeting_info}</p>}
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

/* ============================== TRAO ĐỔI ============================== */

const CH_ICONS = { kt: Wrench, ht: Building2, hc: Users, tc: BarChart3, cd: MessageSquare };

/** Cửa sổ xem một chủ đề thảo luận và trả lời. */
function ThreadReader({ id, onClose, onReplied }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [tra, setTra] = useState("");
  const [dangGui, setDangGui] = useState(false);

  useEffect(() => {
    api.get(`/api/threads/${id}`)
      .then(setData)
      .catch((e) => {
        // "Not Found" là thông báo mặc định khi máy chủ chưa có đường dẫn này,
        // khác hẳn với việc chủ đề bị xoá. Nói rõ để khỏi mất công tìm nhầm chỗ.
        const thieuDuongDan = /not found|404/i.test(e.message);
        setErr(thieuDuongDan
          ? "MAY_CHU_CU"
          : e.message);
      });
  }, [id]);

  const guiTraLoi = async () => {
    if (!tra.trim()) return;
    setDangGui(true); setErr("");
    try {
      const r = await api.post(`/api/threads/${id}/replies`, { body: tra });
      setData((d) => ({ ...d, replies: [...(d.replies || []), r] }));
      setTra("");
      onReplied?.();
    } catch (e) { setErr(e.message); }
    setDangGui(false);
  };

  const khiNao = (v) => {
    if (!v) return "";
    const p = Math.round((Date.now() - new Date(v).getTime()) / 60000);
    if (p < 60) return `${Math.max(p, 1)} phút trước`;
    if (p < 1440) return `${Math.round(p / 60)} giờ trước`;
    return new Date(v).toLocaleDateString("vi-VN");
  };

  return (
    <Sheet rong title={data?.channel || "Chủ đề thảo luận"} icon={MessageSquare} onClose={onClose}>
      {!data && !err && <p className="muted">Đang tải…</p>}
      {err === "MAY_CHU_CU" ? (
        <div style={{ background: "#FFF8E8", border: "1px solid #F0DFB4", borderRadius: 10, padding: 14 }}>
          <p style={{ fontWeight: 700, fontSize: 13.5, color: "#8A5A08" }}>
            Máy chủ chưa hỗ trợ xem chi tiết chủ đề
          </p>
          <p style={{ fontSize: 12.5, color: "#6B5426", marginTop: 6, lineHeight: 1.6 }}>
            Giao diện đã có chức năng này nhưng phần máy chủ đang chạy bản cũ hơn,
            chưa có đường dẫn tương ứng. Cần triển khai lại phần máy chủ bằng bộ mã
            nguồn mới nhất.
          </p>
          <p style={{ fontSize: 12.5, color: "#6B5426", marginTop: 8, lineHeight: 1.6 }}>
            Cách kiểm tra nhanh: mở <strong>/api/health</strong> trên trình duyệt, xem
            trường <strong>api_version</strong>. Giao diện này cần từ phiên bản 5 trở lên.
          </p>
        </div>
      ) : err ? (
        <p style={{ color: RED_DARK, fontSize: 13.5 }}>{err}</p>
      ) : null}

      {data && (
        <>
          {data.tag && <span className="tag tag-red">{data.tag}</span>}
          {data.status === "pending" && (
            <span className="tag tag-amber" style={{ marginLeft: 6 }}>Chờ duyệt — chỉ bạn và quản trị viên thấy</span>
          )}
          <h2 style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.4, marginTop: 10 }}>{data.title}</h2>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
            {data.author} · {khiNao(data.created_at)}
          </p>

          <p className="eyebrow-grey" style={{ marginTop: 22, marginBottom: 10 }}>
            Trả lời ({data.replies?.length || 0})
          </p>

          {(data.replies || []).length === 0 ? (
            <p className="muted" style={{ fontSize: 13.5, fontStyle: "italic" }}>
              Chưa có ai trả lời. Bạn trả lời đầu tiên nhé.
            </p>
          ) : data.replies.map((r) => (
            <div key={r.id} className="flex gap-3" style={{ padding: "12px 0", borderTop: "1px solid #F1EEEF" }}>
              <Avatar name={r.author} color={RED_DARK} size={32} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700 }}>
                  {r.author} <span className="muted" style={{ fontWeight: 400 }}>· {khiNao(r.created_at)}</span>
                  {r.status === "pending" && <span className="tag tag-amber" style={{ marginLeft: 6 }}>Chờ duyệt</span>}
                </p>
                <p style={{ fontSize: 13.5, lineHeight: 1.7, marginTop: 4, whiteSpace: "pre-wrap" }}>{r.body}</p>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #F1EEEF" }}>
            <textarea className="inp" rows={3} value={tra} onChange={(e) => setTra(e.target.value)}
              placeholder="Viết câu trả lời của bạn…" />
            <div className="flex items-center justify-between" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
              <span className="muted" style={{ fontSize: 12 }}>Trả lời cần quản trị viên duyệt mới hiển thị công khai.</span>
              <button className="btn btn-red" onClick={guiTraLoi} disabled={dangGui || !tra.trim()}>
                <Send size={14} /> {dangGui ? "Đang gửi…" : "Gửi trả lời"}
              </button>
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}

export function ForumView() {
  const [ch, setCh] = useState("kt");
  const [msg, setMsg] = useState("");
  const [extra, setExtra] = useState({});
  const [chans] = useRemote("/api/channels", D.CHANNELS_FB, adapt.channels);
  const [remoteThreads] = useRemote(`/api/channels/${ch}/threads`, null, adapt.threads);
  const [moChuDe, setMoChuDe] = useState(null);   // chủ đề đang mở

  const channels = chans.map((c) => ({ ...c, icon: CH_ICONS[c.id] || MessageSquare }));
  const list = [...(extra[ch] || []), ...(remoteThreads || D.THREADS_FB[ch] || [])];

  const post = async () => {
    if (!msg.trim()) return;
    const title = msg;
    setMsg("");
    try {
      const row = await api.post(`/api/channels/${ch}/threads`, { title });
      setExtra((e) => ({
        ...e,
        [ch]: [{ id: row.id, title, author: "Bạn", time: "Vừa xong", replies: 0, tag: "Mới", status: row.status || "pending" },
          ...(e[ch] || [])],
      }));
    } catch { /* bỏ qua, giống hành vi cũ */ }
  };

  const active = channels.find((c) => c.id === ch);

  return (
    <div className="grid lg:grid-cols-4 gap-4">
      <div className="card" style={{ padding: 10, alignSelf: "start" }}>
        <p className="eyebrow-grey" style={{ padding: "6px 8px" }}>Kênh thảo luận</p>
        {channels.map((c) => {
          const I = c.icon;
          return (
            <button key={c.id} onClick={() => setCh(c.id)} className="flex items-center gap-2.5"
              style={{
                width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 9, border: 0,
                cursor: "pointer", fontFamily: "inherit", fontSize: 13.5,
                background: ch === c.id ? "#F6F1F2" : "transparent",
                color: ch === c.id ? RED_DARK : "#4A3A40", fontWeight: ch === c.id ? 700 : 500,
              }}>
              <I size={15} />
              <span style={{ flex: 1 }}>{c.name}</span>
              <span className="mono muted" style={{ fontSize: 11.5 }}>{c.count}</span>
            </button>
          );
        })}
      </div>

      <div className="lg:col-span-3 flex flex-col gap-4">
        <Card title={active?.name || "Thảo luận"} icon={Hash}>
          <textarea className="inp" rows={2} value={msg} onChange={(e) => setMsg(e.target.value)}
            placeholder="Đặt câu hỏi kỹ thuật hoặc chia sẻ kinh nghiệm với đồng nghiệp…" />
          <div className="flex items-center justify-between" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
            <span className="muted" style={{ fontSize: 12 }}>Bài đăng cần quản trị viên duyệt mới hiển thị công khai.</span>
            <button className="btn btn-red" onClick={post}><Send size={14} /> Đăng bài</button>
          </div>
        </Card>

        <Card title={`Chủ đề (${list.length})`} icon={MessageSquare} pad={false}>
          {list.map((t, i) => (
            <div key={t.id} className="row-hover" onClick={() => t.id && setMoChuDe(t.id)}
              style={{ padding: "14px 16px", borderTop: i ? "1px solid #F1EEEF" : 0, cursor: "pointer" }}>
              <div className="flex items-start gap-3">
                <Avatar name={t.author} color={t.author === "Bạn" ? RED : RED_DARK} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.4 }}>{t.title}</p>
                  <p className="muted flex items-center gap-3" style={{ fontSize: 12, marginTop: 5, flexWrap: "wrap" }}>
                    <span>{t.author}</span>
                    <span className="flex items-center gap-1"><Clock size={12} />{t.time}</span>
                    <span className="flex items-center gap-1"><MessageSquare size={12} />{t.replies} trả lời</span>
                  </p>
                </div>
                {t.status === "pending" && <span className="tag tag-amber">Chờ duyệt</span>}
                <span className="tag tag-grey hidden sm:inline-flex">{t.tag}</span>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {moChuDe && <ThreadReader id={moChuDe} onClose={() => setMoChuDe(null)} />}
    </div>
  );
}
