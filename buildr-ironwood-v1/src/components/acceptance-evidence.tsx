"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Image as ImageIcon, Pencil, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Evidence = {
  id: string;
  revision_number: number;
  evidence_type: string;
  note: string;
  storage_path: string | null;
  file_name: string | null;
  content_type: string | null;
  created_at: string;
  signed_url: string | null;
};

const labels: Record<string, string> = {
  text_confirmation: "Text-message confirmation",
  signed_paper: "Signed paper",
  email_confirmation: "Email confirmation",
  in_person: "In-person approval",
  other: "Other evidence",
};

export function AcceptanceEvidence({
  estimateId,
  revisionNumber,
  initialEvidence,
}: {
  estimateId: string;
  revisionNumber: number;
  initialEvidence: Evidence[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [type, setType] = useState("text_confirmation");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!note.trim()) {
      setError("Add a note explaining what this evidence shows.");
      return;
    }
    setBusy(true);
    let storagePath: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Your session expired. Sign in again.");
        return;
      }
      if (file) {
        const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
        storagePath = `${user.id}/${estimateId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("acceptance-evidence")
          .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
        if (uploadError) {
          setError(uploadError.message);
          return;
        }
      }
      const { error: rowError } = await supabase
        .from("estimate_acceptance_evidence")
        .insert({
          owner_id: user.id,
          estimate_id: estimateId,
          revision_number: revisionNumber,
          evidence_type: type,
          note: note.trim(),
          storage_path: storagePath,
          file_name: file?.name || null,
          content_type: file?.type || null,
        });
      if (rowError) {
        if (storagePath) await supabase.storage.from("acceptance-evidence").remove([storagePath]);
        setError(rowError.message);
        return;
      }
      setNote("");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function edit(item: Evidence) {
    const next = window.prompt("Update the evidence note", item.note);
    if (next === null || !next.trim()) return;
    setBusy(true);
    const { error: updateError } = await supabase
      .from("estimate_acceptance_evidence")
      .update({ note: next.trim() })
      .eq("id", item.id);
    setBusy(false);
    if (updateError) setError(updateError.message);
    else router.refresh();
  }

  async function remove(item: Evidence) {
    if (!window.confirm("Delete this acceptance evidence?")) return;
    setBusy(true);
    if (item.storage_path) {
      const { error: storageError } = await supabase.storage
        .from("acceptance-evidence")
        .remove([item.storage_path]);
      if (storageError) {
        setError(storageError.message);
        setBusy(false);
        return;
      }
    }
    const { error: deleteError } = await supabase
      .from("estimate_acceptance_evidence")
      .delete()
      .eq("id", item.id);
    setBusy(false);
    if (deleteError) setError(deleteError.message);
    else router.refresh();
  }

  return (
    <section className="panel acceptance-evidence">
      <div className="panel-heading">
        <div>
          <h2>Acceptance evidence</h2>
          <p>Add a note, screenshot, signed paper, or other proof tied to this exact estimate revision.</p>
        </div>
      </div>
      <form className="form-grid" onSubmit={save}>
        <label>
          Evidence type
          <select value={type} onChange={(event) => setType(event.target.value)}>
            {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Screenshot or file (optional)
          <input ref={inputRef} type="file" accept="image/*,.pdf" onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)} />
        </label>
        <label className="span-2">
          Evidence note
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Customer confirmed approval by text. See attached screenshot." required />
        </label>
        <div className="span-2">
          <button className="button button--outline" disabled={busy}><Upload size={16}/>{busy ? "Saving…" : "Add evidence"}</button>
        </div>
      </form>
      {error && <p className="error-box">{error}</p>}
      <div className="evidence-list">
        {initialEvidence.map((item) => (
          <article key={item.id} className="evidence-card">
            <div className="evidence-icon">{item.content_type?.startsWith("image/") ? <ImageIcon size={20}/> : <FileText size={20}/>}</div>
            <div>
              <strong>{labels[item.evidence_type] || "Acceptance evidence"}</strong>
              <p>{item.note}</p>
              <small>Revision {item.revision_number} • {new Date(item.created_at).toLocaleString()}{item.file_name ? ` • ${item.file_name}` : " • Note only"}</small>
              {item.signed_url && <a href={item.signed_url} target="_blank" rel="noreferrer">Open attachment</a>}
            </div>
            <div className="button-row">
              <button type="button" className="icon-button" disabled={busy} onClick={() => edit(item)} aria-label="Edit evidence note"><Pencil size={15}/></button>
              <button type="button" className="icon-button danger" disabled={busy} onClick={() => remove(item)} aria-label="Delete evidence"><Trash2 size={15}/></button>
            </div>
          </article>
        ))}
        {!initialEvidence.length && <p className="muted">No supporting evidence attached yet.</p>}
      </div>
    </section>
  );
}
