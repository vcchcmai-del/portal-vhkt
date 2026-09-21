import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Download, ExternalLink, Pencil, Plus, RefreshCw, Sheet, Stethoscope, Timer, Upload } from "lucide-react";
import { api, coQuyen, useCenters } from "./api";
import { AdminImport } from "./bulkimport";
import { Card, Field, RED, ThaoTac, useCuonToi } from "./ui";

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

/** Mã dòng giữ phần kế hoạch chưa chia về cụm — xem chú thích đầu tệp. */
const CHI_NHANH = "CN";
const TEN_CHI_NHANH = "Chưa chia cụm (mức chi nhánh)";

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
  const [sheetUrl, setSheetUrl] = useState("");     // link Google Sheet của đầu việc
  const [sheetLuc, setSheetLuc] = useState(null);   // lần đồng bộ gần nhất
  const [moSheet, setMoSheet] = useState(false);
  const [xemTruoc, setXemTruoc] = useState(null);   // kết quả đọc thử từ sheet
  const [nhieuTab, setNhieuTab] = useState(null);  // kết quả đọc bảng tính nhiều tab
  const [tenTab, setTenTab] = useState("");        // tên tab tự gõ, mỗi tên một dòng
  const [kiemTra, setKiemTra] = useState(null);   // kết quả thử từng cách đọc bảng tính
  const [tuDong, setTuDong] = useState(null);     // {tu_dong, chu_ky_phut, lan_cuoi_tin, lan_cuoi_ok}
  const [dangDoc, setDangDoc] = useState(false);
  const [err, setErr] = useState("");
  const { danhSach: dsTrungTam, tenTrungTam: tenGoc } = useCenters();
  // Mã dành riêng cho phần kế hoạch chưa chia được về cụm nào.
  const tenTrungTam = (ma) => (ma === CHI_NHANH ? TEN_CHI_NHANH : tenGoc(ma));
  const duocThem = coQuyen("tech_tasks", "create");
  // Máy chủ trả sẵn "co_the_sua" cho từng đầu việc: quyền sửa cả module, hoặc
  // là nhân sự chủ trì đầu việc này, hoặc là trưởng nhóm của mảng.
  const [coTheSua, setCoTheSua] = useState(null);
  const duocSua = coTheSua ?? coQuyen("tech_tasks", "update");
  const duocXoa = duocSua || coQuyen("tech_tasks", "delete");
  // Nút xem luôn có (để mở danh sách FT); nút sửa/xóa chờ bật chế độ cập nhật.
  const [cheDoSua, setCheDoSua] = useState(false);
  const mo = (duocSua || duocXoa) && cheDoSua;
  const oNhapCum = useCuonToi(!!formCum);
  const oNhapFt = useCuonToi(!!formFt);

  useEffect(() => {
    api.get(`/api/admin/progress/items?category=${encodeURIComponent(category)}`)
      .then((x) => {
        const ds = Array.isArray(x) ? x : [];
        setHangMuc(ds);
        setItem((cu) => (ds.some((i) => i.id === cu) ? cu : ds[0]?.id || ""));
      }).catch((e) => setErr(e.message));
    api.get("/api/admin/tech-tasks/categories").then((ds) => {
      const c = (Array.isArray(ds) ? ds : []).find((x) => x.id === category);
      setSheetUrl(c?.sheet_url || "");
      setSheetLuc(c?.sheet_synced_at || null);
      setCoTheSua(c ? !!c.co_the_sua : null);
      api.get("/api/admin/tech-tasks/sheet/tu-dong")
        .then((x) => {
          const o = (x?.dau_viec || []).find((y) => y.category === category);
          setTuDong({ chu_ky_phut: x?.chu_ky_phut || 15, ...(o || { tu_dong: false }) });
          if (o?.tab) setTenTab((cu) => cu || o.tab);
        }).catch(() => {});
    }).catch(() => {});
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
    kh: a.kh + (c.plan_qty || 0), th: a.th + (c.done_qty || 0), bkk: a.bkk + (c.bkk_qty || 0),
  }), { kh: 0, th: 0, bkk: 0 }), [cums]);

  /* Đầu việc làm theo cụm thì bày đủ danh mục trung tâm — cụm chưa có số liệu
     vẫn đứng đó để nhập, chứ không biến mất khiến tưởng là không phải làm. */
  const dong = useMemo(() => {
    const co = new Map(cums.map((c) => [c.center, c]));
    const ds = dsTrungTam.map((t) => co.get(t.code) || { center: t.code, trong: true });
    for (const c of cums) if (!dsTrungTam.some((t) => t.code === c.center)) ds.unshift(c);
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
                     bkk_qty: Number(formCum.bkk_qty) || 0, note: formCum.note || "" };
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
                     bkk_qty: Number(formFt.bkk_qty) || 0, note: formFt.note || "" };
      if (formFt.id) await api.put(`/api/admin/progress/ft/${formFt.id}`, body);
      else await api.post("/api/admin/progress/ft", body);
      setFormFt(null); setErr(""); taiFt();
    } catch (e) { setErr(e.message); }
  };

  /** Dòng cụm = tổng các dòng FT, dùng khi hai mức lệch nhau. */
  const dongBoTuFt = async () => {
    if (!cumDangMo) return;
    if (!window.confirm(`Ghi Kế hoạch ${so(ftTong.kh)} / Thực hiện ${so(ftTong.th)} / BKK ${so(ftTong.bkk)}`
                        + ` (tổng theo FT) vào dòng cụm ${tenTrungTam(moFt)}?`)) return;
    try {
      await api.put(`/api/admin/progress/centers/${cumDangMo.id}`,
                    { plan_qty: ftTong.kh, done_qty: ftTong.th, bkk_qty: ftTong.bkk });
      setErr(""); taiCum();
    } catch (e) { setErr(e.message); }
  };

  const xuatCsv = async () => {
    try {
      const p = new URLSearchParams({ period, category, ...(item ? { item } : {}) });
      const { blob, filename } = await api.blob(`/api/admin/progress/export?${p}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename || `so-lieu-${period}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { setErr(e.message); }
  };

  /** Đọc thử Google Sheet: chưa ghi gì, chỉ bày ra để đối chiếu số cũ/số mới. */
  const docSheet = async (ghi = false) => {
    setDangDoc(true);
    try {
      const kq = await api.post(`/api/admin/tech-tasks/categories/${category}/dong-bo-sheet`,
                                { sheet_url: sheetUrl, period, item, ghi,
                                  tab: tenTab.split("\n")[0].trim() });
      setXemTruoc(kq); setErr("");
      if (ghi) { setSheetLuc(new Date().toISOString()); taiCum(); }
    } catch (e) { setErr(e.message); setXemTruoc(null); }
    finally { setDangDoc(false); }
  };

  /** Bảng tính có nhiều tab, mỗi tab mang tên một đầu việc: đồng bộ cả loạt. */
  const docNhieuTab = async (ghi = false) => {
    setDangDoc(true);
    try {
      const kq = await api.post("/api/admin/tech-tasks/dong-bo-sheet-nhieu",
                                { sheet_url: sheetUrl, period, ghi, category,
                                  tabs: tenTab.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean) });
      setNhieuTab(kq); setXemTruoc(null); setErr("");
      if (ghi) taiCum();
    } catch (e) { setErr(e.message); setNhieuTab(null); }
    finally { setDangDoc(false); }
  };

  /** Lưu link + tab, và (tùy chọn) bật tắt đọc tự động — một đường lưu duy nhất. */
  const luuSheet = async (doi = {}) => {
    try {
      const kq = await api.put(`/api/admin/tech-tasks/categories/${category}/sheet`, {
        sheet_url: sheetUrl, tab: tenTab.split("\n")[0].trim(), ...doi,
      });
      setTuDong((cu) => ({ ...(cu || {}), ...kq }));
      setErr("");
      return kq;
    } catch (e) { setErr(e.message); return null; }
  };

  const luuLinkSheet = () => luuSheet();

  /** Thử mọi cách đọc bảng tính rồi kể lại từng cách — để biết vướng ở đâu. */
  const kiemTraSheet = async () => {
    setDangDoc(true);
    try {
      const kq = await api.post("/api/admin/tech-tasks/sheet/kiem-tra",
                                { sheet_url: sheetUrl, tab: tenTab.split("\n")[0].trim() });
      setKiemTra(kq); setErr("");
    } catch (e) { setErr(e.message); setKiemTra(null); }
    finally { setDangDoc(false); }
  };

  const xoaFt = async (f) => {
    if (!window.confirm(`Xóa dòng FT “${f.ft_name}”?`)) return;
    try { await api.del(`/api/admin/progress/ft/${f.id}`); taiFt(); } catch (e) { setErr(e.message); }
  };

  const ftTong = ftRows.reduce((a, f) => ({
    kh: a.kh + (f.plan_qty || 0), th: a.th + (f.done_qty || 0), bkk: a.bkk + (f.bkk_qty || 0),
  }), { kh: 0, th: 0, bkk: 0 });
  const cumDangMo = cums.find((c) => c.center === moFt);
  const cumTrong = !!moFt && !cumDangMo;        // cụm chưa nhập số liệu mức trung tâm
  const lech = cumDangMo && (ftTong.kh !== (cumDangMo.plan_qty || 0) || ftTong.th !== (cumDangMo.done_qty || 0)
                             || ftTong.bkk !== (cumDangMo.bkk_qty || 0));

  return (
    <Card title={hangMuc.length ? `Số liệu theo cụm / FT — ${label}` : "Số liệu theo cụm / FT"}
      action={hangMuc.length ? (
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
          <input className="inp" style={{ maxWidth: 120 }} value={period} list="ky-cum"
            onChange={(e) => setPeriod(e.target.value)} placeholder="2026-09" />
          <datalist id="ky-cum">{periods.map((p) => <option key={p} value={p} />)}</datalist>
          <button className="btn btn-sm" onClick={() => { taiCum(); if (moFt) taiFt(); }}><RefreshCw size={13} />Tải lại</button>
          <button className="btn btn-sm" onClick={xuatCsv}><Download size={13} />Xuất CSV</button>
          {mo && duocThem && <button className="btn btn-sm" onClick={() => setNhap((v) => !v)}><Upload size={13} />Nhập Excel</button>}
          {mo && duocSua && (
            <button className="btn btn-sm" onClick={() => setMoSheet((v) => !v)}>
              <Sheet size={13} />Google Sheet{sheetUrl ? " ✓" : ""}
            </button>
          )}
          {(duocSua || duocXoa) && (
            <button className={`btn btn-sm${mo ? " btn-red" : ""}`}
              title={mo ? "Ẩn các nút sửa, chỉ xem bảng" : "Hiện các nút sửa để nhập số"}
              onClick={() => { setCheDoSua(!cheDoSua); setFormCum(null); setFormFt(null);
                               setNhap(false); setMoSheet(false); }}>
              {mo ? <><Check size={13} />Xong</> : <><Pencil size={13} />Cập nhật số liệu</>}
            </button>
          )}
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

          {moSheet && (
            <div className="card" style={{ padding: 12, marginBottom: 12 }}>
              <p className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
                Dán link Google Sheet của đầu việc này để cập nhật số liệu online. Trên Google Sheet chọn
                <b> Tệp › Chia sẻ › Đăng lên web › CSV</b> rồi dán link vào đây. Cột cần có:
                <b> trung_tam, ke_hoach, thuc_hien</b>, thêm được <b>bkk, ghi_chu</b> và <b>ky, hang_muc</b>.
                Máy chủ đọc sheet mỗi lần bạn bấm đồng bộ, không tự ghi đè.
                Bảng tính phải mở cho người ngoài xem: <b>Chia sẻ › Bất kỳ ai có đường liên kết</b> (vai trò Người xem),
                hoặc <b>Tệp › Chia sẻ › Đăng lên web › CSV</b> — nếu không Google trả lỗi 401 và cổng không đọc được.
                Một bảng tính nhiều tab thì gõ tên các tab vào ô dưới rồi bấm <b>Đọc mọi tab</b>:
                tab nào mang tên một đầu việc sẽ vào đúng đầu việc đó.
              </p>
              <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                <input className="inp" style={{ flex: 1, minWidth: 260 }} value={sheetUrl}
                  placeholder="https://docs.google.com/spreadsheets/…"
                  onChange={(e) => setSheetUrl(e.target.value)} />
                <button className="btn btn-sm" onClick={luuLinkSheet} disabled={!sheetUrl}>Lưu link</button>
                <button className="btn btn-sm" onClick={kiemTraSheet} disabled={!sheetUrl || dangDoc}
                  title="Thử mọi cách đọc bảng tính và cho biết vướng ở đâu">
                  <Stethoscope size={13} />Kiểm tra kết nối
                </button>
                <button className="btn btn-sm" onClick={() => docSheet(false)} disabled={!sheetUrl || dangDoc}>
                  <RefreshCw size={13} />{dangDoc ? "Đang đọc…" : "Đọc thử"}
                </button>
                <button className="btn btn-sm" onClick={() => docNhieuTab(false)} disabled={!sheetUrl || dangDoc}
                  title="Bảng tính có nhiều tab, mỗi tab mang tên một đầu việc">
                  <Sheet size={13} />Đọc mọi tab
                </button>
                {!!sheetUrl && (
                  <a className="btn btn-sm" href={sheetUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={13} />Mở sheet
                  </a>
                )}
              </div>
              <div className="flex items-start gap-2" style={{ flexWrap: "wrap", marginTop: 8 }}>
                <label style={{ flex: 1, minWidth: 260, fontSize: 12.5 }}>
                  Tên tab (mỗi tab một dòng) — để trống thì cổng tự dò danh sách tab
                  <textarea className="inp" rows="2" value={tenTab} placeholder={`${label}\nĐầu việc khác…`}
                    onChange={(e) => setTenTab(e.target.value)} />
                </label>
              </div>

              {/* Công tắc để máy chủ tự đọc lại theo chu kỳ — báo cáo tự cập nhật. */}
              <div className="card flex items-center gap-2"
                style={{ padding: 10, marginTop: 8, flexWrap: "wrap",
                         background: tuDong?.tu_dong ? "#F1FAF3" : "#FCFBFB" }}>
                <button className={`btn btn-sm ${tuDong?.tu_dong ? "btn-red" : ""}`}
                  disabled={!sheetUrl}
                  onClick={() => luuSheet({ tu_dong: !tuDong?.tu_dong })}>
                  <Timer size={13} />{tuDong?.tu_dong ? "Đang tự động đọc — tắt đi" : "Bật tự động đọc"}
                </button>
                <span className="muted" style={{ fontSize: 12.5, flex: 1, minWidth: 220 }}>
                  {tuDong?.tu_dong
                    ? `Máy chủ đọc lại tab “${tenTab.split("\n")[0].trim() || "đầu tiên"}” mỗi ${tuDong?.chu_ky_phut || 15} phút và ghi thẳng vào số liệu cụm.`
                    : `Bật lên thì máy chủ tự đọc mỗi ${tuDong?.chu_ky_phut || 15} phút, khỏi phải vào bấm.`}
                </span>
                {/* Công tắc tổng: tắt cái này thì cả hệ thống ngừng tự đọc, dù
                    từng đầu việc vẫn bật — để còn dừng gấp khi cần. */}
                {duocSua && (
                  <span className="flex items-center gap-2" style={{ width: "100%", fontSize: 12.5,
                                                                     paddingTop: 6, borderTop: "1px solid #EFECED",
                                                                     flexWrap: "wrap" }}>
                    <b>Toàn hệ thống:</b>
                    <button className="btn btn-sm" style={{ padding: "2px 8px" }}
                      onClick={async () => {
                        try {
                          const kq = await api.put("/api/admin/tech-tasks/sheet/cong-tac",
                                                   { bat: !(tuDong?.bat ?? true) });
                          setTuDong((cu) => ({ ...(cu || {}), ...kq })); setErr("");
                        } catch (e) { setErr(e.message); }
                      }}>
                      {(tuDong?.bat ?? true) ? "Đang cho phép tự động — tắt" : "Đang tắt tự động — bật lại"}
                    </button>
                    <span className="muted">Chu kỳ</span>
                    <select className="inp" style={{ maxWidth: 110, padding: "2px 6px" }}
                      value={tuDong?.chu_ky_phut || 15}
                      onChange={async (e) => {
                        try {
                          const kq = await api.put("/api/admin/tech-tasks/sheet/cong-tac",
                                                   { chu_ky_phut: Number(e.target.value) });
                          setTuDong((cu) => ({ ...(cu || {}), ...kq })); setErr("");
                        } catch (er) { setErr(er.message); }
                      }}>
                      {[5, 10, 15, 30, 60, 180, 360, 720, 1440].map((p) => (
                        <option key={p} value={p}>{p < 60 ? `${p} phút` : `${p / 60} giờ`}</option>
                      ))}
                    </select>
                    {!!tuDong?.so_dang_bat && (
                      <span className="muted">{tuDong.so_dang_bat} đầu việc đang bật tự động</span>
                    )}
                  </span>
                )}
                {tuDong?.tu_dong && (
                  <button className="btn btn-sm" disabled={dangDoc}
                    onClick={async () => {
                      setDangDoc(true);
                      try { await api.post("/api/admin/tech-tasks/sheet/doc-ngay", {}); taiCum();
                            const x = await api.get("/api/admin/tech-tasks/sheet/tu-dong");
                            const o = (x?.dau_viec || []).find((y) => y.category === category);
                            setTuDong({ chu_ky_phut: x?.chu_ky_phut || 15, ...(o || {}) }); }
                      catch (e) { setErr(e.message); }
                      finally { setDangDoc(false); }
                    }}>
                    <RefreshCw size={13} />Đọc ngay
                  </button>
                )}
                {!!tuDong?.lan_cuoi_tin && (
                  <span style={{ fontSize: 12.5, width: "100%",
                                 color: tuDong.lan_cuoi_ok ? "#16A34A" : RED }}>
                    Lần tự động gần nhất: {tuDong.lan_cuoi_tin}
                  </span>
                )}
              </div>

              {kiemTra && (
                <div className="card" style={{ padding: 10, marginTop: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{kiemTra.ket_luan}</p>
                  <table className="tbl">
                    <thead><tr><th>Cách đọc</th><th>Kết quả</th></tr></thead>
                    <tbody>
                      {kiemTra.cua.map((c) => (
                        <tr key={c.ten}>
                          <td><b>{c.ten}</b>
                            <div className="muted" style={{ fontSize: 11.5, wordBreak: "break-all" }}>{c.duong_dan}</div>
                          </td>
                          <td style={{ fontSize: 12.5, color: c.duoc ? "#16A34A" : RED }}>
                            {c.duoc ? "Đọc được — " : "Không đọc được — "}{c.chi_tiet}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!!kiemTra.tabs?.length && (
                    <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                      Tab trong bảng tính: {kiemTra.tabs.join(" · ")}
                      {" — "}bấm để điền:{" "}
                      {kiemTra.tabs.map((t) => (
                        <button key={t} className="btn btn-sm" style={{ padding: "1px 7px", margin: 2, fontSize: 11 }}
                          onClick={() => setTenTab(t)}>{t}</button>
                      ))}
                    </p>
                  )}
                  <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => setKiemTra(null)}>Đóng</button>
                </div>
              )}

              {sheetLuc && !!sheetUrl && (
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Đồng bộ gần nhất: {new Date(sheetLuc).toLocaleString("vi-VN")}
                </p>
              )}

              {nhieuTab && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>
                    {nhieuTab.da_ghi ? "Đã ghi" : "Đọc thử"} {nhieuTab.so_tab} tab · kỳ {nhieuTab.ky}
                  </p>
                  <table className="tbl" style={{ marginTop: 6 }}>
                    <thead><tr><th>Tab</th><th>Vào đầu việc</th><th>Số dòng</th><th>Ghi chú</th></tr></thead>
                    <tbody>
                      {nhieuTab.ket_qua.map((k) => (
                        <tr key={k.tab}>
                          <td><b>{k.tab}</b></td><td className="muted">{k.category}</td><td>{k.dong}</td>
                          <td style={{ color: k.loi?.length ? RED : undefined, fontSize: 12.5 }}>
                            {k.loi?.length ? k.loi.slice(0, 3).join("; ") : "—"}
                          </td>
                        </tr>
                      ))}
                      {nhieuTab.bo_qua.map((k) => (
                        <tr key={k.tab}>
                          <td>{k.tab}</td><td className="muted">—</td><td>—</td>
                          <td className="muted" style={{ fontSize: 12.5 }}>
                            bỏ qua: {k.vi_sao}
                            {!k.goi_y?.length && (
                              <div style={{ color: RED }}>
                                Đổi tên tab thành tên đầu việc, hoặc dùng nút <b>Đọc thử</b> để đưa tab này vào “{label}”.
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!nhieuTab.da_ghi && !!nhieuTab.ket_qua.length && (
                    <button className="btn btn-red btn-sm" style={{ marginTop: 8 }}
                      onClick={() => docNhieuTab(true)} disabled={dangDoc}>
                      Ghi {nhieuTab.ket_qua.reduce((a, k) => a + k.dong, 0)} dòng vào {nhieuTab.ket_qua.length} đầu việc
                    </button>
                  )}
                </div>
              )}

              {xemTruoc && (
                <div style={{ marginTop: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>
                    {xemTruoc.da_ghi ? "Đã ghi" : "Đọc thử"}: {xemTruoc.nhan_duoc}/{xemTruoc.tong_dong} dòng nhận được,
                    {" "}{xemTruoc.thay_doi} dòng khác số đang có · kỳ {xemTruoc.ky}
                  </p>
                  {!!xemTruoc.loi?.length && (
                    <ul style={{ color: RED, fontSize: 12.5, margin: "6px 0 0 16px" }}>
                      {xemTruoc.loi.slice(0, 8).map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  )}
                  <div style={{ overflowX: "auto", marginTop: 8, maxHeight: 260 }}>
                    <table className="tbl">
                      <thead><tr><th>Cụm</th><th>Kế hoạch</th><th>Thực hiện</th><th>BKK</th><th>Đang có trên cổng</th></tr></thead>
                      <tbody>
                        {xemTruoc.dong.filter((d) => d.doi).slice(0, 50).map((d, i) => (
                          <tr key={i}>
                            <td><b>{tenTrungTam(d.center)}</b></td>
                            <td>{so(d.plan_qty)}</td><td>{so(d.done_qty)}</td><td>{so(d.bkk_qty)}</td>
                            <td className="muted" style={{ fontSize: 12.5 }}>
                              {d.cu ? `${so(d.cu.plan_qty)} / ${so(d.cu.done_qty)} / ${so(d.cu.bkk_qty)}` : "chưa có dòng này"}
                            </td>
                          </tr>
                        ))}
                        {!xemTruoc.dong.some((d) => d.doi) && (
                          <tr><td colSpan={5} className="muted" style={{ fontSize: 12.5 }}>
                            Số trên sheet trùng khớp số đang có, không cần ghi lại.
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {!xemTruoc.da_ghi && !!xemTruoc.thay_doi && (
                    <button className="btn btn-red btn-sm" style={{ marginTop: 8 }}
                      onClick={() => docSheet(true)} disabled={dangDoc}>
                      Ghi {xemTruoc.thay_doi} dòng vào kỳ {xemTruoc.ky}
                    </button>
                  )}
                </div>
              )}
              <button className="btn btn-sm" style={{ marginTop: 8 }}
                onClick={() => { setMoSheet(false); setXemTruoc(null); setNhieuTab(null); }}>Đóng</button>
            </div>
          )}

          {nhap && (
            <div className="card" style={{ padding: 12, marginBottom: 12 }}>
              <p className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
                Tệp nhập theo khuôn “Tiến độ hạng mục”: đầu việc, hạng mục, kỳ, trung tâm, kế hoạch, thực hiện, BKK.
                Nút “Tải số liệu đang có” chỉ lấy số liệu của đầu việc này, kỳ {period}.
                Dòng trùng (đầu việc, hạng mục, kỳ, trung tâm) được ghi đè.
              </p>
              <AdminImport fixedKind="progress" period={period} category={category} />
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => { setNhap(false); taiCum(); }}>Đóng</button>
            </div>
          )}

          <div className="card" style={{ padding: 10, marginBottom: 10, background: "#FCFBFB" }}>
            <div className="flex items-center gap-3" style={{ flexWrap: "wrap", fontSize: 13 }}>
              <b>Mức chi nhánh (tổng {cums.filter((c) => c.center !== CHI_NHANH).length} cụm
                {cums.some((c) => c.center === CHI_NHANH) ? " + phần chưa chia" : ""}):</b>
              <span>Kế hoạch <b>{so(tong.kh)}</b></span>
              <span>Thực hiện <b>{so(tong.th)}</b></span>
              <span>Tồn <b>{so(Math.max(tong.kh - tong.bkk - tong.th, 0))}</b></span>
              <span>BKK <b>{so(tong.bkk)}</b></span>
              <ThanhNho kh={tong.kh - tong.bkk} th={tong.th} />
              <b>{pct(tong.kh - tong.bkk, tong.th)}</b>
            </div>
          </div>

          {formCum && (
            <div ref={oNhapCum} className="card" style={{ padding: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                {formCum.id ? `Sửa số liệu cụm ${tenTrungTam(formCum.center)}`
                  : formCum.center ? `Nhập số liệu cho cụm ${tenTrungTam(formCum.center)}`
                    : "Thêm số liệu cho một cụm"}
                <span className="muted" style={{ fontWeight: 400 }}> · kỳ {period}</span>
              </p>
              <div className="grid md:grid-cols-5 gap-3">
                <Field label="Cụm / trung tâm">
                  <select className="inp" value={formCum.center} disabled={!!formCum.id}
                    onChange={(e) => setFormCum({ ...formCum, center: e.target.value })}>
                    <option value="">— Chọn cụm —</option>
                    <option value={CHI_NHANH}>{TEN_CHI_NHANH}</option>
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
                <Field label="BKK (bất khả kháng)">
                  <input className="inp" type="number" value={formCum.bkk_qty ?? ""}
                    onChange={(e) => setFormCum({ ...formCum, bkk_qty: e.target.value })} />
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
                  <th>Tồn</th><th title="Bất khả kháng">BKK</th><th>Tỷ lệ</th><th>Ghi chú</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {dong.map((c) => (
                  <React.Fragment key={c.id || c.center}>
                    <tr style={{ cursor: "pointer" }} onClick={() => moCum(c.center)}>
                      <td>{moFt === c.center ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                      <td><b>{tenTrungTam(c.center)}</b></td>
                      <td>{c.trong ? <span className="muted">—</span> : so(c.plan_qty)}</td>
                      <td>{c.trong ? <span className="muted">—</span> : so(c.done_qty)}</td>
                      <td>{c.trong ? <span className="muted">—</span>
                        : so(Math.max((c.plan_qty || 0) - (c.bkk_qty || 0) - (c.done_qty || 0), 0))}</td>
                      <td>{c.trong ? <span className="muted">—</span> : so(c.bkk_qty)}</td>
                      <td>{c.trong ? <span className="muted" style={{ fontSize: 12 }}>chưa nhập</span>
                        : <><ThanhNho kh={(c.plan_qty || 0) - (c.bkk_qty || 0)} th={c.done_qty} />{" "}
                          {pct((c.plan_qty || 0) - (c.bkk_qty || 0), c.done_qty)}</>}</td>
                      <td className="muted" style={{ fontSize: 12.5 }}>{c.note || "—"}</td>
                      <td style={{ textAlign: "right" }}>
                        <ThaoTac onView={() => moCum(c.center)}
                          xemTitle={c.trong ? "Xem / thêm FT cho cụm này" : "Xem chi tiết theo FT"}
                          onEdit={mo && duocSua ? () => setFormCum({ ...c, plan_qty: c.plan_qty ?? "",
                            done_qty: c.done_qty ?? "", bkk_qty: c.bkk_qty ?? "" }) : null}
                          suaTitle={c.trong ? "Nhập số liệu cho cụm này" : "Sửa số liệu cụm"}
                          onDelete={mo && duocXoa ? () => (c.trong
                            ? setErr(`Cụm ${tenTrungTam(c.center)} chưa có số liệu nào để xóa.`)
                            : xoaCum(c)) : null}
                          xoaTitle={c.trong ? "Chưa có số liệu để xóa" : "Xóa số liệu cụm"} />
                      </td>
                    </tr>
                    {moFt === c.center && (
                      <tr>
                        <td colSpan={9} style={{ background: "#FCFBFB" }}>
                          <div className="flex items-center gap-2" style={{ flexWrap: "wrap", marginBottom: 8 }}>
                            <b style={{ fontSize: 13 }}>FT trong cụm {tenTrungTam(c.center)}</b>
                            <span className={lech ? "tag tag-amber" : "tag tag-grey"}>
                              Tổng FT {so(ftTong.th)}/{so(ftTong.kh)} — cụm {so(c.done_qty)}/{so(c.plan_qty)}
                              {!!(ftTong.bkk || c.bkk_qty) && ` · BKK ${so(ftTong.bkk)}/${so(c.bkk_qty)}`}
                            </span>
                            {mo && duocThem && (
                              <button className="btn btn-sm" onClick={() => setFormFt({ ft_name: "", plan_qty: "", done_qty: "", bkk_qty: "", note: "" })}>
                                <Plus size={13} />Thêm FT
                              </button>
                            )}
                            {duocSua && lech && !cumTrong && !!ftRows.length && (
                              <button className="btn btn-sm" onClick={dongBoTuFt} title="Ghi tổng các dòng FT vào dòng cụm">
                                <RefreshCw size={13} />Lấy tổng FT làm số cụm
                              </button>
                            )}
                          </div>
                          {formFt && (
                            <div ref={oNhapFt} className="grid md:grid-cols-5 gap-3" style={{ marginBottom: 8 }}>
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
                              <Field label="BKK (bất khả kháng)">
                                <input className="inp" type="number" value={formFt.bkk_qty ?? ""}
                                  onChange={(e) => setFormFt({ ...formFt, bkk_qty: e.target.value })} />
                              </Field>
                              <Field label="Ghi chú">
                                <input className="inp" value={formFt.note || ""}
                                  onChange={(e) => setFormFt({ ...formFt, note: e.target.value })} />
                              </Field>
                              <div className="flex items-end gap-2 md:col-span-5">
                                <button className="btn btn-red btn-sm" onClick={luuFt}>Lưu</button>
                                <button className="btn btn-sm" onClick={() => setFormFt(null)}>Hủy</button>
                              </div>
                            </div>
                          )}
                          <table className="tbl">
                            <thead>
                              <tr><th>FT</th><th>Kế hoạch</th><th>Thực hiện</th><th>Tồn</th>
                                <th title="Bất khả kháng">BKK</th><th>Tỷ lệ</th>
                                <th style={{ textAlign: "right" }}>Thao tác</th></tr>
                            </thead>
                            <tbody>
                              {ftRows.map((f) => (
                                <tr key={f.id}>
                                  <td><b>{f.ft_name}</b>{f.note && <><br /><span className="muted" style={{ fontSize: 12 }}>{f.note}</span></>}</td>
                                  <td>{so(f.plan_qty)}</td>
                                  <td>{so(f.done_qty)}</td>
                                  <td>{so(Math.max((f.plan_qty || 0) - (f.bkk_qty || 0) - (f.done_qty || 0), 0))}</td>
                                  <td>{so(f.bkk_qty)}</td>
                                  <td><ThanhNho kh={(f.plan_qty || 0) - (f.bkk_qty || 0)} th={f.done_qty} />{" "}
                                    {pct((f.plan_qty || 0) - (f.bkk_qty || 0), f.done_qty)}</td>
                                  <td style={{ textAlign: "right" }}>
                                    <ThaoTac onEdit={mo && duocSua ? () => setFormFt({ ...f }) : null}
                                      onDelete={mo && duocXoa ? () => xoaFt(f) : null} />
                                  </td>
                                </tr>
                              ))}
                              {!ftRows.length && (
                                <tr><td colSpan={7} className="muted" style={{ fontSize: 12.5 }}>Cụm này chưa chia số liệu theo FT.</td></tr>
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

          {cums.some((c) => c.center === CHI_NHANH) && (
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              Dòng <b>{TEN_CHI_NHANH}</b> giữ phần kế hoạch bảng giấy chỉ cho tổng toàn HCM,
              chưa chia về cụm nào. Trung tâm nhận phần của mình thì chuyển bớt số từ dòng này
              sang cụm đó — tổng chi nhánh không đổi.
            </p>
          )}

          {mo && duocThem && (
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
