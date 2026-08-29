"use client";

import type { FormEvent } from "react";
import { Archive, ArchiveRestore, Check, RotateCcw, Trash2, Wrench } from "lucide-react";

export function CallbackLifecycleActions({
  action,
  callback,
}: {
  action: (formData: FormData) => Promise<void>;
  callback: { id: string; status: string; archived_at: string | null; deleted_at: string | null };
}) {
  function confirmAction(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "delete" && !window.confirm("Move this callback to Trash? Its customer charge and Ironwood cost will stop affecting the project until restored.")) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={confirmAction} className="button-row callback-actions">
      <input type="hidden" name="id" value={callback.id}/>
      {!callback.archived_at && !callback.deleted_at && callback.status === "draft" && <button className="button button--gold" name="action" value="accept"><Check size={16}/>Mark accepted</button>}
      {!callback.archived_at && !callback.deleted_at && callback.status === "accepted" && <button className="button button--gold" name="action" value="complete"><Wrench size={16}/>Mark repair complete</button>}
      {!callback.archived_at && !callback.deleted_at && callback.status !== "draft" && <button className="button button--outline" name="action" value="reopen"><RotateCcw size={16}/>Return to draft</button>}
      {callback.archived_at || callback.deleted_at
        ? <button className="button button--outline" name="action" value="restore"><ArchiveRestore size={16}/>Restore</button>
        : <button className="button button--outline" name="action" value="archive"><Archive size={16}/>Archive</button>}
      {!callback.deleted_at && <button className="button button--outline button--danger" name="action" value="delete"><Trash2 size={16}/>Move to trash</button>}
    </form>
  );
}
