import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, RefreshCw, Upload } from "lucide-react";
import { api, coQuyen, useCenters } from "./api";
import { AdminImport } from "./bulkimport";
import { Card, Field, RED, ThaoTac } from "./ui";

/*
 * Số liệu theo cụm (trung tâm) và theo FT của MỘT đầu việc, đặt ngay trong màn
 * hình đầu việc — trước đây chỉ xem được ở tab Tiến độ, phải tự nhớ hạng mục
 * nào thuộc đầu việc nào.
 *
 * Ba mức: chi nhánh (tổng các cụm) -> cụm -> FT trong cụm. Số liệu nhập tay
 * từng dòng hoặc nhập cả tệp Excel (cùng khuôn với tab Tiến độ).
 */

const pct = (kh, th) => (kh > 0 ? `${Math.round((th / kh) * 1000) / 10}%` : "—");
const so = (n) => Number(n || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 });

function ThanhNho({ kh, th }) {
  const that = kh > 0 ? th / kh : 0;        // tỷ lệ thật, có thể vượt 100%
  const r = Math.min(that, 1);              // thanh chỉ vẽ tối đa hết chiều dài
  const mau = that > 1 ? "#0B8A4B" : that >= 1 ? "#16A34A" : that >= 0.5 ? "#0E6CD6" : that > 0 ? "#F2A007" : "#C9D6E8";
  return (
    <span style={{ display: "inline-block", width: 70, height: 7, background: "#EAF1FB", borderRadius: 99, overflow: "hidden" }}>
      <span style={{ display: "block", width: `${r * 100}%`, height: "100%", background: mau }} />
    </span>
  );
}

