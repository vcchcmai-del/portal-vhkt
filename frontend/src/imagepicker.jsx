/**
 * Ô chọn ảnh: cho phép tải lên từ máy tính hoặc dán đường dẫn.
 * Dùng chung cho ảnh đại diện bản tin, ảnh banner và ảnh nhân viên.
 */
import React, { useRef, useState } from "react";
import { Image as ImageIcon, Link2, Loader2, Trash2, Upload, X } from "lucide-react";

import { api } from "./api";
import { RED, RED_DARK } from "./ui";

const boxStyle = {
  border: "1.5px dashed #D9D3D5", borderRadius: 12, padding: 14,
  background: "#FCFBFB", textAlign: "center",
};

/** Chọn MỘT ảnh (ảnh đại diện). */
export function ImagePicker({ value, onChange, label = "Ảnh đại diện", hint }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showUrl, setShowUrl] = useState(false);

  const pick = async (file) => {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const r = await api.uploadFile(file);
      onChange(r.url);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="field">
      <span>{label}</span>

      {value ? (
        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid #E7E3E4" }}>
          <img src={value} alt="Xem trước" style={{ width: "100%", maxHeight: 190, objectFit: "cover", display: "block" }} />
          <button type="button" className="btn btn-sm" onClick={() => onChange("")}
            style={{ position: "absolute", top: 8, right: 8, background: "rgba(255,255,255,.94)" }}>
            <Trash2 size={13} /> Bỏ ảnh
          </button>
        </div>
      ) : (
        <div style={boxStyle}>
          <ImageIcon size={22} style={{ color: "#B9B2B4" }} />
          <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 12px" }}>
            {hint || "Chọn ảnh từ máy tính, hoặc dán đường dẫn ảnh có sẵn."}
          </p>
          <div className="flex gap-2" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-red btn-sm" disabled={busy}
              onClick={() => fileRef.current?.click()}>
              {busy ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
              {busy ? "Đang tải…" : "Chọn ảnh"}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setShowUrl((v) => !v)}>
              <Link2 size={14} /> Dán đường dẫn
            </button>
          </div>
        </div>
      )}

      {showUrl && !value && (
        <input className="inp" style={{ marginTop: 8 }} placeholder="https://..."
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onChange(e.target.value.trim()); } }}
          onBlur={(e) => e.target.value.trim() && onChange(e.target.value.trim())} />
      )}

      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />

      {err && <p style={{ color: RED_DARK, fontSize: 12.5, marginTop: 6 }}>{err}</p>}
    </div>
  );
}

/** Chọn NHIỀU ảnh (ảnh đính kèm trong bài). */
export function GalleryPicker({ value = [], onChange, label = "Ảnh đính kèm trong bài" }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const list = Array.isArray(value) ? value : [];

  const addFiles = async (files) => {
    if (!files?.length) return;
    setBusy(true); setErr("");
    const added = [];
    for (const f of Array.from(files)) {
      try {
        const r = await api.uploadFile(f);
        added.push(r.url);
      } catch (e) { setErr(e.message); }
    }
    if (added.length) onChange([...list, ...added]);
    setBusy(false);
  };

  const move = (i, delta) => {
    const next = [...list];
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="field">
      <span>{label}</span>

      {list.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" style={{ marginBottom: 10 }}>
          {list.map((url, i) => (
            <div key={url + i} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #E7E3E4" }}>
              <img src={url} alt="" style={{ width: "100%", height: 78, objectFit: "cover", display: "block" }} />
              <button type="button" onClick={() => onChange(list.filter((_, k) => k !== i))}
                title="Xoá ảnh này"
                style={{ position: "absolute", top: 3, right: 3, border: 0, borderRadius: 6, cursor: "pointer",
                         background: "rgba(255,255,255,.92)", width: 22, height: 22, display: "grid", placeItems: "center" }}>
                <X size={12} style={{ color: RED }} />
              </button>
              <div style={{ position: "absolute", bottom: 3, left: 3, display: "flex", gap: 2 }}>
                <button type="button" onClick={() => move(i, -1)} title="Chuyển lên trước"
                  style={{ border: 0, borderRadius: 5, cursor: "pointer", background: "rgba(255,255,255,.92)", width: 20, height: 20, fontSize: 11 }}>‹</button>
                <button type="button" onClick={() => move(i, 1)} title="Chuyển ra sau"
                  style={{ border: 0, borderRadius: 5, cursor: "pointer", background: "rgba(255,255,255,.92)", width: 20, height: 20, fontSize: 11 }}>›</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
        {busy ? "Đang tải…" : list.length ? "Thêm ảnh nữa" : "Thêm ảnh đính kèm"}
      </button>
      <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
        Chọn được nhiều ảnh cùng lúc. Tối đa 8 MB mỗi ảnh.
      </span>

      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

      {err && <p style={{ color: RED_DARK, fontSize: 12.5, marginTop: 6 }}>{err}</p>}
    </div>
  );
}
