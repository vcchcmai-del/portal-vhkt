/**
 * Thành phần giao diện dùng chung và toàn bộ phần định kiểu.
 * Bảng màu bám nhận diện Viettel: đỏ #EA0A2A làm chủ đạo, nền trắng.
 */
import React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

// Đỏ Viettel #EA0A2A giữ nguyên cho logo và điểm nhấn nhỏ.
// Các mảng màu lớn dùng sắc trầm hơn để mắt đỡ mỏi khi mở cả ngày.
export const RED = "#C8102E";        // đỏ chính, trầm hơn đỏ nhận diện
export const RED_BRIGHT = "#EA0A2A"; // đỏ nhận diện, chỉ dùng cho chi tiết nhỏ
export const RED_DARK = "#9E0C24";
export const RED_DEEP = "#78091B";

export const CSS = `
.vp { --red:#C8102E; --red-d:#9E0C24; --red-deep:#78091B; --red-bright:#EA0A2A;
      --red-50:#FBF4F5; --red-100:#F5E4E7; --red-200:#E8C4CB;
      --ink:#1C1A1B; --ink-2:#4B4749; --ink-3:#807A7C;
      --line:#E7E3E4; --line-2:#EDEAEB; --mist:#FAF9F9; --paper:#FFFFFF;
      font-family:'Be Vietnam Pro', -apple-system, 'Segoe UI', Roboto, sans-serif;
      color:var(--ink); background:var(--mist); }
.vp *{box-sizing:border-box}
.vp ::selection{background:var(--red);color:#fff}
.mono{font-family:'JetBrains Mono', ui-monospace, monospace; font-variant-numeric:tabular-nums}
.eyebrow{font-size:11px;letter-spacing:.13em;text-transform:uppercase;font-weight:700;color:var(--red-d)}
.eyebrow-grey{font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:var(--ink-3)}
.card{background:var(--paper);border:1px solid var(--line);border-radius:14px}
.card-h{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;
  justify-content:space-between;gap:10px;background:#FCFBFB}
.card-t{font-weight:700;font-size:14.5px;letter-spacing:-.01em}
.muted{color:var(--ink-3)}
.dim{color:var(--ink-2)}

/* ---- Thanh điều hướng đỏ, chữ trắng ---- */
.rail{background:linear-gradient(170deg,#B8112B 0%,#940F22 55%,#6E0B19 100%);color:#EFDDE0}
.rail-item{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:10px;font-size:13.5px;
  font-weight:500;cursor:pointer;position:relative;transition:background .15s,color .15s;width:100%;
  text-align:left;background:transparent;border:0;color:inherit}
.rail-item:hover{background:rgba(255,255,255,.14);color:#fff}
.rail-item.on{background:#fff;color:var(--red-d);font-weight:700}
.rail-item.on::before{content:"";position:absolute;left:-6px;top:9px;bottom:9px;width:3px;border-radius:2px;background:var(--red-bright)}
.rail-sec{font-size:10px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;
  color:rgba(255,255,255,.55);padding:14px 12px 6px}
.rail-sub{display:flex;align-items:center;gap:9px;padding:7px 12px 7px 30px;border-radius:9px;
  font-size:12.5px;cursor:pointer;width:100%;text-align:left;background:transparent;border:0;
  color:rgba(255,255,255,.82);transition:.15s}
.rail-sub:hover{background:rgba(255,255,255,.12);color:#fff}
.rail-sub.on{background:rgba(255,255,255,.95);color:var(--red-d);font-weight:700}
.rail-item:focus-visible,.rail-sub:focus-visible,.btn:focus-visible,.chip:focus-visible,
input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #fff;outline-offset:2px}
.vp main input:focus-visible,.vp main textarea:focus-visible,.vp main select:focus-visible
  {outline:2px solid var(--red);outline-offset:1px}

/* ---- Nút ---- */
.btn{display:inline-flex;align-items:center;gap:7px;border-radius:10px;font-weight:600;font-size:13.5px;
  padding:9px 14px;border:1px solid var(--line);background:#fff;color:var(--ink);cursor:pointer;
  transition:.15s;font-family:inherit}
.btn:hover{border-color:#D4CFD0;background:#F7F5F5}
.btn-red{background:var(--red);border-color:var(--red);color:#fff}
.btn-red:hover{background:var(--red-d);border-color:var(--red-d)}
.btn-ghost{border-color:transparent;background:transparent}
.btn-sm{padding:6px 11px;font-size:12.5px;border-radius:9px}
.btn[disabled]{opacity:.5;cursor:not-allowed}
.chip{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 13px;font-size:12.5px;
  font-weight:600;color:var(--ink-2);cursor:pointer;white-space:nowrap;transition:.15s;font-family:inherit}
.chip:hover{border-color:#D4CFD0}
.chip.on{background:var(--red);border-color:var(--red);color:#fff}
.tag{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:3px 9px;font-size:11.5px;font-weight:700}
.tag-red{background:var(--red-50);color:var(--red-d)}
.tag-grey{background:#F4F5F8;color:var(--ink-3)}
.tag-green{background:#E7F6EF;color:#0A7A50}
.tag-amber{background:#FFF5E0;color:#95610A}

/* ---- Tìm kiếm ---- */
.search-wrap{position:relative}
.search-box{display:flex;align-items:center;gap:11px;background:#fff;border:1.5px solid var(--line);
  border-radius:13px;padding:0 14px;height:48px;transition:.15s}
.search-box:focus-within{border-color:var(--red);box-shadow:0 0 0 4px rgba(200,16,46,.10)}
.search-box input{border:0;outline:0;flex:1;font-size:15px;background:transparent;font-family:inherit;
  color:var(--ink);min-width:0}
.search-box input::placeholder{color:#A9A3A5}
.kbd{font-size:10.5px;font-weight:700;color:var(--ink-3);border:1px solid var(--line);border-bottom-width:2px;
  border-radius:6px;padding:2px 6px;background:var(--mist)}
.results{position:absolute;top:56px;left:0;right:0;background:#fff;border:1px solid var(--line);
  border-radius:14px;box-shadow:0 18px 48px rgba(30,25,27,.13);z-index:60;overflow:hidden;
  max-height:60vh;overflow-y:auto}
.res-item{display:flex;align-items:center;gap:12px;padding:10px 14px;cursor:pointer;border:0;
  background:none;width:100%;text-align:left;font-family:inherit}
.res-item:hover,.res-item.on{background:#F7F5F5}

/* ---- Ô nhập trong màn hình quản trị ---- */
.field{display:block;margin-bottom:14px}
.field > span{display:block;font-size:12px;font-weight:700;color:var(--ink-2);margin-bottom:5px}
.inp{width:100%;padding:10px 12px;border:1.5px solid var(--line);border-radius:10px;font-size:14px;
  font-family:inherit;color:var(--ink);background:#fff}
.inp:focus{outline:0;border-color:var(--red);box-shadow:0 0 0 3px rgba(200,16,46,.09)}
.check{display:flex;align-items:center;gap:9px;padding:9px 12px;border:1.5px solid var(--line);
  border-radius:10px;cursor:pointer;font-size:13.5px;font-weight:600;background:#fff}
.check.on{border-color:var(--red);background:var(--red-50);color:var(--red-d)}
.check input{accent-color:var(--red);width:16px;height:16px}

/* ---- Nút gạt bật/tắt ---- */
.switch-row{display:flex;align-items:center;justify-content:space-between;gap:14px;
  padding:11px 14px;border:1.5px solid var(--line);border-radius:11px;background:#fff}
.switch-row + .switch-row{margin-top:8px}
.switch-row .switch-label{font-size:13.5px;font-weight:700;color:var(--ink)}
.switch-row .switch-hint{font-size:11.5px;color:var(--ink-3);margin-top:2px}
.switch{position:relative;display:inline-block;width:40px;height:23px;flex-shrink:0;cursor:pointer}
.switch input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}
.switch-track{position:absolute;inset:0;background:#D9D5D6;border-radius:999px;transition:background .15s}
.switch-track::after{content:"";position:absolute;top:2px;left:2px;width:19px;height:19px;
  background:#fff;border-radius:50%;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
.switch input:checked + .switch-track{background:var(--red)}
.switch input:checked + .switch-track::after{transform:translateX(17px)}
.switch input:disabled + .switch-track{opacity:.5;cursor:not-allowed}

/* ---- Khác ---- */
.hero{position:relative;overflow:hidden;border-radius:16px;background:#fff;
  border:1px solid var(--line);isolation:isolate}
.hero svg{position:absolute;inset:0;width:100%;height:100%;z-index:-1}
.avatar{border-radius:50%;display:grid;place-items:center;font-weight:800;color:#fff;flex-shrink:0;
  letter-spacing:-.02em;overflow:hidden}
.avatar img{width:100%;height:100%;object-fit:cover}
.thumb{border-radius:12px;display:grid;place-items:center;color:#fff;font-weight:800;flex-shrink:0;overflow:hidden}
.thumb img{width:100%;height:100%;object-fit:cover}
.row-hover:hover{background:#F7F5F5}
.bar-track{height:6px;border-radius:99px;background:#ECE8E9;overflow:hidden}
.bar-fill{height:100%;border-radius:99px}
.scroll-x{overflow-x:auto;scrollbar-width:thin}
.scroll-x::-webkit-scrollbar{height:6px}
.scroll-x::-webkit-scrollbar-thumb{background:#D4CFD0;border-radius:9px}
.link{color:var(--red-d);font-weight:600;text-decoration:none}
.link:hover{text-decoration:underline}
.sheet{position:fixed;inset:0;z-index:80;background:rgba(28,26,27,.48);display:flex;
  align-items:flex-end;justify-content:center;padding:0}
@media(min-width:640px){.sheet{align-items:center;padding:20px}}
.tbl{width:100%;border-collapse:collapse;font-size:13.5px}
.tbl th{text-align:left;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);
  font-weight:700;padding:10px 12px;border-bottom:1px solid var(--line);background:var(--mist)}
.tbl td{padding:11px 12px;border-bottom:1px solid #F0EDEE;vertical-align:middle}
.tbl tr:hover td{background:#F9F7F7}

/* CNCT HCM Portal - Home Dashboard v2 */
:root{--cnct-red:#d9082f;--cnct-red-dark:#b70728;--cnct-ink:#10203d;--cnct-muted:#667085}
.cnct-home-v2{display:flex;flex-direction:column;gap:18px}
.cnct-kpi-row{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
.cnct-kpi-card{border-radius:18px;background:#fff;border:1px solid #dcefe4;padding:24px 24px;min-height:136px;position:relative;overflow:hidden;box-shadow:0 8px 25px rgba(30,25,27,.04)}
.cnct-kpi-card.orange{border-color:#f5dfbd}.cnct-kpi-card.green{border-color:#cfead9}
.cnct-kpi-card:after{content:"";position:absolute;right:-25px;bottom:-45px;width:150px;height:150px;border-radius:50%;background:rgba(35,185,88,.08)}
.cnct-kpi-card.orange:after{background:rgba(255,165,0,.08)}
.cnct-kpi-icon{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-size:25px;float:left;margin-right:16px}.cnct-kpi-card.green .cnct-kpi-icon{background:#18ad55;color:#fff}.cnct-kpi-card.orange .cnct-kpi-icon{background:#f7a000;color:#fff}
.cnct-kpi-label{font-size:15px;font-weight:800;color:#14213a;padding-top:4px}.cnct-kpi-value{font-size:40px;line-height:1.1;font-weight:900;letter-spacing:-.04em;margin-top:8px}.green .cnct-kpi-value{color:#1cac55}.orange .cnct-kpi-value{color:#f29a00}.cnct-kpi-sub{color:#667085;font-size:13px;margin-top:4px}.cnct-progress{height:9px;border-radius:99px;background:#e8eaee;overflow:hidden;margin-top:12px}.cnct-progress i{display:block;height:100%;width:68%;background:#20b65a;border-radius:99px}
.cnct-pass{display:inline-flex;align-items:center;gap:6px;margin-top:8px;border:1px solid #9ce3b8;background:#eafaf0;color:#179b4b;border-radius:99px;padding:4px 10px;font-size:12px;font-weight:800}
.cnct-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.cnct-stat{border:1px solid #dce8f4;border-radius:18px;background:#fff;padding:18px 20px;min-height:130px;position:relative;overflow:hidden;box-shadow:0 6px 22px rgba(30,25,27,.035)}
.cnct-stat:after{content:"";position:absolute;left:-10%;right:-10%;bottom:-40px;height:65px;border-radius:50%;background:rgba(0,137,255,.10)}
.cnct-stat.purple{border-color:#e3dcf5}.cnct-stat.purple:after{background:rgba(127,72,220,.10)}
.cnct-stat.orange{border-color:#f4dfc8}.cnct-stat.orange:after{background:rgba(245,144,25,.11)}
.cnct-stat.teal{border-color:#cdebed}.cnct-stat.teal:after{background:rgba(0,166,170,.11)}
.cnct-stat-icon{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;font-size:22px;float:left;margin-right:12px;background:#e9f7ff;color:#078de8}.purple .cnct-stat-icon{background:#f0eaff;color:#7c4bdc}.orange .cnct-stat-icon{background:#fff0df;color:#f28a14}.teal .cnct-stat-icon{background:#e3f8f6;color:#09a7a1}
.cnct-stat-label{font-size:13px;font-weight:800;color:#14213a;line-height:1.25;padding-top:4px}.cnct-stat-value{font-size:28px;font-weight:900;margin-top:8px;color:#078de8}.purple .cnct-stat-value{color:#7c4bdc}.orange .cnct-stat-value{color:#f28a14}.teal .cnct-stat-value{color:#08a8a3}.cnct-stat-sub{font-size:11.5px;color:#667085;margin-top:3px}
.cnct-apps{border:1px solid #e5e7eb;border-radius:18px;background:#fff;padding:14px 20px 18px;box-shadow:0 6px 22px rgba(30,25,27,.035)}
.cnct-apps-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.cnct-apps-title{font-size:16px;font-weight:850;color:#13213a}.cnct-apps-more{color:var(--cnct-red);font-size:13px;font-weight:700;text-decoration:none}
.cnct-app-list{display:grid;grid-template-columns:repeat(7,minmax(70px,1fr));gap:10px}.cnct-app{display:flex;flex-direction:column;align-items:center;gap:7px;text-decoration:none;color:#15213a;padding:8px 4px;border-radius:12px}.cnct-app:hover{background:#faf7f8}.cnct-app-icon{width:48px;height:48px;border-radius:12px;border:1px solid #e6e8ec;background:#fff;display:grid;place-items:center;font-weight:900;font-size:15px;box-shadow:0 3px 10px rgba(0,0,0,.04)}.cnct-app-name{font-size:11.5px;font-weight:700;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.cnct-home-v2 + *{margin-top:0}
@media(max-width:1023px){.cnct-stats{grid-template-columns:repeat(2,1fr)}.cnct-app-list{grid-template-columns:repeat(6,minmax(80px,1fr));overflow-x:auto}}
@media(max-width:639px){.cnct-home-v2{gap:14px}.cnct-kpi-row{grid-template-columns:1fr}.cnct-kpi-card{min-height:132px;padding:20px}.cnct-kpi-value{font-size:34px}.cnct-stats{gap:12px}.cnct-stat{padding:15px 13px;min-height:124px}.cnct-stat-icon{width:42px;height:42px;font-size:19px;margin-right:9px}.cnct-stat-label{font-size:12px}.cnct-stat-value{font-size:25px}.cnct-apps{padding:13px 12px 16px}.cnct-app-list{display:flex;gap:14px;overflow-x:auto;padding-bottom:4px}.cnct-app{min-width:74px}.cnct-app-icon{width:46px;height:46px}.cnct-app-name{font-size:11px}.portal-body main{padding-top:16px!important}}
.cnct-head-tools{display:flex;align-items:center;gap:14px;margin-left:6px}.cnct-bell{width:42px;height:42px;border:1px solid #e6e8ec;border-radius:50%;display:grid;place-items:center;font-size:20px;background:#fff;position:relative}.cnct-bell b{position:absolute;right:-2px;top:-4px;background:#df102f;color:#fff;width:19px;height:19px;border-radius:50%;display:grid;place-items:center;font-size:10px}.cnct-user{width:42px;height:42px;border-radius:50%;background:#d9082f;color:#fff;display:grid;place-items:center;font-weight:900}
@media(max-width:639px){.cnct-head-tools{display:none}}

/* Bố cục hai cột phía dưới trang chủ, dùng chung ngôn ngữ thiết kế với phần trên */
.cnct-panel{border:1px solid #e8eaef;border-radius:18px;background:#fff;overflow:hidden;box-shadow:0 6px 22px rgba(30,25,27,.035)}
.cnct-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 18px 12px}
.cnct-panel-title{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:850;letter-spacing:.03em;color:#13213a}
.cnct-panel-title svg{color:var(--cnct-red)}
.cnct-panel-note{font-size:11.5px;color:#8b8589;font-family:'JetBrains Mono',monospace}
.cnct-empty{padding:22px 18px;color:#8b8589;font-size:13px}

.cnct-sched{display:flex;gap:14px;padding:12px 18px;border-top:1px solid #f2f3f6}
.cnct-sched:hover{background:#fbfafa}
.cnct-sched-time{font-family:'JetBrains Mono',monospace;font-weight:800;font-size:13px;color:var(--cnct-red);width:44px;flex:none;padding-top:1px}
.cnct-sched-title{font-size:13.5px;font-weight:700;color:#15213a;line-height:1.4}
.cnct-sched-meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:4px;font-size:12px;color:#7d777a}
.cnct-sched-meta span{display:inline-flex;align-items:center;gap:4px}

.cnct-news{display:flex;gap:12px;padding:12px 18px;border-top:1px solid #f2f3f6;cursor:pointer}
.cnct-news:hover{background:#fbfafa}
.cnct-news-thumb{width:52px;height:52px;border-radius:12px;flex:none;overflow:hidden;display:grid;place-items:center;color:#fff;font-weight:900;font-size:17px}
.cnct-news-thumb img{width:100%;height:100%;object-fit:cover}
.cnct-news-tag{display:inline-block;font-size:11px;font-weight:800;color:var(--cnct-red);background:#fff0f3;border-radius:99px;padding:2px 9px}
.cnct-news-title{font-size:13.5px;font-weight:700;color:#15213a;line-height:1.38;margin-top:5px}
.cnct-news-sub{font-size:12px;color:#7d777a;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}

/* Biểu tượng trong ô chỉ số căn giữa gọn gàng */
.cnct-kpi-icon svg,.cnct-stat-icon svg{display:block}

.cnct-bottom-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
@media(max-width:900px){.cnct-bottom-grid{grid-template-columns:1fr}}

/* Thanh tiến độ trong ô chỉ số lớn */
.cnct-progress > i{display:block;height:100%;border-radius:99px;background:currentColor;transition:width .4s}

/* Biểu tượng quay khi đang tải */
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
`;


