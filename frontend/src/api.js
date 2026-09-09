/**
 * Lớp gọi API.
 *
 * Nguyên tắc: nếu backend chưa chạy hoặc lỗi mạng, trang vẫn hiện dữ liệu mẫu
 * thay vì trắng màn hình. Nhờ vậy anh em có thể xem giao diện trước khi
 * hạ tầng sẵn sàng.
 */
import { useEffect, useState } from "react";

const BASE = import.meta.env.VITE_API_BASE || "";
const TOKEN_KEY = "portal_token";

/**
 * Phiên bản API mà giao diện này cần.
 * Máy chủ báo số nhỏ hơn nghĩa là backend chưa được triển khai lại,
 * một số chức năng sẽ báo "Not Found" khi bấm vào.
 */
export const API_CAN_CO = 12;

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem("portal_user"); };
export const getUser = () => { try { return JSON.parse(localStorage.getItem("portal_user")); } catch { return null; } };

/**
 * Đọc lỗi từ máy chủ và diễn giải thành câu tiếng Việt dễ hiểu.
 * Nguyên tắc: không bao giờ giấu nguyên nhân thật sau một câu chung chung.
 */
async function describeError(res) {
  const raw = await res.text().catch(() => "");

  let body = null;
  try { body = JSON.parse(raw); } catch { /* không phải JSON */ }

  // FastAPI báo lỗi kiểm tra dữ liệu dưới dạng mảng
  if (body && Array.isArray(body.detail)) {
    const list = body.detail
      .map((e) => `${(e.loc || []).slice(1).join(".")}: ${e.msg}`)
      .join("; ");
    return `Dữ liệu gửi lên chưa hợp lệ — ${list}`;
  }
  if (body && typeof body.detail === "string") return body.detail;
  if (body && typeof body.message === "string") return body.message;

  // Không phải JSON: nhiều khả năng máy chủ trả về trang HTML
  const looksHtml = /^\s*<(!doctype|html)/i.test(raw);

  if (res.status === 404) {
    return looksHtml
      ? "Máy chủ không có đường dẫn này (404). Nhiều khả năng bản đang chạy trên máy chủ cũ hơn bản mã nguồn bạn có."
      : "Không tìm thấy đường dẫn trên máy chủ (404).";
  }
  if (res.status === 405) {
    return "Máy chủ từ chối kiểu yêu cầu này (405). Thường gặp khi trang chỉ được phục vụ dạng tệp tĩnh, chưa có phần xử lý dữ liệu.";
  }
  if (res.status === 413) return "Dữ liệu gửi lên quá lớn.";
  if (res.status >= 500) {
    return `Máy chủ gặp lỗi (${res.status}). Xem nhật ký backend để biết chi tiết.`;
  }
  if (looksHtml) {
    return `Máy chủ trả về trang web thay vì dữ liệu (mã ${res.status}). Kiểm tra phần xử lý dữ liệu đã chạy chưa.`;
  }
  const snippet = raw.trim().slice(0, 160);
  return snippet
    ? `Máy chủ báo lỗi ${res.status}: ${snippet}`
    : `Máy chủ báo lỗi ${res.status}.`;
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE + path, { cache: "no-store", ...options, headers });
  } catch {
    throw new Error("Không gọi được máy chủ. Kiểm tra kết nối mạng hoặc phần xử lý dữ liệu đã chạy chưa.");
  }

  if (res.status === 401) {
    clearToken();
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }
  if (res.status === 403) {
    const msg = await describeError(res);
    throw new Error(msg || "Tài khoản không có quyền thực hiện thao tác này.");
  }
  if (!res.ok) throw new Error(await describeError(res));

  if (res.status === 204) return null;
  return res.json().catch(() => null);
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  del: (path) => request(path, { method: "DELETE" }),

  /** Tải tệp nhị phân kèm token đăng nhập (dùng cho việc tải cơ sở dữ liệu). */
  async blob(path) {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(BASE + path, { headers });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.detail || "Không tải được tệp.");
    }
    const cd = res.headers.get("content-disposition") || "";
    const match = cd.match(/filename="?([^"]+)"?/);
    return { blob: await res.blob(), filename: match ? match[1] : null };
  },

  async login(username, password) {
    const form = new URLSearchParams({ username, password });
    let res;
    try {
      res = await fetch(BASE + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
    } catch {
      // Không gọi được máy chủ: mất mạng, hoặc trang đang chạy mà không có backend
      throw new Error("NO_SERVER");
    }

    if (res.status === 401) throw new Error("Sai tài khoản hoặc mật khẩu.");
    if (res.status === 404) throw new Error("NO_SERVER");
    if (!res.ok) throw new Error(`Máy chủ báo lỗi ${res.status}. Xem nhật ký backend để biết chi tiết.`);

    let data;
    try {
      data = await res.json();
    } catch {
      // Máy chủ trả về trang HTML thay vì dữ liệu — dấu hiệu backend không chạy
      throw new Error("NO_SERVER");
    }
    if (!data.access_token) throw new Error("NO_SERVER");

    setToken(data.access_token);
    localStorage.setItem("portal_user", JSON.stringify({
      full_name: data.full_name, role: data.role, permissions: data.permissions || [],
      permission_actions: data.permission_actions || {},
      must_change_password: !!data.must_change_password,
    }));
    return data;
  },

  /** Tải một tệp ảnh lên máy chủ, trả về { url, size_kb, original_name }. */
  async uploadFile(file) {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(BASE + "/api/admin/upload", { method: "POST", headers, body: form });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.detail || "Không tải được ảnh lên.");
    }
    return res.json();
  },

  /** Kiểm tra backend có đang chạy không. Trả về true/false, không ném lỗi. */
  async ping() {
    try {
      const res = await fetch(BASE + "/api/health");
      if (!res.ok) return { app: false, db: false };
      const d = await res.json();
      // Giao diện này cần máy chủ từ phiên bản API_CAN_CO trở lên.
      // Lệch bản là dấu hiệu backend chưa được triển khai lại.
      const serverVer = d.api_version || 0;
      // Ứng dụng sống nhưng cơ sở dữ liệu hỏng là hai tình huống khác nhau,
      // cần báo khác nhau để người dùng biết phải xử lý ở đâu.
      return {
        app: d.status === "ok",
        db: d.database === "ok",
        dbError: d.database_error,
        apiVersion: serverVer,
        features: d.features || [],
        canCo: API_CAN_CO,
        startupErrors: d.startup_errors || [],
        build: d.build || null,
        deployLabel: d.deploy_label || null,
        cuHon: serverVer < API_CAN_CO,
      };
    } catch {
      return { app: false, db: false };
    }
  },
};

