import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { api } from "./api";
import { Card, Empty, RED, ThaoTac } from "./ui";

/*
 * Tổng hợp công việc kỹ thuật theo nhân viên — đọc bằng số liệu khối lượng chứ
 * không phải đếm đầu việc: Kế hoạch, Thực hiện, Tỷ lệ hoàn thành, Tồn, BKK,
 * Tồn quá hạn.
 *
 * Khối lượng của một người gồm: đầu việc người đó đứng chủ trì (cộng từ số liệu
 * các cụm, kỳ gần nhất) và nhiệm vụ người đó phụ trách chính. Việc chỉ phối hợp
 * không cộng khối lượng để không đếm trùng cả phòng.
 *
 * BKK (bất khả kháng) là phần không làm được vì lý do khách quan: trừ khỏi kế
 * hoạch khi tính tỷ lệ, và không nằm trong tồn.
 *
 * Người quản lý thấy cả phòng; tài khoản chỉ có quyền xem chỉ thấy dòng của
 * chính mình (máy chủ lọc, xem tasks_by_person).
 */

const pct = (r) => (r == null ? "—" : `${Math.round(r * 1000) / 10}%`);
const so = (n) => (n ? Number(n).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) : "—");
const MAU_MUC = { do: "#C8102E", vang: "#F2A007", xanh: "#16A34A" };

/** "2 ngày trước · Lê Hoàng Ân" — số liệu còn tươi hay đã cũ. */
function motaCapNhat(ngay, ai) {
  if (ngay == null) return "chưa cập nhật";
  const khi = ngay === 0 ? "hôm nay" : ngay === 1 ? "hôm qua" : `${ngay} ngày trước`;
  return ai ? `${khi} · ${ai}` : khi;
}
const NEN_MUC = { do: "#FDF1F3", vang: "#FFF8E8", xanh: undefined };

