"use client";

import { useRef, useState } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Photo = { id: string; storage_path: string; file_name: string; caption: string | null; signed_url: string | null };

export function SiteVisitPhotos({ worksheetId, photos }: { worksheetId: string; photos: Photo[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload() {
    const file = input.current?.files?.[0];
    if (!file) return setError("Choose a photo first.");
    if (!file.type.startsWith("image/")) return setError("Choose an image file.");
    setBusy(true); setError("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return setError("Your session expired."); }
    const ext = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
    const path = `${user.id}/${worksheetId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("site-visit-media").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { setBusy(false); return setError(uploadError.message); }
    const { error: rowError } = await supabase.from("site_visit_media").insert({ owner_id: user.id, worksheet_id: worksheetId, storage_path: path, file_name: file.name, caption: caption.trim() || null });
    if (rowError) { await supabase.storage.from("site-visit-media").remove([path]); setBusy(false); return setError(rowError.message); }
    if (input.current) input.current.value = "";
    setCaption(""); setBusy(false); router.refresh();
  }

  async function remove(photo: Photo) {
    if (!window.confirm("Delete this walkthrough photo?")) return;
    setBusy(true); const supabase = createClient();
    const { error: storageError } = await supabase.storage.from("site-visit-media").remove([photo.storage_path]);
    if (!storageError) await supabase.from("site_visit_media").delete().eq("id", photo.id);
    setBusy(false); router.refresh();
  }

  return <section className="panel stack">
    <div className="panel-heading"><div><h2>Walkthrough photos</h2><p>Photograph rooms, measurements, utilities, model numbers, damage, and anything that affects the estimate.</p></div><Camera/></div>
    <div className="form-grid"><label>Take or choose photo<input ref={input} type="file" accept="image/*" capture="environment"/></label><label>Caption / location<input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Kitchen north wall, water damage…"/></label></div>
    <div><button type="button" className="button button--gold" disabled={busy} onClick={upload}><Upload size={16}/>{busy ? "Uploading…" : "Upload photo"}</button></div>
    {error && <p className="error-box">{error}</p>}
    {photos.length > 0 && <div className="walkthrough-photo-grid">{photos.map((photo) => <figure key={photo.id}><img src={photo.signed_url || ""} alt={photo.caption || photo.file_name}/><figcaption><span>{photo.caption || photo.file_name}</span><button type="button" onClick={() => remove(photo)} disabled={busy} aria-label="Delete photo"><Trash2 size={15}/></button></figcaption></figure>)}</div>}
  </section>;
}
