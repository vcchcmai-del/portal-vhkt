/**
 * CỔNG THÔNG TIN NỘI BỘ
 * Phòng Vận hành khai thác - Chi nhánh Công trình Viettel Hồ Chí Minh
 *
 * Khung trang: thanh điều hướng, tìm kiếm tổng, đăng nhập và điều phối phân hệ.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3, Bell, BookOpen, Briefcase, CalendarClock, ChevronDown, Database, Home, Lightbulb, LogIn, LogOut, Megaphone,
  AlertTriangle, KeyRound, ListChecks, Menu, MessageSquare, PartyPopper, Phone, Rocket, Search, Settings, ShieldCheck,
} from "lucide-react";

import { api, clearToken, getToken, getUser, useRemote } from "./api";
import { BUILD_ID } from "./build";
import { BangKiemTra } from "./status";
import * as D from "./data";
import { ADMIN_PAGES, ChangePasswordBox, fmtDateTime, LOG_ACTION_TAG } from "./admin";
import { AdminGroupPage, Avatar, CSS, Card, RED, RED_DARK, norm } from "./ui";
import {
  AppsView, CultureView, DashView, DocsView, ForumView, HomeView, IdeasView, NewsView,
} from "./views";
import { DutyRosterView } from "./dutyroster";
import { OperationsView } from "./operations";
import { RecruitmentView } from "./recruitment";
import { AdminTechTasks } from "./techtasks";
import { AdminCsdlHt } from "./csdlht";

const NAV = [
  { id: "home", label: "Trang chủ", icon: Home },
  { id: "apps", label: "Trung tâm ứng dụng", icon: Rocket },
  { id: "docs", label: "Kho tài liệu", icon: BookOpen },
  { id: "dash", label: "Dashboard", icon: BarChart3 },
  { id: "operations", label: "Điều hành kỹ thuật", icon: AlertTriangle },
  { id: "duty-roster", label: "Lịch trực toàn chi nhánh", icon: CalendarClock },
  { id: "recruitment", label: "Tuyển dụng", icon: Briefcase },
];

// Các mục vẫn hiện trong menu cho mọi người thấy, nhưng nội dung chỉ xem được
// sau khi đăng nhập — bấm vào lúc chưa đăng nhập sẽ thấy lời mời đăng nhập
// thay vì dữ liệu thật.
const LOGIN_REQUIRED_VIEWS = new Set(["home", "dash", "operations", "recruitment"]);

// Các module có quyền riêng theo tài khoản (không phải toàn bộ nhân viên đều
// thấy) — chèn thẳng vào menu chính ngay sau "Điều hành kỹ thuật" thay vì
// chôn trong "Khu quản trị", để tài khoản được cấp quyền thấy ngay khi đăng
// nhập. Mỗi mục chỉ hiện khi canViewModule(module) đúng.
const PERMISSIONED_NAV_ITEMS = [
  { module: "tech_tasks", id: "tech-tasks", label: "Công việc mảng kỹ thuật", icon: ListChecks },
  { module: "csdl_ht", id: "csdl-ht", label: "CSDL HTML", icon: Database },
];

function navWithPermissionedItems(canViewModule) {
  const extra = PERMISSIONED_NAV_ITEMS.filter((it) => canViewModule(it.module));
  if (!extra.length) return NAV;
  const items = NAV.slice();
  const idx = items.findIndex((n) => n.id === "operations");
  items.splice(idx + 1, 0, ...extra);
  return items;
}

const PUBLIC_VIEWS = {
  apps: AppsView, docs: DocsView, dash: DashView,
  operations: OperationsView,
  recruitment: RecruitmentView, "duty-roster": DutyRosterView,
  "tech-tasks": AdminTechTasks, "csdl-ht": AdminCsdlHt,
};

/* ============================== TÌM KIẾM TỔNG ============================== */

