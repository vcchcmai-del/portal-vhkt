import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Building2, CalendarClock, CheckCircle2, Layers, RefreshCw, Target, TrendingUp, X,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "./api";
import { Card, RED, ThaoTac, tooltipStyle } from "./ui";

/*
 * Phân tích khối lượng mảng kỹ thuật — phần đầu của tab Báo cáo.
 *
 * Phòng theo dõi công việc bằng KHỐI LƯỢNG (kế hoạch / thực hiện / BKK / tồn),
 * nên báo cáo đọc theo khối lượng chứ không đếm số nhiệm vụ. Năm câu hỏi được
 * trả lời theo đúng thứ tự người đọc cần:
 *   1. Cả phòng (hoặc riêng một mảng) đang ở đâu so với kế hoạch tháng?
 *   2. Mảng nào kéo lùi?
 *   3. Bao nhiêu đầu việc thật sự nhúc nhích?
 *   4. Trung tâm nào còn tồn nhiều, và tồn ở những đầu việc nào?
 *   5. Ai đang bỏ bẵng số liệu?
 *
 * Hai bộ lọc ăn xuyên suốt cả trang: chọn MẢNG (CĐBR, Truyền dẫn, Cơ điện…) để
 * trưởng nhóm chỉ nhìn phần của mình; chọn TRUNG TÂM để huyện thấy toàn bộ việc
 * của mình. Mọi con số trên trang tính lại theo hai bộ lọc đó, không để chỗ này
 * đã lọc mà chỗ kia còn là số của cả phòng.
 *
 * Không dùng màu xám cho chuỗi dữ liệu (quy ước chung của các Dashboard).
 * ResponsiveContainer nhận chiều cao là SỐ, không phải "100%".
 */

const MAU = {
  xanh: "#16A34A", lam: "#0E6CD6", lamNhat: "#5B8DEF", vang: "#F2A007",
  do: "#C8102E", tim: "#8B5CF6",
};
const CHUA_CHIA = "CN";   // mã dòng "chưa chia cụm" trong bảng số liệu
const so = (n) => Number(n || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
const pct = (r) => (r == null ? "—" : `${(Math.round(r * 1000) / 10).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`);
const rutGon = (s, n = 26) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));
const mauTyLe = (r) => (r == null ? MAU.lamNhat : r >= 1 ? MAU.xanh : r >= 0.8 ? MAU.lam : r >= 0.5 ? MAU.lamNhat : r > 0 ? MAU.vang : MAU.do);
const tyLe = (plan, done, bkk) => (Math.max(plan - bkk, 0) ? done / Math.max(plan - bkk, 0) : null);
const KHOANG = [
  ["Chưa làm", MAU.do, (r) => r <= 0],
  ["Dưới 50%", MAU.vang, (r) => r > 0 && r < 0.5],
  ["50–80%", MAU.lamNhat, (r) => r >= 0.5 && r < 0.8],
  ["80–100%", MAU.lam, (r) => r >= 0.8 && r < 1],
  ["Đạt 100%", MAU.xanh, (r) => r >= 1],
];

/** Ô chỉ số lớn, có thanh nền thể hiện phần đã đạt so với kế hoạch. */
function O({ icon: I, nhan, so_lieu, phu, mau, phan_tram }) {
  return (
    <div className="card" style={{ padding: 14, position: "relative", overflow: "hidden" }}>
      {phan_tram != null && (
        <span style={{ position: "absolute", left: 0, bottom: 0, height: 3,
                       width: `${Math.min(Math.max(phan_tram * 100, 0), 100)}%`, background: mau }} />
      )}
      <div className="flex items-center gap-2">
        <span style={{ width: 30, height: 30, borderRadius: 9, background: `${mau}18`, color: mau,
                       display: "inline-flex", alignItems: "center", justifyContent: "center" }}><I size={16} /></span>
        <p className="muted" style={{ fontSize: 12 }}>{nhan}</p>
      </div>
      <p style={{ fontSize: 25, fontWeight: 800, color: mau, marginTop: 6, lineHeight: 1.1 }}>{so_lieu}</p>
      {phu && <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>{phu}</p>}
    </div>
  );
}

function Khung({ tieuDe, phu, cao = 280, children }) {
  return (
    <Card title={tieuDe} action={phu && <span className="muted" style={{ fontSize: 12 }}>{phu}</span>}>
      <ResponsiveContainer width="100%" height={cao}>{children}</ResponsiveContainer>
    </Card>
  );
}