export const initials = (n = "") =>
  n.trim().split(" ").slice(-2).map((w) => w[0]).join("").toUpperCase();

export const norm = (s = "") =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

export function Avatar({ name, color, size = 38, photo }) {
  return (
    <div className="avatar" style={{ width: size, height: size, background: color || RED, fontSize: size * 0.36 }}>
      {photo ? <img src={photo} alt={name} /> : initials(name)}
    </div>
  );
}

export function Card({ title, action, children, icon: Icon, pad = true }) {
  return (
    <section className="card">
      {title && (
        <header className="card-h">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={16} style={{ color: RED }} />}
            <h2 className="card-t">{title}</h2>
          </div>
          {action}
        </header>
      )}
      <div style={pad ? { padding: 16 } : undefined}>{children}</div>
    </section>
  );
}

export function Delta({ v }) {
  const up = v >= 0;
  return (
    <span className="mono" style={{ color: up ? "#0A7A50" : RED, fontSize: 12.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {up ? "+" : ""}{v}%
    </span>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Check({ label, checked, onChange }) {
  return (
    <label className={`check ${checked ? "on" : ""}`}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Nút gạt bật/tắt kiểu công tắc, dùng cho các màn hình cấu hình (vd: kênh thông báo). */
export function Switch({ checked, onChange, disabled }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={!!checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" />
    </label>
  );
}

/** Một dòng cài đặt có nhãn + mô tả bên trái, nút gạt bên phải. */
export function SwitchRow({ label, hint, checked, onChange, disabled }) {
  return (
    <div className="switch-row">
      <div>
        <p className="switch-label">{label}</p>
        {hint && <p className="switch-hint">{hint}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export function Empty({ title, hint }) {
  return (
    <div style={{ padding: 34, textAlign: "center" }}>
      <p style={{ fontWeight: 600 }}>{title}</p>
      {hint && <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

/**
 * Gom nhiều màn hình quản trị liên quan vào một mục menu, hiển thị dạng tab con.
 * `pages` là danh sách đã được lọc theo quyền ở nơi gọi — component này không
 * tự kiểm tra quyền, chỉ render những gì được truyền vào.
 */
export function AdminGroupPage({ pages }) {
  const [activeId, setActiveId] = React.useState(pages[0]?.id);
  const active = pages.find((p) => p.id === activeId) || pages[0];
  if (!active) return null;
  const Comp = active.comp;
  return (
    <div className="flex flex-col gap-4">
      {pages.length > 1 && (
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          {pages.map((p) => (
            <button key={p.id} className={`chip ${p.id === active.id ? "on" : ""}`}
              onClick={() => setActiveId(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      )}
      <Comp />
    </div>
  );
}

export const tooltipStyle = {
  contentStyle: {
    borderRadius: 10, border: "1px solid #E7E3E4", fontSize: 12.5,
    fontFamily: "'Be Vietnam Pro',sans-serif", boxShadow: "0 8px 24px rgba(30,25,27,.10)",
  },
  labelStyle: { fontWeight: 700, color: "#1C1A1B" },
};
