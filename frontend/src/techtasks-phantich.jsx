import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Activity, CalendarClock, CheckCircle2, Layers, RefreshCw, Target, TrendingUp } from "lucide-react";
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
 * nên báo cáo đọc theo khối lượng chứ không đếm số nhiệm vụ. Bốn câu hỏi được
 * trả lời theo đúng thứ tự người đọc cần:
 *   1. Cả phòng đang ở đâu so với kế hoạch tháng?   -> dải chỉ số + thanh tiến độ
 *   2. Mảng nào kéo lùi?                            -> cột ngang theo nhóm
 *   3. Bao nhiêu đầu việc thật sự nhúc nhích?       -> vành phân bố mức hoàn thành
 *   4. Ai đang bỏ bẵng số liệu?                     -> nhịp cập nhật + bảng cảnh báo
 *
 * Không dùng màu xám cho chuỗi dữ liệu (quy ước chung của các Dashboard).
 * ResponsiveContainer nhận chiều cao là SỐ, không phải "100%".
 */

const MAU = {
  xanh: "#16A34A", lam: "#0E6CD6", lamNhat: "#5B8DEF", vang: "#F2A007",
  do: "#C8102E", tim: "#8B5CF6",
};
const so = (n) => Number(n || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
const pct = (r) => (r == null ? "—" : `${(Math.round(r * 1000) / 10).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`);
const rutGon = (s, n = 26) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));
const mauTyLe = (r) => (r == null ? MAU.lamNhat : r >= 1 ? MAU.xanh : r >= 0.8 ? MAU.lam : r >= 0.5 ? MAU.lamNhat : r > 0 ? MAU.vang : MAU.do);

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

function Khung({ tieuDe, phu, cao = 280, children, hanhDong }) {
  return (
    <Card title={tieuDe}
      action={hanhDong || (phu && <span className="muted" style={{ fontSize: 12 }}>{phu}</span>)}>
      <ResponsiveContainer width="100%" height={cao}>{children}</ResponsiveContainer>
    </Card>
  );
}