const NHAN_MUC = { do: "Cần nhắc ngay", vang: "Chậm cập nhật", xanh: "Đang bám", trong: "Chưa có kế hoạch" };
const MAU_MUC = { do: MAU.do, vang: MAU.vang, xanh: MAU.xanh, trong: MAU.lamNhat };

function The({ muc }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                   color: MAU_MUC[muc], background: `${MAU_MUC[muc]}16`, whiteSpace: "nowrap" }}>
      {NHAN_MUC[muc]}
    </span>
  );
}

export function PhanTichKhoiLuong({ onXemNguoi, onXemDauViec }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [nhomLoc, setNhomLoc] = useState("");     // mảng đang xem, "" = cả phòng
  const [cumLoc, setCumLoc] = useState("");       // trung tâm đang xem, "" = toàn chi nhánh
  const [moNguoi, setMoNguoi] = useState("");
  const [moCum, setMoCum] = useState("");

  const tai = () => api.get("/api/admin/tech-tasks/phan-tich")
    .then((x) => { setD(x); setErr(""); }).catch((e) => setErr(e.message));
  useEffect(() => { tai(); }, []);

  const tenTT = (ma) => (ma === CHUA_CHIA ? "Chưa chia cụm"
    : d?.ten_trung_tam?.[ma] ? `${ma} — ${d.ten_trung_tam[ma]}` : ma);

  /* ---------- lọc: mảng, rồi trung tâm ---------- */
  const chiTiet = useMemo(
    () => (d?.chi_tiet_cum || []).filter((r) => !nhomLoc || r.group === nhomLoc), [d, nhomLoc]);

  /** Đầu việc trong tầm nhìn hiện tại; chọn trung tâm thì số là của riêng trung tâm đó. */
  const dauViec = useMemo(() => {
    const ds = (d?.dau_viec || []).filter((c) => !nhomLoc || c.group === nhomLoc);
    if (!cumLoc) return ds;
    const theo = new Map();
    for (const r of chiTiet.filter((x) => x.center === cumLoc)) {
      const b = theo.get(r.category) || { plan: 0, done: 0, bkk: 0 };
      b.plan += r.plan; b.done += r.done; b.bkk += r.bkk;
      theo.set(r.category, b);
    }
    return ds.filter((c) => theo.has(c.category)).map((c) => {
      const b = theo.get(c.category);
      return { ...c, ...b, ton: Math.max(b.plan - b.bkk - b.done, 0), ty_le: tyLe(b.plan, b.done, b.bkk) };
    });
  }, [d, nhomLoc, cumLoc, chiTiet]);

  const tong = useMemo(() => {
    const t = dauViec.reduce((a, c) => ({
      plan: a.plan + c.plan, done: a.done + c.done, bkk: a.bkk + c.bkk,
      co_so_lieu: a.co_so_lieu + (c.plan ? 1 : 0),
    }), { plan: 0, done: 0, bkk: 0, co_so_lieu: 0 });
    return { ...t, tong_dau_viec: dauViec.length, ton: Math.max(t.plan - t.bkk - t.done, 0),
             ty_le: tyLe(t.plan, t.done, t.bkk) };
  }, [dauViec]);

  /* ---------- gom theo nhóm và theo trung tâm ---------- */
  const theoNhom = useMemo(() => {
    const m = new Map();
    for (const c of dauViec) {
      const g = c.group || "";
      const b = m.get(g) || { code: g, label: c.group_label || "Chưa xếp nhóm", plan: 0, done: 0, bkk: 0, so: 0 };
      b.plan += c.plan; b.done += c.done; b.bkk += c.bkk; b.so += 1;
      m.set(g, b);
    }
    return [...m.values()].filter((g) => g.plan > 0)
      .map((g) => ({ ...g, ten: rutGon(g.label, 22), con_lai: Math.max(g.plan - g.bkk - g.done, 0),
                     ty_le: tyLe(g.plan, g.done, g.bkk) }))
      .sort((a, b) => b.plan - a.plan);
  }, [dauViec]);

  const theoCum = useMemo(() => {
    const m = new Map();
    for (const r of chiTiet) {
      const b = m.get(r.center) || { center: r.center, plan: 0, done: 0, bkk: 0, so: 0 };
      b.plan += r.plan; b.done += r.done; b.bkk += r.bkk; b.so += 1;
      m.set(r.center, b);
    }
    return [...m.values()].map((c) => ({
      ...c, ten: tenTT(c.center), ton: Math.max(c.plan - c.bkk - c.done, 0),
      ty_le: tyLe(c.plan, c.done, c.bkk),
    })).sort((a, b) => b.ton - a.ton || b.plan - a.plan);
  }, [chiTiet, d]);

  /** Chưa lọc mảng thì so các mảng với nhau; đã lọc thì so các đầu việc trong
   *  mảng đó — bày đúng một cột "CĐBR" thì chẳng nói lên điều gì. */
  const cot = useMemo(() => (nhomLoc
    ? [...dauViec].filter((c) => c.plan > 0).sort((a, b) => b.plan - a.plan).slice(0, 14)
      .map((c) => ({ ten: rutGon(c.label, 30), plan: c.plan, done: c.done, bkk: c.bkk,
                     con_lai: Math.max(c.plan - c.bkk - c.done, 0), ty_le: c.ty_le }))
    : theoNhom), [nhomLoc, dauViec, theoNhom]);

  const phanBo = useMemo(() => KHOANG.map(([nhan, mau, hop]) => ({
    khoang: nhan, mau,
    so: dauViec.filter((c) => c.plan > 0 && hop(c.ty_le ?? 0)).length,
  })).filter((x) => x.so > 0), [dauViec]);

  const top = useMemo(() => [...dauViec].filter((c) => c.plan > 0)
    .sort((a, b) => b.plan - a.plan).slice(0, 12)
    .map((c) => ({ ...c, ten: rutGon(c.label, 30) })), [dauViec]);

  /* ---------- người chủ trì, tính theo đúng tầm nhìn đang lọc ---------- */
  const nguoi = useMemo(() => {
    const nguong = d?.nguong || { vang: 7, do: 14 };
    const soLan = Object.fromEntries((d?.nguoi || []).map((p) => [p.name, p.so_lan_sua]));
    const m = new Map();
    for (const c of dauViec) {
      const ten = (c.owner || "").trim();
      if (!ten) continue;
      const p = m.get(ten) || { name: ten, dau_viec: 0, chua_nhap: 0, plan: 0, done: 0, ton: 0,
                                im_lang_ngay: null, lan_cuoi: null, chua_bao_gio: 0, cham: [] };
      p.dau_viec += 1;
      p.chua_nhap += c.plan ? 0 : 1;
      p.plan += c.plan; p.done += c.done; p.ton += c.ton;
      if (c.im_lang_ngay != null && (p.im_lang_ngay == null || c.im_lang_ngay > p.im_lang_ngay)) {
        p.im_lang_ngay = c.im_lang_ngay;
      }
      if (c.updated_at && (!p.lan_cuoi || c.updated_at > p.lan_cuoi)) p.lan_cuoi = c.updated_at;
      if (c.plan) {
        if (c.im_lang_ngay == null) {
          p.chua_bao_gio += 1;
          p.cham.push({ category: c.category, label: c.label, im_lang_ngay: null, ton: c.ton });
        } else if (c.im_lang_ngay >= nguong.vang) {
          p.cham.push({ category: c.category, label: c.label, im_lang_ngay: c.im_lang_ngay, ton: c.ton });
        }
      }
      m.set(ten, p);
    }
    const thuTu = { do: 0, vang: 1, trong: 2, xanh: 3 };
    return [...m.values()].map((p) => {
      const im = p.im_lang_ngay;
      const muc = p.plan <= 0 ? "trong"
        : p.chua_bao_gio || (im != null && im >= nguong.do) ? "do"
          : im != null && im >= nguong.vang ? "vang" : "xanh";
      const ly = [];
      if (p.chua_bao_gio) ly.push(`${p.chua_bao_gio} đầu việc chưa cập nhật lần nào`);
      if (im != null && im >= nguong.vang) ly.push(`${im} ngày chưa cập nhật`);
      return { ...p, muc, ly_do: ly.join(" · "), so_lan_sua: soLan[p.name] || 0,
               cham: p.cham.sort((a, b) => (b.im_lang_ngay ?? 99999) - (a.im_lang_ngay ?? 99999)).slice(0, 6) };
    }).sort((a, b) => thuTu[a.muc] - thuTu[b.muc] || b.chua_bao_gio - a.chua_bao_gio
                      || (b.im_lang_ngay || 0) - (a.im_lang_ngay || 0) || b.ton - a.ton);
  }, [dauViec, d]);

  if (err) return <p style={{ color: RED }}>{err}</p>;
  if (!d) return <p className="muted">Đang tải phân tích…</p>;

  const canhBao = nguoi.filter((p) => p.muc === "do" || p.muc === "vang");
  const nhipCao = Math.max(...(d.nhip || []).map((x) => x.so_lan), 0);
  const tongSua = (d.nhip || []).reduce((a, x) => a + x.so_lan, 0);
  const dsNhom = (d.theo_nhom || []).filter((g) => g.code);
  const dangLoc = !!(nhomLoc || cumLoc);
  const tenNhomLoc = dsNhom.find((g) => g.code === nhomLoc)?.label || "";

  return (
    <div className="flex flex-col gap-4">
      <div className="card" style={{ paddingBottom: 10 }}>
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <b>Phân tích khối lượng — kỳ {d.ky || "—"}</b>
            <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>
              Tỷ lệ hoàn thành = thực hiện ÷ (kế hoạch − BKK). BKK là phần không làm được vì lý do
              khách quan nên được trừ khỏi kế hoạch và không tính vào tồn.
            </p>
          </div>
          <button className="btn btn-sm" onClick={tai}><RefreshCw size={13} />Tải lại</button>
        </div>

        {/* Lọc theo mảng: trưởng nhóm bấm một cái là chỉ còn phần của mình. */}
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap", marginTop: 10 }}>
          <span className="muted" style={{ fontSize: 12, minWidth: 42 }}>Mảng:</span>
          <button className={`btn btn-sm ${nhomLoc ? "" : "btn-red"}`}
            onClick={() => { setNhomLoc(""); setMoCum(""); }}>Tất cả</button>
          {dsNhom.map((g) => (
            <button key={g.code} className={`btn btn-sm ${nhomLoc === g.code ? "btn-red" : ""}`}
              title={`${so(g.plan)} kế hoạch · ${pct(g.ty_le)} hoàn thành`}
              onClick={() => { setNhomLoc(nhomLoc === g.code ? "" : g.code); setMoCum(""); }}>
              {g.label}
            </button>
          ))}
        </div>

        {/* Lọc theo trung tâm: huyện xem toàn bộ việc của mình. */}
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap", marginTop: 8 }}>
          <span className="muted" style={{ fontSize: 12, minWidth: 42 }}>Trung tâm:</span>
          <select className="inp" style={{ maxWidth: 260 }} value={cumLoc}
            onChange={(e) => { setCumLoc(e.target.value); setMoCum(""); }}>
            <option value="">Toàn chi nhánh</option>
            {theoCum.map((c) => <option key={c.center} value={c.center}>{c.ten}</option>)}
          </select>
          {dangLoc && (
            <button className="btn btn-sm" onClick={() => { setNhomLoc(""); setCumLoc(""); setMoCum(""); }}>
              <X size={13} />Bỏ lọc
            </button>
          )}
          {dangLoc && (
            <span style={{ fontSize: 12.5, fontWeight: 700, color: MAU.lam }}>
              Đang xem: {tenNhomLoc || "mọi mảng"}{cumLoc ? ` · ${tenTT(cumLoc)}` : " · toàn chi nhánh"}
              {" — "}{dauViec.length} đầu việc
            </span>
          )}
        </div>
      </div>

      {/* 1. Đang ở đâu */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <O icon={Target} nhan="Kế hoạch kỳ này" so_lieu={so(tong.plan)} mau={MAU.lam}
          phu={`${tong.co_so_lieu}/${tong.tong_dau_viec} đầu việc đã có số`}
          phan_tram={tong.tong_dau_viec ? tong.co_so_lieu / tong.tong_dau_viec : 0} />
        <O icon={CheckCircle2} nhan="Thực hiện" so_lieu={so(tong.done)} mau={MAU.xanh}
          phu={`Tỷ lệ ${pct(tong.ty_le)}`} phan_tram={tong.ty_le} />
        <O icon={TrendingUp} nhan="Tỷ lệ hoàn thành" so_lieu={pct(tong.ty_le)} mau={mauTyLe(tong.ty_le)}
          phu="thực hiện ÷ (kế hoạch − BKK)" phan_tram={tong.ty_le} />
        <O icon={Layers} nhan="Còn tồn" so_lieu={so(tong.ton)} mau={tong.ton ? MAU.vang : MAU.xanh}
          phu={tong.plan ? `${pct(tong.ton / Math.max(tong.plan - tong.bkk, 1))} khối lượng phải làm` : "—"} />
        <O icon={AlertTriangle} nhan="BKK" so_lieu={so(tong.bkk)} mau={MAU.tim}
          phu="đã trừ khỏi kế hoạch khi tính tỷ lệ" />
        <O icon={Activity} nhan="Lượt cập nhật 30 ngày" so_lieu={so(tongSua)} mau={MAU.lamNhat}
          phu={canhBao.length ? `${canhBao.length} người cần nhắc` : "cả phòng đang bám số"} />
      </div>

      {/* 2 + 3. Mảng nào kéo lùi, bao nhiêu đầu việc nhúc nhích */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Khung tieuDe={nhomLoc ? `Tiến độ từng đầu việc — ${tenNhomLoc}` : "Tiến độ theo nhóm đầu việc"}
            phu={nhomLoc ? `${cot.length}/${tong.co_so_lieu} đầu việc có kế hoạch`
              : `${theoNhom.length} nhóm có kế hoạch`}
            cao={Math.max(240, 60 + cot.length * 32)}>
            <BarChart data={cot} layout="vertical" margin={{ top: 4, right: 70, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF1F6" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="ten" width={nhomLoc ? 210 : 150} tick={{ fontSize: 11.5 }} />
              <Tooltip {...tooltipStyle} formatter={(v, n) => [so(v), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar isAnimationActive={false} dataKey="done" name="Thực hiện" stackId="a" fill={MAU.xanh} />
              <Bar isAnimationActive={false} dataKey="con_lai" name="Còn lại" stackId="a" fill={MAU.lamNhat} radius={[0, 5, 5, 0]}>
                <LabelList dataKey="ty_le" position="right" formatter={pct}
                  style={{ fontSize: 11, fontWeight: 700 }} />
              </Bar>
              <Bar isAnimationActive={false} dataKey="bkk" name="BKK" stackId="a" fill={MAU.tim} />
            </BarChart>
          </Khung>
        </div>
        <Card title="Đầu việc theo mức hoàn thành"
          action={<span className="muted" style={{ fontSize: 12 }}>{tong.co_so_lieu} đầu việc có kế hoạch</span>}>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={phanBo} dataKey="so" nameKey="khoang" innerRadius="56%" outerRadius="88%"
                isAnimationActive={false} paddingAngle={2}>
                {phanBo.map((x) => <Cell key={x.khoang} fill={x.mau} />)}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v} đầu việc`, n]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 8 }}>
            {phanBo.map((x) => (
              <div key={x.khoang} className="flex items-center gap-2"
                style={{ fontSize: 12.5, padding: "3px 0", borderTop: "1px solid #F4F1F2" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: x.mau }} />
                <span style={{ flex: 1 }}>{x.khoang}</span>
                <b>{x.so}</b>
                <span className="muted" style={{ minWidth: 48, textAlign: "right" }}>
                  {tong.co_so_lieu ? pct(x.so / tong.co_so_lieu) : "—"}
                </span>
              </div>
            ))}
            {!phanBo.length && (
              <p className="muted" style={{ fontSize: 12.5 }}>Phần đang xem chưa có đầu việc nào có kế hoạch.</p>
            )}
          </div>
        </Card>
      </div>

      {/* 4. Tồn theo trung tâm — huyện nào đang đọng việc, đọng ở đâu */}
      <Card title={`Tồn theo trung tâm${nhomLoc ? ` — ${tenNhomLoc}` : ""}`} icon={Building2} pad={false}
        action={<span className="muted" style={{ fontSize: 12 }}>
          bấm một trung tâm để xem từng đầu việc · số liệu theo cụm, chưa gồm hoàn công và dự án
        </span>}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Trung tâm</th><th>Đầu việc có số</th><th>Kế hoạch</th><th>Thực hiện</th>
                <th>BKK</th><th>Tồn</th><th>Tỷ lệ hoàn thành</th>
              </tr>
            </thead>
            <tbody>
              {theoCum.map((c) => {
                const mo = moCum === c.center;
                const cua = chiTiet.filter((r) => r.center === c.center)
                  .map((r) => ({ ...r,
                                 label: (d.dau_viec || []).find((x) => x.category === r.category)?.label || r.category }))
                  .sort((a, b) => b.ton - a.ton);
                return (
                  <React.Fragment key={c.center}>
                    <tr style={{ cursor: "pointer", background: cumLoc === c.center ? "#F3F8FE" : undefined }}
                      onClick={() => setMoCum(mo ? "" : c.center)}>
                      <td><b>{c.ten}</b>{c.center === CHUA_CHIA && (
                        <span className="muted" style={{ fontSize: 11.5 }}> · phần chưa chia về cụm</span>
                      )}</td>
                      <td>{c.so}</td>
                      <td>{so(c.plan)}</td>
                      <td style={{ color: c.done ? MAU.xanh : undefined }}>{c.done ? so(c.done) : "—"}</td>
                      <td>{c.bkk ? so(c.bkk) : "—"}</td>
                      <td style={{ fontWeight: 700, color: c.ton ? MAU.vang : MAU.xanh }}>{so(c.ton)}</td>
                      <td style={{ color: mauTyLe(c.ty_le), fontWeight: 600 }}>{pct(c.ty_le)}</td>
                    </tr>
                    {mo && (
                      <tr><td colSpan={7} style={{ background: "#FCFBFB" }}>
                        <table className="tbl" style={{ margin: 0 }}>
                          <thead><tr><th>Đầu việc</th><th>Kế hoạch</th><th>Thực hiện</th><th>Tồn</th><th>Tỷ lệ</th><th /></tr></thead>
                          <tbody>
                            {cua.map((r) => (
                              <tr key={r.category}>
                                <td>{r.label}</td>
                                <td>{so(r.plan)}</td>
                                <td style={{ color: r.done ? MAU.xanh : undefined }}>{r.done ? so(r.done) : "—"}</td>
                                <td style={{ fontWeight: 700, color: r.ton ? MAU.vang : MAU.xanh }}>{so(r.ton)}</td>
                                <td style={{ color: mauTyLe(tyLe(r.plan, r.done, r.bkk)) }}>
                                  {pct(tyLe(r.plan, r.done, r.bkk))}
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {onXemDauViec && (
                                    <button className="btn btn-sm" style={{ padding: "1px 7px", fontSize: 11 }}
                                      onClick={(e) => { e.stopPropagation(); onXemDauViec(r.category); }}>
                                      Mở đầu việc
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
              {!theoCum.length && (
                <tr><td colSpan={7} className="muted" style={{ fontSize: 12.5 }}>
                  Mảng này chưa có số liệu chia theo trung tâm.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 5. Nhịp cập nhật + ai đang bỏ bẵng */}
      <Khung tieuDe="Nhịp cập nhật số liệu"
        phu={`${d.nguong?.nhip_ngay || 30} ngày gần nhất · cao nhất ${so(nhipCao)} lượt/ngày · tính cho cả phòng`}
        cao={210}>
        <AreaChart data={d.nhip || []} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="gr-nhip" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={MAU.lam} stopOpacity={0.45} />
              <stop offset="100%" stopColor={MAU.lam} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F6" />
          <XAxis dataKey="nhan" tick={{ fontSize: 10.5 }} interval={Math.ceil((d.nhip || []).length / 10)} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip {...tooltipStyle} formatter={(v, n) => [so(v), n === "so_lan" ? "Lượt cập nhật" : n]} />
          <Area isAnimationActive={false} type="monotone" dataKey="so_lan" name="Lượt cập nhật"
            stroke={MAU.lam} strokeWidth={2} fill="url(#gr-nhip)" />
        </AreaChart>
      </Khung>

      <Card title={canhBao.length
        ? `Cảnh báo cập nhật — ${canhBao.length}/${nguoi.length} người cần nhắc`
        : `Theo dõi cập nhật — ${nguoi.length} người, không ai bỏ bẵng`}
        icon={CalendarClock} pad={false}
        action={<span className="muted" style={{ fontSize: 12 }}>
          nhắc sau {d.nguong?.vang || 7} ngày · báo động sau {d.nguong?.do || 14} ngày
          {nhomLoc ? ` · chỉ tính mảng ${tenNhomLoc}` : ""}
        </span>}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Nhân sự chủ trì</th><th>Tình trạng</th><th>Đầu việc</th>
                <th>Kế hoạch</th><th>Thực hiện</th><th>Tồn</th>
                <th>Cập nhật gần nhất</th><th>Lượt sửa 30 ngày</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {nguoi.map((p) => (
                <React.Fragment key={p.name}>
                  <tr style={{ background: p.muc === "do" ? "#FBF4F5" : p.muc === "vang" ? "#FFFBF0" : undefined }}>
                    <td>
                      <b>{p.name}</b>
                      {!!p.cham.length && (
                        <button type="button" className="btn btn-sm" style={{ marginLeft: 6, padding: "1px 6px", fontSize: 11 }}
                          onClick={() => setMoNguoi(moNguoi === p.name ? "" : p.name)}>
                          {p.cham.length} đầu việc chậm {moNguoi === p.name ? "▲" : "▼"}
                        </button>
                      )}
                    </td>
                    <td><The muc={p.muc} />{p.ly_do && (
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{p.ly_do}</div>
                    )}</td>
                    <td>{p.dau_viec}{!!p.chua_nhap && (
                      <span className="muted" style={{ fontSize: 11.5 }}> · {p.chua_nhap} chưa có kế hoạch</span>
                    )}</td>
                    <td>{so(p.plan)}</td>
                    <td style={{ color: p.done ? MAU.xanh : undefined }}>{p.done ? so(p.done) : "—"}</td>
                    <td style={{ color: p.ton ? MAU.vang : undefined, fontWeight: p.ton ? 700 : 400 }}>
                      {p.ton ? so(p.ton) : "—"}
                    </td>
                    <td style={{ fontSize: 12.5, whiteSpace: "nowrap", color: p.muc === "do" ? RED : undefined }}>
                      {p.lan_cuoi ? (p.im_lang_ngay === 0 ? "hôm nay" : `${p.im_lang_ngay} ngày trước`) : "chưa lần nào"}
                    </td>
                    <td>{p.so_lan_sua || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <ThaoTac onView={onXemNguoi ? () => onXemNguoi(p.name) : null}
                        xemTitle={`Xem việc của ${p.name}`} />
                    </td>
                  </tr>
                  {moNguoi === p.name && (
                    <tr><td colSpan={9} style={{ background: "#FCFBFB" }}>
                      {p.cham.map((x) => (
                        <div key={x.label} className="flex items-center gap-2"
                          style={{ fontSize: 12.5, padding: "3px 0", flexWrap: "wrap" }}>
                          <span style={{ width: 7, height: 7, borderRadius: 99,
                                         background: x.im_lang_ngay == null ? MAU.do : MAU.vang }} />
                          <b>{x.label}</b>
                          <span className="muted">
                            {x.im_lang_ngay == null ? "chưa cập nhật lần nào" : `${x.im_lang_ngay} ngày chưa cập nhật`}
                            {!!x.ton && ` · tồn ${so(x.ton)}`}
                          </span>
                          {onXemDauViec && (
                            <button className="btn btn-sm" style={{ padding: "1px 7px", fontSize: 11 }}
                              onClick={() => onXemDauViec(x.category)}>Mở đầu việc</button>
                          )}
                        </div>
                      ))}
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
              {!nguoi.length && (
                <tr><td colSpan={9} className="muted" style={{ fontSize: 12.5 }}>
                  Phần đang xem chưa đầu việc nào ghi nhân sự chủ trì — đặt ở “Cơ cấu đầu việc”.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top đầu việc theo khối lượng */}
      <Khung tieuDe={`Khối lượng lớn nhất${cumLoc ? ` — ${tenTT(cumLoc)}` : ""}`}
        phu={`${top.length}/${tong.co_so_lieu} đầu việc có kế hoạch`}
        cao={Math.max(260, 60 + top.length * 30)}>
        <BarChart data={top} layout="vertical" margin={{ top: 4, right: 64, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF1F6" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="ten" width={210} tick={{ fontSize: 11.5 }} />
          <Tooltip {...tooltipStyle} formatter={(v, n) => [so(v), n]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar isAnimationActive={false} dataKey="plan" name="Kế hoạch" fill={MAU.lamNhat} radius={[0, 5, 5, 0]} />
          <Bar isAnimationActive={false} dataKey="done" name="Thực hiện" fill={MAU.xanh} radius={[0, 5, 5, 0]}>
            <LabelList dataKey="ty_le" position="right" formatter={pct}
              style={{ fontSize: 11, fontWeight: 700 }} />
          </Bar>
        </BarChart>
      </Khung>
    </div>
  );
}