function buildIndex() {
  const idx = [];
  D.APPS_FB.forEach((a) => idx.push({ kind: "Ứng dụng", label: a.name, sub: a.description, view: "apps", url: a.url, key: `${a.name} ${a.description} ${a.cat}` }));
  D.DOCS_FB.forEach((d) => idx.push({ kind: "Tài liệu", label: d.title, sub: `${d.code} · ${d.cat}`, view: "docs", key: `${d.title} ${d.body} ${d.code} ${d.cat}` }));
  return idx;
}

function GlobalSearch({ onGo }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [serverHits, setServerHits] = useState(null);
  const wrap = useRef(null);
  const input = useRef(null);
  const index = useMemo(buildIndex, []);

  const localHits = useMemo(() => {
    const t = norm(q).trim();
    if (t.length < 2) return [];
    return index.filter((i) => norm(i.key).includes(t)).slice(0, 8);
  }, [q, index]);

  useEffect(() => {
    if (q.trim().length < 2) { setServerHits(null); return; }
    const timer = setTimeout(() => {
      api.get(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => setServerHits(Array.isArray(r) ? r : null))
        .catch(() => setServerHits(null));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const onDoc = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);

  const hits = (serverHits && serverHits.length ? serverHits : localHits).slice(0, 8);

  const pick = (h) => {
    if (h.kind === "Ứng dụng" && h.url && h.url !== "#") window.open(h.url, "_blank");
    else onGo(h.view);
    setOpen(false); setQ("");
  };

  return (
    <div className="search-wrap" ref={wrap}>
      <div className="search-box">
        <Search size={19} style={{ color: RED, flexShrink: 0 }} />
        <input ref={input} value={q} placeholder="Tìm tài liệu, ứng dụng, tin tức…"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setCursor(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!hits.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => (c + 1) % hits.length); }
            if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => (c - 1 + hits.length) % hits.length); }
            if (e.key === "Enter") { e.preventDefault(); pick(hits[cursor]); }
          }} />
        <span className="kbd hidden sm:inline">Ctrl K</span>
      </div>

      {open && q.trim().length >= 2 && (
        <div className="results">
          {hits.length === 0 ? (
            <div style={{ padding: "22px 16px" }}>
              <p style={{ fontWeight: 600, fontSize: 14 }}>Không có kết quả cho “{q}”.</p>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Thử tên tài liệu hoặc tên ứng dụng. Ví dụ: “xăng dầu”, “GNOC”, “an toàn”.
              </p>
            </div>
          ) : hits.map((h, i) => (
            <button key={i} className={`res-item ${i === cursor ? "on" : ""}`}
              onMouseEnter={() => setCursor(i)} onClick={() => pick(h)}>
              <span className="thumb" style={{ width: 32, height: 32, background: RED, fontSize: 11 }}>{h.kind[0]}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.label}</span>
                <span className="muted" style={{ display: "block", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.sub}</span>
              </span>
              <span className="tag tag-grey">{h.kind}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================== ĐĂNG NHẬP ============================== */

function LoginBox({ onClose, onDone }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!u.trim() || !p) { setErr("Nhập đủ tài khoản và mật khẩu."); return; }
    setBusy(true); setErr("");
    try {
      const data = await api.login(u.trim(), p);
      onDone(data);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card" style={{ width: "min(400px,100%)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ background: `linear-gradient(150deg, #B8112B, #78091B)`, padding: "22px 20px", color: "#fff" }}>
          <ShieldCheck size={26} />
          <h3 style={{ fontWeight: 800, fontSize: 18, marginTop: 10 }}>Đăng nhập nội bộ</h3>
          <p style={{ fontSize: 12.5, color: "#EBD4D8", marginTop: 4 }}>
            Dùng tài khoản do quản trị viên cấp để đăng bài và quản trị nội dung.
          </p>
        </div>
        <div style={{ padding: 20 }}>
          <label className="field"><span>Tài khoản</span>
            <input className="inp" value={u} autoFocus onChange={(e) => setU(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Ví dụ: admin" />
          </label>
          <label className="field"><span>Mật khẩu</span>
            <input className="inp" type="password" value={p} onChange={(e) => setP(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </label>
          {err === "NO_SERVER" ? (
            <div style={{ background: "#FFF8E8", border: "1px solid #F0DFB4", borderRadius: 10, padding: "12px 13px", marginBottom: 14 }}>
              <p style={{ fontWeight: 700, fontSize: 13.5, color: "#8A5A08" }}>
                Chưa kết nối được máy chủ dữ liệu
              </p>
              <p style={{ fontSize: 12.5, color: "#6B5426", marginTop: 6, lineHeight: 1.6 }}>
                Trang đang chạy ở chế độ chỉ xem giao diện, chưa có phần xử lý dữ liệu nên
                không đăng nhập được. Đây không phải lỗi mật khẩu.
              </p>
              <p style={{ fontSize: 12.5, color: "#6B5426", marginTop: 8, lineHeight: 1.6 }}>
                Cách kiểm tra: mở đường dẫn <strong>/api/health</strong> trên trình duyệt.
                Nếu không hiện dòng chữ <code>{'{"status":"ok"}'}</code> thì backend chưa chạy.
              </p>
            </div>
          ) : err ? (
            <p style={{ background: "#FBF4F5", color: RED_DARK, padding: "9px 12px", borderRadius: 9, fontSize: 13, marginBottom: 12 }}>{err}</p>
          ) : null}
          <div className="flex gap-2">
            <button className="btn" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>Đóng</button>
            <button className="btn btn-red" style={{ flex: 1, justifyContent: "center" }} disabled={busy} onClick={submit}>
              <LogIn size={15} /> {busy ? "Đang vào…" : "Đăng nhập"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== CHUÔNG CẢNH BÁO ============================== */

const ALERTS_SEEN_KEY = "portal_alerts_seen";

function NotificationBell({ onGo }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ total_new: 0, rows: [], email_configured: true, telegram_configured: false, bell_enabled: true });
  const ref = useRef(null);

  const poll = () => {
    const since = localStorage.getItem(ALERTS_SEEN_KEY) || "";
    const params = new URLSearchParams({ limit: "15" });
    if (since) params.set("since", since);
    api.get(`/api/admin/alerts?${params.toString()}`).then(setData).catch(() => {});
  };

  useEffect(() => {
    poll();
    const id = setInterval(poll, 45000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (next) {
        localStorage.setItem(ALERTS_SEEN_KEY, new Date().toISOString());
        setData((d) => ({ ...d, total_new: 0 }));
      }
      return next;
    });
  };

  if (!data.bell_enabled) return null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn btn-sm" onClick={toggle} aria-label="Cảnh báo thay đổi nội dung"
        title="Cảnh báo sửa/xoá bản tin, đổi cấu hình website" style={{ position: "relative" }}>
        <Bell size={15} />
        {data.total_new > 0 && (
          <span style={{
            position: "absolute", top: -5, right: -5, background: RED, color: "#fff",
            borderRadius: 999, fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, lineHeight: "16px",
            textAlign: "center", padding: "0 3px",
          }}>
            {data.total_new > 9 ? "9+" : data.total_new}
          </span>
        )}
      </button>

      {open && (
        <div className="card" style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)", width: 340,
          maxHeight: 440, overflowY: "auto", zIndex: 60, padding: 0,
        }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #E7E3E4" }}>
            <p style={{ fontWeight: 700, fontSize: 13.5 }}>Cảnh báo thay đổi nội dung</p>
            <p className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
              Sửa/xoá bản tin, đổi cấu hình website
              {!data.email_configured && " — chưa cấu hình gửi email"}
              {!data.telegram_configured && " — chưa cấu hình Telegram"}
            </p>
          </div>

          {data.rows.length === 0 ? (
            <p className="dim" style={{ padding: 16, fontSize: 12.5 }}>Chưa có cảnh báo nào.</p>
          ) : (
            data.rows.map((l) => (
              <div key={l.id} style={{ padding: "10px 14px", borderBottom: "1px solid #F1EEEF" }}>
                <div className="flex items-center gap-2">
                  <span className={`tag ${LOG_ACTION_TAG[l.action] || "tag-grey"}`} style={{ fontSize: 10.5 }}>
                    {l.action_label}
                  </span>
                  <span className="dim" style={{ fontSize: 11 }}>{l.module_label}</span>
                </div>
                <p style={{ fontSize: 12.5, marginTop: 4 }}>{l.target_label || "—"}</p>
                <p className="dim mono" style={{ fontSize: 10.5, marginTop: 3 }}>
                  {l.full_name || l.username || "—"} · {fmtDateTime(l.created_at)}
                </p>
              </div>
            ))
          )}

          <button className="rail-item" style={{ width: "100%", justifyContent: "center", padding: "10px 0", color: RED_DARK }}
            onClick={() => { setOpen(false); onGo("adm-logs"); }}>
            Xem toàn bộ nhật ký ›
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================== KHUNG TRANG ============================== */

export default function Portal() {
  const [view, setView] = useState("home");
  const [menu, setMenu] = useState(false);
  const [admOpen, setAdmOpen] = useState(false);
  const [login, setLogin] = useState(false);
  const [pwBox, setPwBox] = useState(false);
  const [openNewsId, setOpenNewsId] = useState(null);   // bản tin cần mở từ trang chủ
  const [bangKT, setBangKT] = useState(false);          // bảng kiểm tra tình trạng
  const [user, setUser] = useState(getUser());
  const [cfgRemote] = useRemote("/api/config", null);
  const [srv, setSrv] = useState(null);   // null = đang kiểm tra

  const config = { ...D.CONFIG_FB, ...(cfgRemote || {}) };
  const isAdmin = user && user.role === "admin";
  const perms = new Set((user && user.permissions) || []);
  const actionPerms = (user && user.permission_actions) || {};
  const canViewModule = (module) => (actionPerms[module] || []).includes("view") || perms.has(module);
  const adminPages = ADMIN_PAGES.filter((p) => (isAdmin) || (!p.adminOnly && canViewModule(p.module)));
  // "Khu quản trị" chỉ hiện khi có ít nhất một trang quản trị thật sự xem được —
  // tránh trường hợp tài khoản chỉ được cấp quyền module không có trang quản trị
  // riêng (ví dụ tech_tasks, đã có lối vào riêng ở menu chính) thấy mục "Quản trị"
  // trống rỗng, bấm vào không có gì.
  const canAdmin = user && (isAdmin || adminPages.length > 0);

  // Nhiều màn hình quản trị liên quan (đánh dấu cùng "group") gom lại thành
  // một mục điều hướng duy nhất có tab con — chỉ gom trên những trang người
  // dùng đã có quyền xem, phân quyền từng trang con vẫn giữ nguyên như cũ.
  const groupedAdminNav = [];
  const groupIndex = {};
  for (const p of adminPages) {
    if (!p.group) { groupedAdminNav.push({ ...p, isGroup: false }); continue; }
    if (!groupIndex[p.group]) {
      const g = { id: `grp-${p.group}`, label: p.groupLabel, icon: p.groupIcon, isGroup: true, pages: [] };
      groupIndex[p.group] = g;
      groupedAdminNav.push(g);
    }
    groupIndex[p.group].pages.push(p);
  }

  useEffect(() => {
    api.ping().then(setSrv);
    if (getToken()) {
      // Luôn đồng bộ lại quyền mới nhất từ máy chủ (phòng trường hợp quản trị viên
      // vừa đổi quyền, hoặc dữ liệu đăng nhập lưu ở máy còn thiếu trường permissions).
      api.get("/api/auth/me")
        .then((d) => { setUser(d); localStorage.setItem("portal_user", JSON.stringify(d)); })
        .catch(() => clearToken());
    }
  }, []);

  const go = (v) => {
    setView(v); setMenu(false);
    if (v.startsWith("adm-") || v.startsWith("grp-")) setAdmOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const logout = () => { clearToken(); setUser(null); setView("home"); };

  // Tự động đăng xuất nếu không thao tác gì trong 1 giờ — tránh phiên đăng
  // nhập bị bỏ quên mở mãi trên máy dùng chung. Đếm giờ bằng biến thường
  // (không phải state) để mỗi cử động chuột không làm render lại cả trang.
  useEffect(() => {
    if (!user) return;
    const GIOI_HAN_KHONG_THAO_TAC_MS = 60 * 60 * 1000;
    let hetHan = Date.now() + GIOI_HAN_KHONG_THAO_TAC_MS;
    const datLaiDongHo = () => { hetHan = Date.now() + GIOI_HAN_KHONG_THAO_TAC_MS; };
    const cacSuKien = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    cacSuKien.forEach((tk) => window.addEventListener(tk, datLaiDongHo, { passive: true }));
    const hen = setInterval(() => { if (Date.now() >= hetHan) logout(); }, 30 * 1000);
    return () => {
      cacSuKien.forEach((tk) => window.removeEventListener(tk, datLaiDongHo));
      clearInterval(hen);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const navItems = navWithPermissionedItems(canViewModule);
  const adminPage = adminPages.find((p) => p.id === view);
  const adminGroup = groupedAdminNav.find((g) => g.isGroup && g.id === view);
  const current = adminPage || adminGroup || navItems.find((n) => n.id === view) || navItems[0];
  const PublicView = PUBLIC_VIEWS[view];

  const Rail = () => (
    <nav className="rail flex flex-col" style={{ padding: 14, height: "100%", overflowY: "auto" }}>
      <div style={{ padding: "4px 6px 16px" }}>
        <div className="flex items-center gap-2.5">
          <div style={{ width: 34, height: 34, background: "#fff", borderRadius: 9, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 16, color: RED, flexShrink: 0 }}>V</div>
          <div style={{ lineHeight: 1.2, minWidth: 0 }}>
            <p style={{ fontWeight: 800, fontSize: 13.5, color: "#fff", letterSpacing: "-.01em" }}>{config.site_short}</p>
            <p style={{ fontSize: 10.5, color: "rgba(255,255,255,.72)" }}>{config.site_dept}</p>
          </div>
        </div>
        <p style={{ fontSize: 10.5, color: "rgba(255,255,255,.62)", marginTop: 8, lineHeight: 1.4 }}>{config.site_branch}</p>
      </div>

      <div className="flex flex-col gap-1" style={{ paddingLeft: 8 }}>
        {navItems.map((n) => {
          const I = n.icon;
          return (
            <button key={n.id} className={`rail-item ${view === n.id ? "on" : ""}`} onClick={() => go(n.id)}>
              <I size={16} /> {n.label}
            </button>
          );
        })}
      </div>

      {canAdmin && (
        <div style={{ paddingLeft: 8 }}>
          <p className="rail-sec">Khu quản trị</p>
          <button className="rail-item" onClick={() => setAdmOpen((o) => !o)}>
            <Settings size={16} />
            <span style={{ flex: 1 }}>Quản trị</span>
            <ChevronDown size={15} style={{ transform: admOpen ? "rotate(180deg)" : "none", transition: ".15s" }} />
          </button>
          {admOpen && (
            <div className="flex flex-col" style={{ marginTop: 2, gap: 2 }}>
              {groupedAdminNav.map((pg) => {
                const I = pg.icon;
                return (
                  <button key={pg.id} className={`rail-sub ${view === pg.id ? "on" : ""}`} onClick={() => go(pg.id)}>
                    <I size={14} /> {pg.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: "auto", paddingTop: 18 }}>
        <div style={{ borderTop: "1px solid rgba(255,255,255,.22)", paddingTop: 14, paddingLeft: 8, paddingRight: 8 }}>
          {user ? (
            <>
              <div className="flex items-center gap-2.5">
                <Avatar name={user.full_name} color="rgba(255,255,255,.25)" size={34} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{user.full_name}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,.75)" }}>
                    {user.role === "admin" ? "Quản trị viên" : user.role === "editor" ? "Biên tập viên" : "Nhân viên"}
                  </p>
                </div>
              </div>
              <button className="rail-item" style={{ marginTop: 8 }} onClick={() => setPwBox(true)}>
                <KeyRound size={15} /> Đổi mật khẩu
              </button>
              <button className="rail-item" onClick={logout}>
                <LogOut size={15} /> Đăng xuất
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <Avatar name={config.support_name} color="rgba(255,255,255,.25)" size={34} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{config.support_name}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,.75)" }}>{config.support_role}</p>
                </div>
              </div>
              <a href={`tel:${config.support_phone}`} className="mono"
                style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: "#fff", textDecoration: "none", paddingLeft: 2 }}>
                <Phone size={13} /> {config.support_phone}
              </a>
              <button className="rail-item" style={{ marginTop: 8 }} onClick={() => setLogin(true)}>
                <LogIn size={15} /> Đăng nhập
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );

  return (
    <div className="vp" style={{ minHeight: "100vh" }}>
      <style>{CSS}</style>

      <aside className="hidden lg:block" style={{ position: "fixed", top: 0, bottom: 0, left: 0, width: 252, zIndex: 40 }}>
        {Rail()}
      </aside>

      {menu && (
        <div className="sheet lg:hidden" style={{ alignItems: "stretch", justifyContent: "flex-start", padding: 0 }}
          onClick={(e) => e.target === e.currentTarget && setMenu(false)}>
          <div style={{ width: 264 }}>{Rail()}</div>
        </div>
      )}

      <div className="portal-body">
        <style>{`@media(min-width:1024px){.portal-body{margin-left:252px}}`}</style>

        <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(250,249,249,.94)", backdropFilter: "blur(10px)", borderBottom: "1px solid #E7E3E4" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "12px 16px" }}>
            <div className="flex items-center gap-3">
              <button className="btn btn-sm lg:hidden" onClick={() => setMenu(true)} aria-label="Mở menu"><Menu size={16} /></button>
              <div style={{ flex: 1, minWidth: 0 }}><GlobalSearch onGo={go} /></div>
              {isAdmin && <NotificationBell onGo={go} />}
              {!user && <button className="btn btn-sm hidden sm:inline-flex" onClick={() => setLogin(true)}><LogIn size={15} /> Đăng nhập</button>}
            </div>

            {isAdmin && srv && srv.startupErrors?.length > 0 && (
              <div style={{ marginTop: 10, background: "#FBF4F5", border: "1px solid #EFD8DC", borderRadius: 10, padding: "10px 13px", display: "flex", alignItems: "flex-start", gap: 9 }}>
                <AlertTriangle size={15} style={{ color: RED, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: RED_DARK }}>
                    Máy chủ khởi động chưa trọn vẹn
                  </p>
                  {srv.startupErrors.map((e, i) => (
                    <p key={i} style={{ fontSize: 12, color: "#6B4A50", marginTop: 3 }}>
                      {e.buoc}: {e.loi}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {isAdmin && srv && srv.app && srv.cuHon && (
              <div style={{ marginTop: 10, background: "#FFF8E8", border: "1px solid #F0DFB4", borderRadius: 10, padding: "10px 13px", display: "flex", alignItems: "flex-start", gap: 9 }}>
                <AlertTriangle size={15} style={{ color: "#B07908", flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 700, color: "#8A5A08" }}>
                    Máy chủ đang chạy bản cũ hơn giao diện
                  </p>
                  <p style={{ fontSize: 12.5, color: "#6B5426", marginTop: 3, lineHeight: 1.55 }}>
                    Giao diện cần phiên bản {srv.canCo ?? 5}, máy chủ đang là {srv.apiVersion || "không rõ"}.
                    Một số chức năng sẽ báo “Not Found” khi bấm vào. Cần triển khai lại phần máy chủ
                    bằng bộ mã nguồn mới nhất.
                  </p>
                </div>
              </div>
            )}

            {srv && srv.app && !srv.db && (
              <div style={{ marginTop: 10, background: "#FBF4F5", border: "1px solid #EFD8DC", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 9 }}>
                <AlertTriangle size={15} style={{ color: RED, flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: RED_DARK }}>
                  Máy chủ đang chạy nhưng chưa nối được cơ sở dữ liệu. Dữ liệu hiển thị có thể
                  chưa cập nhật và tạm thời chưa lưu được. Báo quản trị viên kiểm tra.
                </p>
              </div>
            )}

            {srv && !srv.app && (
              <div style={{ marginTop: 10, background: "#FFF8E8", border: "1px solid #F0DFB4", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 9 }}>
                <AlertTriangle size={15} style={{ color: "#B07908", flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: "#6B5426" }}>
                  Chế độ xem thử: chưa kết nối máy chủ dữ liệu nên chưa đăng nhập và lưu dữ liệu được.
                  Số liệu đang hiển thị là dữ liệu mẫu.
                </p>
              </div>
            )}
          </div>
        </header>

        <main style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 16px 48px" }}>
          <div className="flex items-end justify-between" style={{ marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
            <div>
              <span className="eyebrow">{(adminPage || adminGroup) ? "Khu quản trị" : config.site_dept}</span>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.03em", marginTop: 4 }}>{current.label}</h1>
            </div>
            {view === "home" && (
              <p className="muted mono" style={{ fontSize: 12.5 }}>
                {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
              </p>
            )}
          </div>

          {(adminPage || adminGroup)
            ? (canAdmin
              ? (adminGroup ? <AdminGroupPage pages={adminGroup.pages} /> : <adminPage.comp />)
              : <Card><p style={{ fontWeight: 600 }}>Bạn cần đăng nhập bằng tài khoản quản trị để vào mục này.</p></Card>)
            : (LOGIN_REQUIRED_VIEWS.has(view) && !user)
              ? (
                <Card>
                  <p style={{ fontWeight: 600 }}>Bạn cần đăng nhập để xem nội dung này.</p>
                  <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => setLogin(true)}>
                    <LogIn size={15} /> Đăng nhập
                  </button>
                </Card>
              )
              : view === "home"
                ? <HomeView key={user ? "home-in" : "home-out"} onGo={go} config={config}
                    onOpenNews={(id) => { setOpenNewsId(id); go("news"); }} />
                : view === "news"
                  ? <NewsView openId={openNewsId} onOpened={() => setOpenNewsId(null)} />
                  : PublicView ? <PublicView /> : null}

          <footer style={{ marginTop: 40, paddingTop: 18, borderTop: "1px solid #E7E3E4" }}
            className="flex items-center justify-between gap-3 flex-wrap">
            <p className="muted" style={{ fontSize: 12, maxWidth: 620 }}>{config.site_title}</p>
            <div style={{ textAlign: "right" }}>
              <p className="muted" style={{ fontSize: 12 }}>
                Hỗ trợ: {config.support_name} — {config.support_phone}
              </p>
              {isAdmin && (
                <button onClick={() => setBangKT(true)}
                  style={{ background: "none", border: 0, padding: 0, cursor: "pointer",
                           font: "inherit", display: "block", marginLeft: "auto" }}>
                  <p className="mono" style={{ fontSize: 10.5, marginTop: 4,
                     color: srv && srv.build && srv.build !== BUILD_ID ? RED : "#A9A3A5" }}>
                  Giao diện {BUILD_ID} · Máy chủ {srv?.build || "đang kiểm tra"}
                    {srv && srv.build && srv.build !== BUILD_ID && " — LỆCH BẢN"}
                  </p>
                  <p className="link" style={{ fontSize: 11, marginTop: 3 }}>Kiểm tra tình trạng hệ thống ›</p>
                </button>
              )}
            </div>
          </footer>
        </main>
      </div>

      {bangKT && <BangKiemTra onClose={() => setBangKT(false)} />}
      {pwBox && <ChangePasswordBox onClose={() => setPwBox(false)} />}
      {login && <LoginBox onClose={() => setLogin(false)} onDone={(d) => {
        setUser({ full_name: d.full_name, role: d.role, permissions: d.permissions || [],
                  permission_actions: d.permission_actions || {}, must_change_password: !!d.must_change_password });
        setLogin(false); setAdmOpen(true);
      }} />}
      {user && user.must_change_password && (
        <ChangePasswordBox forced
          onDone={() => setUser((u) => {
            const next = { ...u, must_change_password: false };
            localStorage.setItem("portal_user", JSON.stringify(next));
            return next;
          })}
          onLogout={logout} />
      )}
    </div>
  );
}