const NHAN_MUC = { do: "Cần nhắc ngay", vang: "Chậm cập nhật", xanh: "Đang bám",
                   trong: "Chưa có kế hoạch" };
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
  const [moNguoi, setMoNguoi] = useState("");     // tên đang mở danh sách đầu việc chậm

  const tai = () => api.get("/api/admin/tech-tasks/phan-tich")
    .then((x) => { setD(x); setErr(""); }).catch((e) => setErr(e.message));
  useEffect(() => { tai(); }, []);

  const nhom = useMemo(() => (d?.theo_nhom || [])
    .filter((g) => g.plan > 0)
    .map((g) => ({ ...g, ten: rutGon(g.label, 22), con_lai: Math.max(g.plan - g.bkk - g.done, 0) })), [d]);
  const phanBo = useMemo(() => (d?.phan_bo || []).filter((x) => x.so > 0), [d]);
  const top = useMemo(() => (d?.dau_viec || []).filter((x) => x.plan > 0).slice(0, 12)
    .map((x) => ({ ...x, ten: rutGon(x.label, 30) })), [d]);

  if (err) return <p style={{ color: RED }}>{err}</p>;
  if (!d) return <p className="muted">Đang tải phân tích…</p>;

  const t = d.tong || {};
  const canhBao = (d.nguoi || []).filter((p) => p.muc === "do" || p.muc === "vang");
  const nhipCao = Math.max(...(d.nhip || []).map((x) => x.so_lan), 0);
  const tongSua = (d.nhip || []).reduce((a, x) => a + x.so_lan, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <b>Phân tích khối lượng — kỳ {d.ky || "—"}</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>
            Đọc theo khối lượng: tỷ lệ hoàn thành = thực hiện ÷ (kế hoạch − BKK). BKK là phần không làm
            được vì lý do khách quan nên được trừ khỏi kế hoạch và không tính vào tồn.
          </p>
        </div>
        <button className="btn btn-sm" onClick={tai}><RefreshCw size={13} />Tải lại</button>
      </div>

      {/* 1. Cả phòng đang ở đâu */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <O icon={Target} nhan="Kế hoạch kỳ này" so_lieu={so(t.plan)} mau={MAU.lam}
          phu={`${t.co_so_lieu}/${t.tong_dau_viec} đầu việc đã có số`} phan_tram={t.tong_dau_viec ? t.co_so_lieu / t.tong_dau_viec : 0} />
        <O icon={CheckCircle2} nhan="Thực hiện" so_lieu={so(t.done)} mau={MAU.xanh}
          phu={`Tỷ lệ ${pct(t.ty_le)}`} phan_tram={t.ty_le} />
        <O icon={TrendingUp} nhan="Tỷ lệ hoàn thành" so_lieu={pct(t.ty_le)} mau={mauTyLe(t.ty_le)}
          phu="thực hiện ÷ (kế hoạch − BKK)" phan_tram={t.ty_le} />
        <O icon={Layers} nhan="Còn tồn" so_lieu={so(t.ton)} mau={t.ton ? MAU.vang : MAU.xanh}
          phu={t.plan ? `${pct(t.ton / Math.max(t.plan - t.bkk, 1))} khối lượng phải làm` : "—"} />
        <O icon={AlertTriangle} nhan="BKK" so_lieu={so(t.bkk)} mau={MAU.tim}
          phu="đã trừ khỏi kế hoạch khi tính tỷ lệ" />
        <O icon={Activity} nhan="Lượt cập nhật 30 ngày" so_lieu={so(tongSua)} mau={MAU.lamNhat}
          phu={canhBao.length ? `${canhBao.length} người cần nhắc` : "cả phòng đang bám số"} />
      </div>

      {/* 2 + 3. Mảng nào kéo lùi, bao nhiêu đầu việc nhúc nhích */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Khung tieuDe="Tiến độ theo nhóm đầu việc" phu={`${nhom.length} nhóm có kế hoạch`}
            cao={Math.max(240, 60 + nhom.length * 34)}>
            <BarChart data={nhom} layout="vertical" margin={{ top: 4, right: 70, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF1F6" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="ten" width={150} tick={{ fontSize: 11.5 }} />
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
          action={<span className="muted" style={{ fontSize: 12 }}>{t.co_so_lieu} đầu việc có kế hoạch</span>}>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={phanBo} dataKey="so" nameKey="khoang" innerRadius="56%" outerRadius="88%"
                isAnimationActive={false} paddingAngle={2}>
                {phanBo.map((x) => <Cell key={x.khoang} fill={x.mau} />)}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v} đầu việc`, n]} />
            </PieChart>
          </ResponsiveContainer>
          {/* Chú giải nằm dưới: viết chữ quanh vành thì thẻ hẹp là bị cắt mất. */}
          <div style={{ marginTop: 8 }}>
            {phanBo.map((x) => (
              <div key={x.khoang} className="flex items-center gap-2"
                style={{ fontSize: 12.5, padding: "3px 0", borderTop: "1px solid #F4F1F2" }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: x.mau }} />
                <span style={{ flex: 1 }}>{x.khoang}</span>
                <b>{x.so}</b>
                <span className="muted" style={{ minWidth: 48, textAlign: "right" }}>
                  {t.co_so_lieu ? pct(x.so / t.co_so_lieu) : "—"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 4. Nhịp cập nhật */}
      <Khung tieuDe="Nhịp cập nhật số liệu"
        phu={`${d.nguong?.nhip_ngay || 30} ngày gần nhất · cao nhất ${so(nhipCao)} lượt/ngày`} cao={210}>
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

      {/* Ai đang bỏ bẵng số liệu */}
      <Card title={canhBao.length
        ? `Cảnh báo cập nhật — ${canhBao.length}/${(d.nguoi || []).length} người cần nhắc`
        : `Theo dõi cập nhật — ${(d.nguoi || []).length} người, không ai bỏ bẵng`}
        icon={CalendarClock} pad={false}
        action={<span className="muted" style={{ fontSize: 12 }}>
          nhắc sau {d.nguong?.vang || 7} ngày · báo động sau {d.nguong?.do || 14} ngày
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
              {(d.nguoi || []).map((p) => (
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
                    <td style={{ color: p.ton ? MAU.vang : undefined, fontWeight: p.ton ? 700 : 400 }}>{p.ton ? so(p.ton) : "—"}</td>
                    <td style={{ fontSize: 12.5, whiteSpace: "nowrap", color: p.muc === "do" ? RED : undefined }}>
                      {p.lan_cuoi ? `${p.im_lang_ngay === 0 ? "hôm nay" : `${p.im_lang_ngay} ngày trước`}` : "chưa lần nào"}
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
              {!(d.nguoi || []).length && (
                <tr><td colSpan={9} className="muted" style={{ fontSize: 12.5 }}>
                  Chưa đầu việc nào ghi nhân sự chủ trì — đặt ở “Cơ cấu đầu việc”.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top đầu việc theo khối lượng */}
      <Khung tieuDe="Khối lượng lớn nhất trong kỳ"
        phu={`${top.length}/${t.co_so_lieu} đầu việc có kế hoạch`}
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
