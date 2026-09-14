import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, ListChecks, RefreshCw } from "lucide-react";
import { api } from "./api";
import { Card, Empty, RED } from "./ui";

/*
 * Tổng hợp công việc kỹ thuật theo nhân viên: mỗi người được gắn tên trong
 * việc (phụ trách, phối hợp, báo cáo) đang có bao nhiêu việc, xong bao nhiêu,
 * tồn, quá hạn, sắp đến hạn — và cảnh báo người đang tồn đọng.
 *
 * Người quản lý thấy cả phòng; tài khoản chỉ có quyền xem chỉ thấy dòng của
 * chính mình (máy chủ lọc, xem tasks_by_person).
 */

const pct = (r) => (r == null ? "—" : `${Math.round(r * 100)}%`);
const MAU_MUC = { do: "#C8102E", vang: "#F2A007", xanh: "#16A34A" };
const NEN_MUC = { do: "#FDF1F3", vang: "#FFF8E8", xanh: undefined };

function ThanhHoanThanh({ ty_le }) {
  const r = ty_le || 0;
  const mau = r >= 1 ? "#16A34A" : r >= 0.5 ? "#0E6CD6" : "#F2A007";
  return (
    <div className="flex items-center gap-2" style={{ minWidth: 120 }}>
      <div style={{ flex: 1, height: 7, background: "#EAF1FB", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(r, 1) * 100}%`, height: "100%", background: mau, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 12.5, minWidth: 34, textAlign: "right" }}>{pct(ty_le)}</span>
    </div>
  );
}

function OSo({ nhan, so, mau, goi_y }) {
  return (
    <div className="card" style={{ padding: 12 }} title={goi_y}>
      <p className="muted" style={{ fontSize: 11.5 }}>{nhan}</p>
      <p style={{ fontSize: 22, fontWeight: 800, color: mau || RED, marginTop: 4 }}>{so}</p>
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
  const nguong = data?.nguong || { ton_nhieu: 5, sap_han_ngay: 3 };
  const canhBao = nguoi.filter((p) => p.muc !== "xanh");
  const hien = useMemo(() => {
    const t = tim.trim().toLowerCase();
    return nguoi.filter((p) => (!chiCanhBao || p.muc !== "xanh") && (!t || p.name.toLowerCase().includes(t)));
  }, [nguoi, tim, chiCanhBao]);
  const tong = nguoi.reduce((a, p) => ({
    ton: a.ton + p.ton, overdue: a.overdue + p.overdue, sap_han: a.sap_han + p.sap_han, done: a.done + p.done,
  }), { ton: 0, overdue: 0, sap_han: 0, done: 0 });

  if (err) return <p style={{ color: RED }}>{err}</p>;
  if (!data) return <p className="muted">Đang tải…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <b>{data.toan_phong ? "Công việc theo nhân viên" : "Công việc của tôi"}</b>
          <p className="muted" style={{ fontSize: 12, marginTop: 3 }}>
            Tính mọi việc người đó được gắn tên (phụ trách, phối hợp hoặc báo cáo), mỗi việc một lần.
            Cảnh báo <span style={{ color: MAU_MUC.do, fontWeight: 700 }}>đỏ</span> khi có việc quá hạn,
            <span style={{ color: MAU_MUC.vang, fontWeight: 700 }}> vàng</span> khi tồn từ {nguong.ton_nhieu} việc hoặc có việc còn ≤ {nguong.sap_han_ngay} ngày tới hạn.
          </p>
        </div>
        <button className="btn btn-sm" onClick={load}><RefreshCw size={14} />Tải lại</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <OSo nhan={data.toan_phong ? "Nhân viên đang có việc" : "Số việc của tôi"} so={data.toan_phong ? nguoi.length : (nguoi[0]?.tong || 0)} mau="#0E6CD6" />
        <OSo nhan="Việc tồn (chưa xong)" so={tong.ton} mau="#0E6CD6" goi_y="Cộng theo từng người — một việc nhiều người cùng làm được tính cho mỗi người" />
        <OSo nhan="Quá hạn" so={tong.overdue} mau={tong.overdue ? MAU_MUC.do : MAU_MUC.xanh} />
        <OSo nhan={`Sắp đến hạn (≤ ${nguong.sap_han_ngay} ngày)`} so={tong.sap_han} mau={tong.sap_han ? MAU_MUC.vang : MAU_MUC.xanh} />
        {data.toan_phong
          ? <OSo nhan="Việc chưa giao người phụ trách" so={data.chua_giao || 0} mau={data.chua_giao ? MAU_MUC.vang : MAU_MUC.xanh} />
          : <OSo nhan="Đã hoàn thành" so={tong.done} mau={MAU_MUC.xanh} />}
      </div>

      {!!canhBao.length && (
        <div className="card" style={{ padding: 12, borderLeft: `4px solid ${canhBao.some((p) => p.muc === "do") ? MAU_MUC.do : MAU_MUC.vang}` }}>
          <p className="flex items-center gap-2" style={{ fontWeight: 700, marginBottom: 6 }}>
            <AlertTriangle size={16} color={canhBao.some((p) => p.muc === "do") ? MAU_MUC.do : MAU_MUC.vang} />
            Cảnh báo tồn việc — {canhBao.length} người
          </p>
          {canhBao.map((p) => (
            <div key={p.name} className="flex items-center gap-2" style={{ fontSize: 13, padding: "2px 0", flexWrap: "wrap" }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: MAU_MUC[p.muc], display: "inline-block" }} />
              <b>{p.name}</b><span className="muted">{p.canh_bao.join(" · ")}</span>
              <button className="btn btn-sm" style={{ padding: "2px 8px" }} onClick={() => onXemViec(p.name)}>Xem việc</button>
            </div>
          ))}
        </div>
      )}

      {data.toan_phong && (
        <div className="card flex items-center gap-2" style={{ flexWrap: "wrap" }}>
          <input className="inp" style={{ maxWidth: 260 }} placeholder="🔎 Tìm nhân viên…" value={tim} onChange={(e) => setTim(e.target.value)} />
          <button className={`btn btn-sm ${chiCanhBao ? "btn-red" : ""}`} onClick={() => setChiCanhBao((v) => !v)}>
            <AlertTriangle size={14} />Chỉ người có cảnh báo
          </button>
        </div>
      )}

      <Card pad={false}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Nhân viên</th><th title="Số việc được gắn tên">Tổng</th><th>Phụ trách</th><th>Phối hợp</th>
                <th>Xong</th><th>Đang làm</th><th>Chưa bắt đầu</th><th>Quá hạn</th><th>Sắp hạn</th><th>Tồn</th>
                <th>Hoàn thành</th><th>Cảnh báo</th><th></th>
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
                      <td><b>{p.tong}</b></td>
                      <td>{p.phu_trach}</td>
                      <td>{p.phoi_hop}</td>
                      <td style={{ color: MAU_MUC.xanh, fontWeight: 600 }}>{p.done}</td>
                      <td>{p.doing}</td>
                      <td>{p.todo}</td>
                      <td style={{ color: p.overdue ? MAU_MUC.do : undefined, fontWeight: p.overdue ? 800 : 400 }}>{p.overdue}</td>
                      <td style={{ color: p.sap_han ? MAU_MUC.vang : undefined, fontWeight: p.sap_han ? 700 : 400 }}>{p.sap_han}</td>
                      <td style={{ fontWeight: 700, color: p.ton >= nguong.ton_nhieu ? MAU_MUC.vang : undefined }}>{p.ton}</td>
                      <td><ThanhHoanThanh ty_le={p.ty_le} /></td>
                      <td style={{ fontSize: 12.5, color: MAU_MUC[p.muc] === MAU_MUC.xanh ? undefined : MAU_MUC[p.muc] }}>
                        {p.canh_bao.length ? p.canh_bao.join(" · ") : <span className="muted">—</span>}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-sm" onClick={() => onXemViec(p.name)} title={`Mở danh sách việc của ${p.name}`}>
                          <ListChecks size={13} />Xem việc
                        </button>
                      </td>
                    </tr>
                    {dangMo && (
                      <tr>
                        <td colSpan={13} style={{ background: "#FCFBFB" }}>
                          <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Theo đầu việc</p>
                          <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                            {p.theo_dau_viec.map((d) => (
                              <span key={d.category} className="card" style={{ padding: "6px 10px", fontSize: 12.5 }}>
                                <b>{d.label}</b>: {d.tong} việc · <span style={{ color: MAU_MUC.xanh }}>xong {d.done}</span>
                                {" · "}tồn {d.ton}
                                {!!d.overdue && <span style={{ color: MAU_MUC.do, fontWeight: 700 }}> · quá hạn {d.overdue}</span>}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {!hien.length && (
            <Empty title={nguoi.length ? "Không có ai khớp bộ lọc." : data.toan_phong ? "Chưa có việc nào được gắn người." : "Bạn chưa được gắn tên trong việc nào."}
              hint={data.toan_phong && !nguoi.length ? "Giao việc và chọn Phụ trách / Phối hợp / Người báo cáo ở tab Danh sách công việc." : ""} />
          )}
        </div>
      </Card>
    </div>
  );
}