export function SoLieuCumFT({ category, label }) {
  const [hangMuc, setHangMuc] = useState([]);
  const [item, setItem] = useState("");
  const [periods, setPeriods] = useState([]);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [cums, setCums] = useState([]);
  const [moFt, setMoFt] = useState(null);       // mã cụm đang mở danh sách FT
  const [ftRows, setFtRows] = useState([]);
  const [formCum, setFormCum] = useState(null);
  const [formFt, setFormFt] = useState(null);
  const [nhap, setNhap] = useState(false);
  const [err, setErr] = useState("");
  const { danhSach: dsTrungTam, tenTrungTam } = useCenters();
  const duocThem = coQuyen("tech_tasks", "create");
  const duocSua = coQuyen("tech_tasks", "update");
  const duocXoa = coQuyen("tech_tasks", "delete");

  useEffect(() => {
    api.get(`/api/admin/progress/items?category=${encodeURIComponent(category)}`)
      .then((x) => {
        const ds = Array.isArray(x) ? x : [];
        setHangMuc(ds);
        setItem((cu) => (ds.some((i) => i.id === cu) ? cu : ds[0]?.id || ""));
      }).catch((e) => setErr(e.message));
    api.get("/api/admin/progress/periods").then((x) => {
      const ds = Array.isArray(x) ? x : [];
      setPeriods(ds);
      if (ds.length) setPeriod((cu) => (ds.includes(cu) ? cu : ds[0]));
    }).catch(() => {});
  }, [category]);

  const taiCum = () => {
    if (!item || !period) { setCums([]); return; }
    const p = new URLSearchParams({ category, item, period });
    api.get(`/api/admin/progress/centers?${p}`)
      .then((x) => setCums(Array.isArray(x) ? x : [])).catch((e) => setErr(e.message));
  };
  useEffect(() => { taiCum(); setMoFt(null); }, [category, item, period]);

  const taiFt = (cum = moFt) => {
    if (!cum) return;
    const p = new URLSearchParams({ category, item, period, center: cum });
    api.get(`/api/admin/progress/ft?${p}`)
      .then((x) => setFtRows(Array.isArray(x) ? x : [])).catch((e) => setErr(e.message));
  };

  const moCum = (cum) => {
    const dong = moFt === cum ? null : cum;
    setMoFt(dong); setFormFt(null); setFtRows([]);
    if (dong) taiFt(dong);
  };

  const tong = useMemo(() => cums.reduce((a, c) => ({
    kh: a.kh + (c.plan_qty || 0), th: a.th + (c.done_qty || 0),
  }), { kh: 0, th: 0 }), [cums]);

  /* Đầu việc làm theo cụm thì bày đủ danh mục trung tâm — cụm chưa có số liệu
     vẫn đứng đó để nhập, chứ không biến mất khiến tưởng là không phải làm. */
  const dong = useMemo(() => {
    const co = new Map(cums.map((c) => [c.center, c]));
    const ds = dsTrungTam.map((t) => co.get(t.code) || { center: t.code, trong: true });
    for (const c of cums) if (!dsTrungTam.some((t) => t.code === c.center)) ds.push(c);
    return ds;
  }, [cums, dsTrungTam]);

  /** Biến đầu việc cá nhân thành đầu việc theo cụm: tạo hạng mục cùng tên rồi
   *  bảng 13 trung tâm hiện ra để nhập. */
  const moTheoCum = async () => {
    try {
      const hm = await api.post("/api/admin/progress/items", { category, label });
      setHangMuc([{ id: hm.id || hm.code, label }]);
      setItem(hm.id || hm.code);
      setErr("");
    } catch (e) { setErr(e.message); }
  };

  const luuCum = async () => {
    try {
      if (!formCum.center) throw new Error("Chưa chọn cụm.");
      const body = { category, item, period, center: formCum.center,
                     plan_qty: Number(formCum.plan_qty) || 0, done_qty: Number(formCum.done_qty) || 0,
                     note: formCum.note || "" };
      if (formCum.id) await api.put(`/api/admin/progress/centers/${formCum.id}`, body);
      else await api.post("/api/admin/progress/centers", body);
      setFormCum(null); setErr(""); taiCum();
    } catch (e) { setErr(e.message); }
  };

  const xoaCum = async (c) => {
    if (!window.confirm(`Xóa số liệu cụm “${tenTrungTam(c.center)}” của kỳ ${period}?`)) return;
    try { await api.del(`/api/admin/progress/centers/${c.id}`); taiCum(); } catch (e) { setErr(e.message); }
  };

  const luuFt = async () => {
    try {
      if (!formFt.ft_name.trim()) throw new Error("Chưa nhập tên FT.");
      const body = { category, item, period, center: moFt, ft_name: formFt.ft_name.trim(),
                     plan_qty: Number(formFt.plan_qty) || 0, done_qty: Number(formFt.done_qty) || 0,
                     note: formFt.note || "" };
      if (formFt.id) await api.put(`/api/admin/progress/ft/${formFt.id}`, body);
      else await api.post("/api/admin/progress/ft", body);
      setFormFt(null); setErr(""); taiFt();
    } catch (e) { setErr(e.message); }
  };

  const xoaFt = async (f) => {
    if (!window.confirm(`Xóa dòng FT “${f.ft_name}”?`)) return;
    try { await api.del(`/api/admin/progress/ft/${f.id}`); taiFt(); } catch (e) { setErr(e.message); }
  };

  const ftTong = ftRows.reduce((a, f) => ({ kh: a.kh + (f.plan_qty || 0), th: a.th + (f.done_qty || 0) }), { kh: 0, th: 0 });
  const cumDangMo = cums.find((c) => c.center === moFt);
  const lech = cumDangMo && (ftTong.kh !== (cumDangMo.plan_qty || 0) || ftTong.th !== (cumDangMo.done_qty || 0));

  return (
    <Card title={hangMuc.length ? `Số liệu theo cụm / FT — ${label}` : "Số liệu theo cụm / FT"}
      action={hangMuc.length ? (
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
          <input className="inp" style={{ maxWidth: 120 }} value={period} list="ky-cum"
            onChange={(e) => setPeriod(e.target.value)} placeholder="2026-09" />
          <datalist id="ky-cum">{periods.map((p) => <option key={p} value={p} />)}</datalist>
          <button className="btn btn-sm" onClick={() => { taiCum(); if (moFt) taiFt(); }}><RefreshCw size={13} />Tải lại</button>
          {duocThem && <button className="btn btn-sm" onClick={() => setNhap((v) => !v)}><Upload size={13} />Nhập Excel</button>}
        </div>
      ) : null}>
      {!hangMuc.length ? (
        <p className="muted" style={{ fontSize: 12.5 }}>
          Đầu việc này theo dõi theo nhiệm vụ cá nhân, không chia số liệu theo cụm.
          {duocThem && <> <button className="btn btn-sm" style={{ marginLeft: 6 }} onClick={moTheoCum}>
            <Plus size={13} />Chuyển sang theo dõi theo cụm</button></>}
        </p>
      ) : (
        <>
          {hangMuc.length > 1 && (
            <div className="flex items-center gap-2" style={{ flexWrap: "wrap", marginBottom: 10 }}>
              <span className="muted" style={{ fontSize: 12 }}>Hạng mục:</span>
              {hangMuc.map((h) => (
                <button key={h.id} className={`btn btn-sm ${item === h.id ? "btn-red" : ""}`}
                  onClick={() => setItem(h.id)}>{h.label}</button>
              ))}
            </div>
          )}

          {nhap && (
            <div className="card" style={{ padding: 12, marginBottom: 12 }}>
              <p className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
                Tệp nhập theo khuôn “Tiến độ hạng mục”: đầu việc, hạng mục, kỳ, trung tâm, kế hoạch, thực hiện.
                Dòng trùng (đầu việc, hạng mục, kỳ, trung tâm) được ghi đè.
              </p>
              <AdminImport fixedKind="progress" />
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => { setNhap(false); taiCum(); }}>Đóng</button>
            </div>
          )}

          <div className="card" style={{ padding: 10, marginBottom: 10, background: "#FCFBFB" }}>
            <div className="flex items-center gap-3" style={{ flexWrap: "wrap", fontSize: 13 }}>
              <b>Mức chi nhánh (tổng {cums.length} cụm):</b>
              <span>Kế hoạch <b>{so(tong.kh)}</b></span>
              <span>Thực hiện <b>{so(tong.th)}</b></span>
              <span>Tồn <b>{so(tong.kh - tong.th)}</b></span>
              <ThanhNho kh={tong.kh} th={tong.th} />
              <b>{pct(tong.kh, tong.th)}</b>
            </div>
          </div>

          {formCum && (
            <div className="card" style={{ padding: 12, marginBottom: 12 }}>
              <div className="grid md:grid-cols-4 gap-3">
                <Field label="Cụm / trung tâm">
                  <select className="inp" value={formCum.center} disabled={!!formCum.id}
                    onChange={(e) => setFormCum({ ...formCum, center: e.target.value })}>
                    <option value="">— Chọn cụm —</option>
                    {dsTrungTam.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.short || c.name}</option>)}
                  </select>
                </Field>
                <Field label="Kế hoạch">
                  <input className="inp" type="number" value={formCum.plan_qty}
                    onChange={(e) => setFormCum({ ...formCum, plan_qty: e.target.value })} />
                </Field>
                <Field label="Thực hiện">
                  <input className="inp" type="number" value={formCum.done_qty}
                    onChange={(e) => setFormCum({ ...formCum, done_qty: e.target.value })} />
                </Field>
                <Field label="Ghi chú">
                  <input className="inp" value={formCum.note || ""} onChange={(e) => setFormCum({ ...formCum, note: e.target.value })} />
                </Field>
              </div>
              <div className="flex gap-2" style={{ marginTop: 8 }}>
                <button className="btn btn-red btn-sm" onClick={luuCum}>Lưu</button>
                <button className="btn btn-sm" onClick={() => setFormCum(null)}>Hủy</button>
              </div>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 30 }} /><th>Cụm / trung tâm</th><th>Kế hoạch</th><th>Thực hiện</th>
                  <th>Tồn</th><th>Tỷ lệ</th><th>Ghi chú</th><th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {dong.map((c) => (
                  <React.Fragment key={c.id || c.center}>
                    <tr style={{ cursor: c.trong ? "default" : "pointer" }} onClick={() => !c.trong && moCum(c.center)}>
                      <td>{c.trong ? "" : (moFt === c.center ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}</td>
                      <td><b>{tenTrungTam(c.center)}</b></td>
                      <td>{c.trong ? <span className="muted">—</span> : so(c.plan_qty)}</td>
                      <td>{c.trong ? <span className="muted">—</span> : so(c.done_qty)}</td>
                      <td>{c.trong ? <span className="muted">—</span> : so((c.plan_qty || 0) - (c.done_qty || 0))}</td>
                      <td>{c.trong ? <span className="muted" style={{ fontSize: 12 }}>chưa nhập</span>
                        : <><ThanhNho kh={c.plan_qty} th={c.done_qty} /> {pct(c.plan_qty, c.done_qty)}</>}</td>
                      <td className="muted" style={{ fontSize: 12.5 }}>{c.note || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <ThaoTac onView={c.trong ? null : () => moCum(c.center)} xemTitle="Xem chi tiết theo FT"
                          onEdit={duocSua ? () => setFormCum({ ...c, plan_qty: c.plan_qty ?? "", done_qty: c.done_qty ?? "" }) : null}
                          suaTitle={c.trong ? "Nhập số liệu cho cụm này" : "Sửa số liệu cụm"}
                          onDelete={duocXoa && !c.trong ? () => xoaCum(c) : null} />
                      </td>
                    </tr>
                    {moFt === c.center && (
                      <tr>
                        <td colSpan={8} style={{ background: "#FCFBFB" }}>
                          <div className="flex items-center gap-2" style={{ flexWrap: "wrap", marginBottom: 8 }}>
                            <b style={{ fontSize: 13 }}>FT trong cụm {tenTrungTam(c.center)}</b>
                            <span className={lech ? "tag tag-amber" : "tag tag-grey"}>
                              Tổng FT {so(ftTong.th)}/{so(ftTong.kh)} — cụm {so(c.done_qty)}/{so(c.plan_qty)}
                            </span>
                            {duocThem && (
                              <button className="btn btn-sm" onClick={() => setFormFt({ ft_name: "", plan_qty: "", done_qty: "", note: "" })}>
                                <Plus size={13} />Thêm FT
                              </button>
                            )}
                          </div>
                          {formFt && (
                            <div className="grid md:grid-cols-4 gap-3" style={{ marginBottom: 8 }}>
                              <Field label="Tên FT">
                                <input className="inp" autoFocus value={formFt.ft_name}
                                  onChange={(e) => setFormFt({ ...formFt, ft_name: e.target.value })} />
                              </Field>
                              <Field label="Kế hoạch">
                                <input className="inp" type="number" value={formFt.plan_qty}
                                  onChange={(e) => setFormFt({ ...formFt, plan_qty: e.target.value })} />
                              </Field>
                              <Field label="Thực hiện">
                                <input className="inp" type="number" value={formFt.done_qty}
                                  onChange={(e) => setFormFt({ ...formFt, done_qty: e.target.value })} />
                              </Field>
                              <div className="flex items-end gap-2">
                                <button className="btn btn-red btn-sm" onClick={luuFt}>Lưu</button>
                                <button className="btn btn-sm" onClick={() => setFormFt(null)}>Hủy</button>
                              </div>
                            </div>
                          )}
                          <table className="tbl">
                            <thead><tr><th>FT</th><th>Kế hoạch</th><th>Thực hiện</th><th>Tồn</th><th>Tỷ lệ</th><th style={{ textAlign: "right" }}>Thao tác</th></tr></thead>
                            <tbody>
                              {ftRows.map((f) => (
                                <tr key={f.id}>
                                  <td><b>{f.ft_name}</b>{f.note && <><br /><span className="muted" style={{ fontSize: 12 }}>{f.note}</span></>}</td>
                                  <td>{so(f.plan_qty)}</td>
                                  <td>{so(f.done_qty)}</td>
                                  <td>{so((f.plan_qty || 0) - (f.done_qty || 0))}</td>
                                  <td><ThanhNho kh={f.plan_qty} th={f.done_qty} /> {pct(f.plan_qty, f.done_qty)}</td>
                                  <td style={{ textAlign: "right" }}>
                                    <ThaoTac onEdit={duocSua ? () => setFormFt({ ...f }) : null}
                                      onDelete={duocXoa ? () => xoaFt(f) : null} />
                                  </td>
                                </tr>
                              ))}
                              {!ftRows.length && (
                                <tr><td colSpan={6} className="muted" style={{ fontSize: 12.5 }}>Cụm này chưa chia số liệu theo FT.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {duocThem && (
            <button className="btn btn-sm" style={{ marginTop: 10 }}
              onClick={() => setFormCum({ center: "", plan_qty: "", done_qty: "", note: "" })}>
              <Plus size={13} />Thêm cụm
            </button>
          )}
        </>
      )}
      {err && <p style={{ color: RED, fontSize: 12.5, marginTop: 8 }}>{err}</p>}
    </Card>
  );
}