/**
 * Hook lấy dữ liệu từ API, có sẵn dữ liệu dự phòng.
 *
 *   const apps = useRemote("/api/apps", APPS_FALLBACK);
 *
 * Trả về mảng dữ liệu — dùng ngay được, không phải kiểm tra null.
 */
export function useRemote(path, fallback, adaptItem) {
  const [data, setData] = useState(fallback);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get(path)
      .then((d) => {
        if (!alive || !d) return;
        setData(adaptItem && Array.isArray(d) ? d.map(adaptItem) : d);
        setOffline(false);
      })
      .catch(() => { if (alive) setOffline(true); });
    return () => { alive = false; };
  }, [path]);

  return [data, offline];
}

/* ------------------------------------------------------------------ *
 * Chuyển đổi dữ liệu từ API sang đúng tên trường mà giao diện đang dùng.
 * Nhờ lớp này, khi backend đổi tên trường chỉ phải sửa ở một chỗ.
 * ------------------------------------------------------------------ */

const d2 = (n) => String(n).padStart(2, "0");

export function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d2(d.getDate())}/${d2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function fmtAgo(value) {
  if (!value) return "";
  const mins = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} phút trước`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} giờ trước`;
  if (mins < 60 * 48) return "Hôm qua";
  return `${Math.round(mins / 1440)} ngày trước`;
}

export const adapt = {
  apps: (a) => ({ ...a, cat: a.category }),
  news: (n) => ({ ...n, cat: n.category, date: fmtDate(n.published_at) }),
  docs: (d) => ({ ...d, cat: d.category, size: d.size_label, date: fmtDate(d.updated_on), body: "" }),
  people: (p) => ({ ...p, mail: p.email }),
  ideas: (i) => ({ ...i, saved: i.benefit, date: fmtDate(i.created_at) }),
  channels: (c) => ({ ...c, id: c.slug, count: c.threads }),
  threads: (t) => ({ ...t, time: fmtAgo(t.created_at) }),
};
