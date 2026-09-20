import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, RefreshCw, Users } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "./api";
import { Card, Empty, RED, ThaoTac, tooltipStyle } from "./ui";

/*
 * Tab "Báo cáo" của Công việc kỹ thuật: biểu đồ số công việc theo trạng thái,
 * đầu việc, nhân viên, hạn xử lý, xu hướng giao/hoàn thành theo tuần và tiến
 * độ hạng mục. Số liệu lấy một lần từ /api/admin/tech-tasks/report.
 * Không dùng màu xám cho chuỗi dữ liệu (quy ước chung của các Dashboard).
 * ResponsiveContainer nhận chiều cao là SỐ (như các biểu đồ Dashboard): để nó
 * tự lấy 100% chiều cao của một div bọc ngoài thì lần đo đầu ra bề rộng gần
 * bằng 0 và cả biểu đồ bị vẽ co lại ở góc trái. Tắt hiệu ứng động cho cột luôn
 * vẽ đúng chỗ ngay lần đầu.
 */

const MAU = { done: "#16A34A", doing: "#0E6CD6", todo: "#F2A007", overdue: "#C8102E" };
const NHAN = { done: "Hoàn thành", doing: "Đang thực hiện", todo: "Chưa bắt đầu", overdue: "Quá hạn" };
const THU_TU = ["overdue", "todo", "doing", "done"];   // xếp chồng: quá hạn ở đáy cho dễ thấy
const MAU_UU_TIEN = { cao: "#C8102E", trung_binh: "#0E6CD6", thap: "#16A34A" };
const MAU_KHOANG = { "0-25%": "#C8102E", "26-50%": "#F2A007", "51-75%": "#5B8DEF", "76-99%": "#0E6CD6", "100%": "#16A34A" };
const HAN = [
  ["qua_han", "Quá hạn", "#C8102E"], ["trong_3_ngay", "≤ 3 ngày", "#F2A007"],
  ["trong_7_ngay", "4–7 ngày", "#5B8DEF"], ["sau_7_ngay", "> 7 ngày", "#0E6CD6"],
  ["khong_han", "Chưa đặt hạn", "#8B5CF6"],
];
const pct = (r) => (r == null ? "—" : `${Math.round(r * 100)}%`);
const boSo = (s) => String(s || "").replace(/^\d+\.\s*/, "");
const rutGon = (s, n = 16) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const so = (n) => Number(n || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 });

function OChiSo({ icon: I, nhan, gia_tri, phu, mau }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="flex items-center gap-2">
        <span style={{ width: 30, height: 30, borderRadius: 9, background: `${mau}18`, color: mau,
                       display: "inline-flex", alignItems: "center", justifyContent: "center" }}><I size={16} /></span>
        <p className="muted" style={{ fontSize: 12 }}>{nhan}</p>
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color: mau, marginTop: 6, lineHeight: 1.1 }}>{gia_tri}</p>
      {phu && <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>{phu}</p>}
    </div>
  );
}

function Khung({ tieuDe, phu, children, cao = 280 }) {
  return (
    <Card title={tieuDe} action={phu && <span className="muted" style={{ fontSize: 12 }}>{phu}</span>}>
      <ResponsiveContainer width="100%" height={cao}>{children}</ResponsiveContainer>
    </Card>
  );
}