function ThanhHoanThanh({ ty_le }) {
  const that = ty_le || 0;
  const r = Math.min(that, 1);
  const mau = that > 1 ? "#0B8A4B" : that >= 1 ? "#16A34A" : that >= 0.5 ? "#0E6CD6" : "#F2A007";
  return (
    <div className="flex items-center gap-2" style={{ minWidth: 120 }}>
      <div style={{ flex: 1, height: 7, background: "#EAF1FB", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${r * 100}%`, height: "100%", background: mau, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 12.5, minWidth: 40, textAlign: "right" }}>{pct(ty_le)}</span>
    </div>
  );
}

function OSo({ nhan, so: giaTri, mau, goi_y }) {
  return (
    <div className="card" style={{ padding: 12 }} title={goi_y}>
      <p className="muted" style={{ fontSize: 11.5 }}>{nhan}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: mau || RED, marginTop: 4 }}>{giaTri}</p>
    </div>
  );
}

export function TheoNhanVienTab({ onXemViec }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [tim, setTim] = useState("");
  const [chiCanhBao, setChiCanhBao] = useState(false);
  const [mo, setMo] = useState(null);   // tên người đang mở chi tiết

  const load = () => api.get("/api/admin/tech-tasks/by-person")
    .then((x) => { setData(x); setErr(""); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const nguoi = data?.nguoi || [];
  const nguong = data?.nguong || { im_lang_ngay: 7 };
  const canhBao = nguoi.filter((p) => p.muc !== "xanh");
  const hien = useMemo(() => {
    const t = tim.trim().toLowerCase();
    return nguoi.filter((p) => (!chiCanhBao || p.muc !== "xanh") && (!t || p.name.toLowerCase().includes(t)));
  }, [nguoi, tim, chiCanhBao]);

  const tong = nguoi.reduce((a, p) => ({
    ke_hoach: a.ke_hoach + p.ke_hoach, thuc_hien: a.thuc_hien + p.thuc_hien, bkk: a.bkk + p.bkk,
    ton: a.ton + p.ton, ton_qua_han: a.ton_qua_han + p.ton_qua_han,
  }), { ke_hoach: 0, thuc_hien: 0, bkk: 0, ton: 0, ton_qua_han: 0 });
  const tyLeChung = tong.ke_hoach - tong.bkk > 0 ? tong.thuc_hien / (tong.ke_hoach - tong.bkk) : null;

  if (err) return <p style={{ color: RED }}>{err}</p>;
  if (!data) return <p className="muted">Đang tải…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <b>{data.toan_phong ? "Khối lượng theo nhân viên" : "Khối lượng của tôi"}</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>
            Cộng khối lượng của đầu việc người đó chủ trì (số liệu theo cụm) và nhiệm vụ người đó phụ trách chính.
            BKK là phần không làm được do khách quan — trừ khỏi kế hoạch khi tính tỷ lệ và không tính vào tồn.
            Tồn quá hạn là tồn của việc đã quá hạn hoặc của kỳ đã kết thúc.
            Đầu việc còn tồn mà quá {nguong.im_lang_ngay} ngày không ai cập nhật số liệu thì bị nêu ở cột Ghi chú.
          </p>
        </div>
        <button className="btn btn-sm" onClick={load}><RefreshCw size={14} />Tải lại</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <OSo nhan={data.toan_phong ? "Nhân viên đang có việc" : "Đầu việc của tôi"}
          so={data.toan_phong ? nguoi.length : (nguoi[0]?.dau_viec || 0)} mau="#0E6CD6" />
        <OSo nhan="Kế hoạch" so={so(tong.ke_hoach)} mau="#0E6CD6" goi_y="Tổng khối lượng được giao" />
        <OSo nhan="Thực hiện" so={so(tong.thuc_hien)} mau={MAU_MUC.xanh} />
        <OSo nhan="Tỷ lệ hoàn thành" so={pct(tyLeChung)} mau={(tyLeChung || 0) >= 1 ? MAU_MUC.xanh : "#0E6CD6"} />
        <OSo nhan="Tồn" so={so(tong.ton)} mau={tong.ton ? MAU_MUC.vang : MAU_MUC.xanh}
          goi_y="Kế hoạch − BKK − Thực hiện" />
        <OSo nhan="Tồn quá hạn" so={so(tong.ton_qua_han)} mau={tong.ton_qua_han ? MAU_MUC.do : MAU_MUC.xanh} />
      </div>

      {data.toan_phong && (
        <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
          <input className="inp" style={{ maxWidth: 260 }} placeholder="🔎 Tìm nhân viên…" value={tim} onChange={(e) => setTim(e.target.value)} />
          <button className={`btn btn-sm ${chiCanhBao ? "btn-red" : ""}`} onClick={() => setChiCanhBao((v) => !v)}>
            <AlertTriangle size={14} />Chỉ người còn tồn
          </button>
          {/* Nói một lần ở đây; ai còn tồn thì dòng của họ trong bảng dưới đã
              tô vàng và ghi rõ tồn bao nhiêu, khỏi liệt kê lại lần nữa. */}
          {!!canhBao.length && (
            <span style={{ fontSize: 12.5, color: canhBao.some((p) => p.muc === "do") ? MAU_MUC.do : MAU_MUC.vang,
                           fontWeight: 700 }}>
              {canhBao.length} người còn tồn khối lượng
              {(() => { const n = canhBao.filter((p) => p.ton_qua_han).length;
                        return n ? `, ${n} người có tồn quá hạn` : ""; })()}
            </span>
          )}
        </div>
      )}

      <Card pad={false}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th title="Số đầu việc người này đứng chủ trì">Đầu việc</th>
                <th>Kế hoạch</th><th>Thực hiện</th><th>Tỷ lệ hoàn thành</th>
                <th title="Kế hoạch − BKK − Thực hiện">Tồn</th>
                <th title="Bất khả kháng — phần không làm được do nguyên nhân khách quan">BKK</th>
                <th>Tồn quá hạn</th><th>Cập nhật gần nhất</th><th>Ghi chú</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {hien.map((p) => {
                const dangMo = mo === p.name;
                return (
                  <React.Fragment key={p.name}>
                    <tr style={{ cursor: "pointer", background: NEN_MUC[p.muc] }} onClick={() => setMo(dangMo ? null : p.name)}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span className="flex items-center gap-1">
                          {dangMo ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <span style={{ width: 8, height: 8, borderRadius: 99, background: MAU_MUC[p.muc], display: "inline-block" }} />
                          <b>{p.name}</b>
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>{p.dau_viec || <span className="muted">—</span>}</td>
                      <td><b>{so(p.ke_hoach)}</b></td>
                      <td style={{ color: MAU_MUC.xanh, fontWeight: 600 }}>{so(p.thuc_hien)}</td>
                      <td><ThanhHoanThanh ty_le={p.ty_le} /></td>
                      <td style={{ fontWeight: 700, color: p.ton ? MAU_MUC.vang : undefined }}>{so(p.ton)}</td>
                      <td>{so(p.bkk)}</td>
                      <td style={{ color: p.ton_qua_han ? MAU_MUC.do : undefined, fontWeight: p.ton_qua_han ? 800 : 400 }}>
                        {so(p.ton_qua_han)}
                      </td>
                      <td style={{ fontSize: 12.5, whiteSpace: "nowrap",
                                   color: (p.im_lang_ngay ?? 99) >= (nguong.im_lang_ngay || 7) ? MAU_MUC.do : undefined }}>
                        {motaCapNhat(p.im_lang_ngay)}
                      </td>
                      <td style={{ fontSize: 12.5, maxWidth: 240 }}>
                        {p.ghi_chu?.length ? p.ghi_chu.join(" · ") : <span className="muted">—</span>}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <ThaoTac onView={() => onXemViec(p.name)} xemTitle={`Xem đầu việc của ${p.name}`} />
                      </td>
                    </tr>
                    {dangMo && (
                      <tr>
                        <td colSpan={11} style={{ background: "#FCFBFB" }}>
                          {!!p.chu_tri?.length && (
                            <>
                              <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Đầu việc đứng chủ trì</p>
                              <table className="tbl" style={{ marginBottom: 10 }}>
                                <thead>
                                  <tr><th>Đầu việc</th><th>Kỳ</th><th>Kế hoạch</th><th>Thực hiện</th>
                                    <th>Tồn</th><th>BKK</th><th>Tồn quá hạn</th><th>Cập nhật gần nhất</th></tr>
                                </thead>
                                <tbody>
                                  {p.chu_tri.map((d) => (
                                    <tr key={d.category}>
                                      <td><b>{d.label}</b></td>
                                      <td className="muted">{d.kl_period || "—"}</td>
                                      <td>{so(d.kl_plan)}</td>
                                      <td>{so(d.kl_done)}</td>
                                      <td style={{ fontWeight: 600 }}>{so(d.ton)}</td>
                                      <td>{so(d.kl_bkk)}</td>
                                      <td style={{ color: d.ton_qua_han ? MAU_MUC.do : undefined }}>{so(d.ton_qua_han)}</td>
                                      <td style={{ fontSize: 12.5,
                                                   color: (d.im_lang_ngay ?? 99) >= (nguong.im_lang_ngay || 7) ? MAU_MUC.do : undefined }}>
                                        {motaCapNhat(d.im_lang_ngay, d.updated_by)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </>
                          )}
                          {!!p.theo_dau_viec.length && (
                            <>
                              <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Khối lượng theo đầu việc</p>
                              <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                                {p.theo_dau_viec.map((d) => (
                                  <span key={d.category} className="card" style={{ padding: "6px 10px", fontSize: 12.5 }}>
                                    <b>{d.label}</b>: {so(d.thuc_hien)}/{so(d.ke_hoach)}
                                    {!!d.ton && <> · tồn {so(d.ton)}</>}
                                    {!!d.bkk && <> · BKK {so(d.bkk)}</>}
                                    {!!d.ton_qua_han && <span style={{ color: MAU_MUC.do, fontWeight: 700 }}> · quá hạn {so(d.ton_qua_han)}</span>}
                                  </span>
                                ))}
                              </div>
                            </>
                          )}
                          {!p.chu_tri?.length && !p.theo_dau_viec.length && (
                            <p className="muted" style={{ fontSize: 12.5 }}>Người này chưa chủ trì đầu việc nào và chưa có khối lượng được giao.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {!hien.length && (
            <Empty title={nguoi.length ? "Không có ai khớp bộ lọc." : data.toan_phong ? "Chưa có ai được giao đầu việc hay nhiệm vụ." : "Bạn chưa được gắn tên trong việc nào."}
              hint={data.toan_phong && !nguoi.length ? "Đặt nhân sự chủ trì ở “Cơ cấu đầu việc”, hoặc giao nhiệm vụ có khối lượng ở tab Danh sách công việc." : ""} />
          )}
        </div>
      </Card>
    </div>
  );
}
