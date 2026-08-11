/**
 * Kiểm duyệt Trao đổi nội bộ — chỉ quản trị viên vào được.
 * Bài đăng và trả lời mới đều ở trạng thái "Chờ duyệt", chỉ hiện công khai
 * sau khi quản trị viên bấm Duyệt ở đây.
 */
import React, { useEffect, useState } from "react";
import { CheckCircle2, Edit3, MessageSquare, Trash2 } from "lucide-react";
import { api } from "./api";
import { Card, Empty, Field, RED } from "./ui";

const STATUS_LABEL = { pending: "Chờ duyệt", approved: "Đã duyệt" };
const STATUS_TAG = { pending: "tag-amber", approved: "tag-green" };

function StatusFilter({ value, onChange }) {
  return (
    <select className="inp" style={{ maxWidth: 170 }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="pending">Chờ duyệt</option>
      <option value="approved">Đã duyệt</option>
      <option value="">Tất cả</option>
    </select>
  );
}

function ThreadsPanel() {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(null);

  const load = () => {
    const q = status ? `?status=${status}` : "";
    api.get(`/api/admin/forum/threads${q}`).then((x) => setRows(Array.isArray(x) ? x : [])).catch((e) => setErr(e.message));
  };
  useEffect(load, [status]);

  const approve = async (t) => {
    try { await api.put(`/api/admin/forum/threads/${t.id}`, { status: "approved" }); load(); }
    catch (e) { setErr(e.message); }
  };
  const del = async (t) => {
    if (!window.confirm(`Xóa chủ đề "${t.title}" và toàn bộ trả lời bên trong?`)) return;
    try { await api.del(`/api/admin/forum/threads/${t.id}`); load(); }
    catch (e) { setErr(e.message); }
  };
  const save = async () => {
    try {
      await api.put(`/api/admin/forum/threads/${edit.id}`, { title: edit.title, tag: edit.tag });
      setEdit(null); load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <Card title="Chủ đề thảo luận" icon={MessageSquare} action={<StatusFilter value={status} onChange={setStatus} />}>
      {err && <p style={{ color: RED, fontSize: 13, marginBottom: 10 }}>{err}</p>}
      {edit && (
        <div style={{ border: "1px solid #E7E3E4", borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <Field label="Tiêu đề">
            <input className="inp" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          </Field>
          <Field label="Nhãn">
            <input className="inp" value={edit.tag || ""} onChange={(e) => setEdit({ ...edit, tag: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setEdit(null)}>Hủy</button>
            <button className="btn btn-red" onClick={save}>Lưu</button>
          </div>
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Tiêu đề</th><th>Kênh</th><th>Người đăng</th><th>Trạng thái</th><th>Trả lời</th><th></th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{t.title}</td>
                <td>{t.channel || "—"}</td>
                <td>{t.author || "—"}</td>
                <td><span className={`tag ${STATUS_TAG[t.status] || "tag-grey"}`}>{STATUS_LABEL[t.status] || t.status}</span></td>
                <td>{t.reply_count}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {t.status === "pending" && (
                    <button className="btn btn-sm" onClick={() => approve(t)} title="Duyệt"><CheckCircle2 size={13} /></button>
                  )}{" "}
                  <button className="btn btn-sm" onClick={() => setEdit({ id: t.id, title: t.title, tag: t.tag })} title="Sửa"><Edit3 size={13} /></button>{" "}
                  <button className="btn btn-sm" onClick={() => del(t)} title="Xóa"><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty title="Không có chủ đề nào." />}
      </div>
    </Card>
  );
}

function RepliesPanel() {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(null);

  const load = () => {
    const q = status ? `?status=${status}` : "";
    api.get(`/api/admin/forum/replies${q}`).then((x) => setRows(Array.isArray(x) ? x : [])).catch((e) => setErr(e.message));
  };
  useEffect(load, [status]);

  const approve = async (r) => {
    try { await api.put(`/api/admin/forum/replies/${r.id}`, { status: "approved" }); load(); }
    catch (e) { setErr(e.message); }
  };
  const del = async (r) => {
    if (!window.confirm("Xóa trả lời này?")) return;
    try { await api.del(`/api/admin/forum/replies/${r.id}`); load(); }
    catch (e) { setErr(e.message); }
  };
  const save = async () => {
    try {
      await api.put(`/api/admin/forum/replies/${edit.id}`, { body: edit.body });
      setEdit(null); load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <Card title="Trả lời" icon={MessageSquare} action={<StatusFilter value={status} onChange={setStatus} />}>
      {err && <p style={{ color: RED, fontSize: 13, marginBottom: 10 }}>{err}</p>}
      {edit && (
        <div style={{ border: "1px solid #E7E3E4", borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <Field label="Nội dung trả lời">
            <textarea className="inp" rows={3} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setEdit(null)}>Hủy</button>
            <button className="btn btn-red" onClick={save}>Lưu</button>
          </div>
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Nội dung</th><th>Thuộc chủ đề</th><th>Người trả lời</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ maxWidth: 360 }}>{r.body}</td>
                <td>{r.thread_title || "—"}</td>
                <td>{r.author || "—"}</td>
                <td><span className={`tag ${STATUS_TAG[r.status] || "tag-grey"}`}>{STATUS_LABEL[r.status] || r.status}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {r.status === "pending" && (
                    <button className="btn btn-sm" onClick={() => approve(r)} title="Duyệt"><CheckCircle2 size={13} /></button>
                  )}{" "}
                  <button className="btn btn-sm" onClick={() => setEdit({ id: r.id, body: r.body })} title="Sửa"><Edit3 size={13} /></button>{" "}
                  <button className="btn btn-sm" onClick={() => del(r)} title="Xóa"><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty title="Không có trả lời nào." />}
      </div>
    </Card>
  );
}

export function AdminForum() {
  return (
    <div className="flex flex-col gap-4">
      <ThreadsPanel />
      <RepliesPanel />
    </div>
  );
}