export function BaoCaoCongViec({ onXemViec, onXemDauViec }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [tuan, setTuan] = useState(8);

  const load = () => api.get(`/api/admin/tech-tasks/report?weeks=${tuan}`)
    .then((x) => { setD(x); setErr(""); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [tuan]);

  if (err) return <p style={{ color: RED }}>{err}</p>;
  if (!d) return <p className="muted">Đang tải báo cáo…</p>;

  const tt = d.trang_thai || {};
  const conMo = d.tong - (tt.done || 0);
  const sapHan = d.han?.trong_3_ngay || 0;
  const canhBao = (d.nguoi || []).filter((p) => p.muc !== "xanh");

  const dauViec = (d.theo_dau_viec || []).map((x) => ({ ...x, ten: boSo(x.label) }));
  const tron = THU_TU.slice().reverse().map((k) => ({ key: k, name: NHAN[k], value: tt[k] || 0 })).filter((x) => x.value > 0);
  const nguoi = [...(d.nguoi || [])].sort((a, b) => b.tong - a.tong || a.name.localeCompare(b.name, "vi")).slice(0, 15)
    .map((p) => ({ ten: p.name, xong: p.done, dang_mo: p.ton - p.overdue, qua_han: p.overdue, tong: p.tong }));
  const han = HAN.map(([k, n, m]) => ({ ten: n, so: d.han?.[k] || 0, mau: m }));
  const theoNhom = (d.theo_nhom || []).map((g) => ({ ...g, ten: g.label }));
  const uuTien = (d.uu_tien || []).filter((x) => x.tong > 0);
  const khoang = (d.khoang_tien_do || []).map((x) => ({ ...x, ten: x.khoang }));
  const tienDoTatCa = (d.tien_do || [])
    .map((g) => ({ ten: boSo(g.label), ke_hoach: g.plan, thuc_hien: g.done, ty_le: g.rate, ky: g.period }))
    .filter((g) => g.ke_hoach > 0);
  // Cả phòng có tám chục đầu việc, vẽ hết thì chữ chồng lên nhau. Lấy 12 đầu
  // việc kế hoạch lớn nhất — phần còn lại xem ở bảng trong từng đầu việc.
  const tienDo = [...tienDoTatCa].sort((a, b) => b.ke_hoach - a.ke_hoach).slice(0, 12);
  const kyTienDo = tienDo[0]?.ky;

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <b>Báo cáo công việc kỹ thuật</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>
            Tổng hợp theo trạng thái, đầu việc, nhân viên và hạn xử lý{d.toan_phong ? "" : " — tài khoản của bạn chỉ thấy số liệu của chính mình ở phần nhân viên"}.
            Bấm cột đầu việc hoặc tên nhân viên để mở danh sách việc tương ứng.
          </p>
        </div>
        <select className="inp" style={{ maxWidth: 170 }} value={tuan} onChange={(e) => setTuan(Number(e.target.value))}>
          {[4, 8, 12, 26].map((n) => <option key={n} value={n}>Xu hướng {n} tuần</option>)}
        </select>
        <button className="btn btn-sm" onClick={load}><RefreshCw size={14} />Tải lại</button>
      </div>

      {/* Sáu ô này đếm nhiệm vụ. Phòng theo dõi bằng khối lượng nên có lúc chưa
          giao nhiệm vụ nào — khi ấy bày sáu số 0 chỉ làm rối, giữ lại ô nhân sự. */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {!!d.tong && <>
        <OChiSo icon={ClipboardList} nhan="Tổng công việc" gia_tri={d.tong} phu={`${conMo} việc đang mở`} mau="#0E6CD6" />
        <OChiSo icon={CheckCircle2} nhan="Hoàn thành" gia_tri={tt.done || 0} phu={`Tỷ lệ ${pct(d.ty_le_hoan_thanh)}`} mau={MAU.done} />
        <OChiSo icon={Clock} nhan="Đang thực hiện" gia_tri={tt.doing || 0} phu={`${tt.todo || 0} chưa bắt đầu`} mau={MAU.doing} />
        <OChiSo icon={AlertTriangle} nhan="Quá hạn" gia_tri={tt.overdue || 0} phu={conMo ? `${pct((tt.overdue || 0) / conMo)} số việc đang mở` : "—"} mau={MAU.overdue} />
        <OChiSo icon={Clock} nhan="Sắp đến hạn (≤ 3 ngày)" gia_tri={sapHan} phu={`${d.han?.khong_han || 0} việc chưa đặt hạn`} mau={MAU.todo} />
        </>}
        <OChiSo icon={Users} nhan="Nhân viên có việc" gia_tri={(d.nguoi || []).length}
          phu={canhBao.length ? `${canhBao.length} người đang có cảnh báo` : "Không ai bị cảnh báo"} mau={canhBao.length ? MAU.overdue : "#0E6CD6"} />
      </div>

      {!d.tong && (
        <p className="muted" style={{ fontSize: 12.5 }}>
          Kỳ này chưa giao nhiệm vụ riêng lẻ nào — báo cáo dưới đây đọc theo khối lượng.
          Biểu đồ trạng thái và hạn xử lý sẽ hiện khi có nhiệm vụ ở tab Danh sách công việc.
        </p>
      )}

      {!!d.tong && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Khung tieuDe="Công việc theo đầu việc" phu="Bấm cột để xem danh sách" cao={300}>
                <BarChart data={dauViec} margin={{ top: 16, right: 10, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F6" />
                  <XAxis dataKey="ten" tick={{ fontSize: 11 }} interval={0} tickFormatter={(v) => rutGon(v, 12)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {THU_TU.map((k, i) => (
                    <Bar isAnimationActive={false} key={k} dataKey={k} name={NHAN[k]} stackId="a" fill={MAU[k]} cursor="pointer"
                      radius={i === THU_TU.length - 1 ? [5, 5, 0, 0] : 0}
                      onClick={(e) => onXemDauViec?.(e?.category)}>
                      {i === THU_TU.length - 1 && <LabelList dataKey="total" position="top" style={{ fontSize: 11, fontWeight: 700 }} formatter={(v) => (v ? v : "")} />}
                    </Bar>
                  ))}
                </BarChart>
            </Khung>
          </div>
          <Khung tieuDe="Tỷ lệ theo trạng thái" cao={300}>
              <PieChart>
                <Pie isAnimationActive={false} data={tron} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="68%" paddingAngle={2}
                  label={({ value, percent }) => `${value} (${Math.round(percent * 100)}%)`} labelLine={false}>
                  {tron.map((x) => <Cell key={x.key} fill={MAU[x.key]} />)}
                </Pie>
                <text x="50%" y="46%" textAnchor="middle" style={{ fontSize: 22, fontWeight: 800, fill: MAU.done }}>{pct(d.ty_le_hoan_thanh)}</text>
                <text x="50%" y="55%" textAnchor="middle" style={{ fontSize: 11.5, fill: "#807A7C" }}>hoàn thành</text>
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
          </Khung>
        </div>
      )}

      {!!d.tong && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Khung tieuDe="Đánh giá theo nhóm đầu việc" phu="Nhóm cấp 1 (vd CĐBR) — cột chia theo trạng thái" cao={280}>
              <BarChart data={theoNhom} margin={{ top: 16, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F6" />
                <XAxis dataKey="ten" tick={{ fontSize: 11 }} interval={0} tickFormatter={(v) => rutGon(v, 14)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip {...tooltipStyle} formatter={(v, n, o) => [v, n]}
                  labelFormatter={(v) => {
                    const g = theoNhom.find((x) => x.ten === v);
                    return g ? `${v} — tiến độ trung bình ${g.phan_tram}%` : v;
                  }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {THU_TU.map((k, i) => (
                  <Bar isAnimationActive={false} key={k} dataKey={k} name={NHAN[k]} stackId="g" fill={MAU[k]}
                    radius={i === THU_TU.length - 1 ? [5, 5, 0, 0] : 0}>
                    {i === THU_TU.length - 1 && (
                      <LabelList dataKey="tong" position="top" style={{ fontSize: 11, fontWeight: 700 }} />
                    )}
                  </Bar>
                ))}
              </BarChart>
            </Khung>
          </div>
          <Khung tieuDe="Phân loại theo mức ưu tiên" phu="Số nhiệm vụ" cao={280}>
            <PieChart>
              <Pie isAnimationActive={false} data={uuTien} dataKey="tong" nameKey="label" innerRadius="48%" outerRadius="68%"
                paddingAngle={2} label={({ value, percent }) => `${value} (${Math.round(percent * 100)}%)`} labelLine={false}>
                {uuTien.map((x) => <Cell key={x.muc} fill={MAU_UU_TIEN[x.muc]} />)}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v, n, o) => [`${v} việc · quá hạn ${o?.payload?.qua_han || 0}`, n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </Khung>
        </div>
      )}

      {!!d.tong && (
        <Khung tieuDe="Phân bố theo khoảng tiến độ" phu="Toàn bộ nhiệm vụ đang theo dõi" cao={250}>
          <BarChart data={khoang} margin={{ top: 18, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F6" />
            <XAxis dataKey="ten" tick={{ fontSize: 11.5 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip {...tooltipStyle} />
            <Bar isAnimationActive={false} dataKey="so" name="Số nhiệm vụ" radius={[5, 5, 0, 0]}>
              {khoang.map((x) => <Cell key={x.ten} fill={MAU_KHOANG[x.ten] || "#0E6CD6"} />)}
              <LabelList dataKey="so" position="top" style={{ fontSize: 11, fontWeight: 700 }} />
            </Bar>
          </BarChart>
        </Khung>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {!!d.tong && !!nguoi.length && (
          <Khung tieuDe={d.toan_phong ? "Công việc theo nhân viên" : "Công việc của tôi"}
            phu={(d.nguoi || []).length > 15 ? "15 người nhiều việc nhất — bấm để xem" : "Bấm tên để xem danh sách"}
            cao={Math.max(220, 44 + nguoi.length * 30)}>
              <BarChart data={nguoi} layout="vertical" margin={{ top: 4, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF1F6" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="ten" width={130} tick={{ fontSize: 11.5 }} tickFormatter={(v) => rutGon(v, 20)} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar isAnimationActive={false} dataKey="qua_han" name="Quá hạn" stackId="n" fill={MAU.overdue} cursor="pointer" onClick={(e) => onXemViec?.(e?.ten)} />
                <Bar isAnimationActive={false} dataKey="dang_mo" name="Đang mở (trong hạn)" stackId="n" fill={MAU.doing} cursor="pointer" onClick={(e) => onXemViec?.(e?.ten)} />
                <Bar isAnimationActive={false} dataKey="xong" name="Hoàn thành" stackId="n" fill={MAU.done} radius={[0, 5, 5, 0]} cursor="pointer" onClick={(e) => onXemViec?.(e?.ten)}>
                  <LabelList dataKey="tong" position="right" style={{ fontSize: 11, fontWeight: 700 }} />
                </Bar>
              </BarChart>
          </Khung>
        )}
        {!!d.tong && (
          <Khung tieuDe="Giao mới và hoàn thành theo tuần" phu={`${tuan} tuần gần nhất (tuần bắt đầu thứ Hai)`}>
              <ComposedChart data={d.xu_huong} margin={{ top: 16, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F6" />
                <XAxis dataKey="nhan" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip {...tooltipStyle} labelFormatter={(v) => `Tuần từ ${v}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar isAnimationActive={false} dataKey="giao" name="Giao mới" fill="#5B8DEF" radius={[5, 5, 0, 0]} />
                <Line isAnimationActive={false} dataKey="xong" name="Hoàn thành" stroke={MAU.done} strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
          </Khung>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {!!conMo && (
          <Khung tieuDe="Việc đang mở theo hạn xử lý" phu={`${conMo} việc chưa hoàn thành`} cao={250}>
              <BarChart data={han} margin={{ top: 18, right: 10, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F6" />
                <XAxis dataKey="ten" tick={{ fontSize: 11.5 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Bar isAnimationActive={false} dataKey="so" name="Số việc" radius={[5, 5, 0, 0]}>
                  {han.map((x) => <Cell key={x.ten} fill={x.mau} />)}
                  <LabelList dataKey="so" position="top" style={{ fontSize: 11, fontWeight: 700 }} />
                </Bar>
              </BarChart>
          </Khung>
        )}
      </div>

      {!!tienDo.length && (
        <Khung tieuDe="Khối lượng theo đầu việc"
          phu={`${kyTienDo ? `Kỳ ${kyTienDo} — tổng các trung tâm` : ""}${tienDoTatCa.length > tienDo.length
            ? ` · 12/${tienDoTatCa.length} đầu việc kế hoạch lớn nhất` : ""}`}
          cao={Math.max(260, 60 + tienDo.length * 30)}>
            <BarChart data={tienDo} layout="vertical" margin={{ top: 4, right: 56, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF1F6" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="ten" width={210} tick={{ fontSize: 11.5 }} tickFormatter={(v) => rutGon(v, 30)} />
              <Tooltip {...tooltipStyle} formatter={(v, n) => [so(v), n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar isAnimationActive={false} dataKey="ke_hoach" name="Kế hoạch" fill="#5B8DEF" radius={[0, 5, 5, 0]} />
              <Bar isAnimationActive={false} dataKey="thuc_hien" name="Thực hiện" fill={MAU.done} radius={[0, 5, 5, 0]}>
                <LabelList dataKey="ty_le" position="right" style={{ fontSize: 11, fontWeight: 700 }} formatter={pct} />
              </Bar>
            </BarChart>
        </Khung>
      )}

      {!!canhBao.length && (
        <Card title={`Cảnh báo tồn việc — ${canhBao.length} người`} icon={AlertTriangle} pad={false}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Nhân viên</th><th>Tồn</th><th>Quá hạn</th><th>Sắp hạn</th><th>Cảnh báo</th><th style={{ textAlign: "right" }}>Thao tác</th></tr></thead>
              <tbody>
                {canhBao.map((p) => (
                  <tr key={p.name} style={{ background: p.muc === "do" ? "#FDF1F3" : "#FFF8E8" }}>
                    <td><b>{p.name}</b></td>
                    <td style={{ fontWeight: 700 }}>{p.ton}</td>
                    <td style={{ color: p.overdue ? MAU.overdue : undefined, fontWeight: 700 }}>{p.overdue}</td>
                    <td style={{ color: p.sap_han ? MAU.todo : undefined, fontWeight: 700 }}>{p.sap_han}</td>
                    <td style={{ color: p.muc === "do" ? MAU.overdue : "#B7791F", fontSize: 12.5 }}>{p.canh_bao.join(" · ")}</td>
                    <td style={{ textAlign: "right" }}><ThaoTac onView={() => onXemViec?.(p.name)} xemTitle={`Xem việc của ${p.name}`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
