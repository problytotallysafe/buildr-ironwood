"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Lock, Pencil, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type MediaItem = {
  id: string;
  storage_path: string;
  file_name: string;
  category: string;
  room_location: string | null;
  caption: string | null;
  customer_visible: boolean;
  created_at: string;
  signed_url: string | null;
};

const categories = [
  ["before", "Before"],
  ["rendering", "Rendering"],
  ["progress", "Progress"],
  ["material-selection", "Material Selection"],
  ["after", "After"],
  ["other", "Other"],
] as const;

function categoryLabel(value: string) {
  return categories.find(([key]) => key === value)?.[1] ?? "Other";
}

export function ProjectMedia({
  projectId,
  estimateId,
  initialMedia,
}: {
  projectId: string;
  estimateId?: string | null;
  initialMedia: MediaItem[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState("before");
  const [roomLocation, setRoomLocation] = useState("");
  const [caption, setCaption] = useState("");
  const [customerVisible, setCustomerVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const grouped = useMemo(() => {
    return categories
      .map(([key, label]) => ({
        key,
        label,
        items: initialMedia.filter((item) => item.category === key),
      }))
      .filter((group) => group.items.length > 0);
  }, [initialMedia]);

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const selectedFiles = files.length
      ? files
      : Array.from(fileInputRef.current?.files ?? []);

    if (!selectedFiles.length) {
      setError("Choose one or more photos first.");
      return;
    }

    const invalidFiles = selectedFiles.filter((selectedFile) => !selectedFile.type.startsWith("image/"));
    if (invalidFiles.length) {
      setError(`${invalidFiles.map((item) => item.name).join(", ")} ${invalidFiles.length === 1 ? "is" : "are"} not an image.`);
      return;
    }

    setBusy(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Your session expired. Sign in again.");
        return;
      }

      const failures: string[] = [];
      let uploaded = 0;

      for (const [index, selectedFile] of selectedFiles.entries()) {
        setProgress(`Uploading ${index + 1} of ${selectedFiles.length}`);
        const extension = selectedFile.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const storagePath = `${user.id}/${projectId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("project-media")
          .upload(storagePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: selectedFile.type || undefined,
          });
        if (uploadError) {
          failures.push(`${selectedFile.name}: ${uploadError.message}`);
          continue;
        }

        const { error: rowError } = await supabase.from("project_media").insert({
          owner_id: user.id,
          project_id: projectId,
          estimate_id: estimateId || null,
          storage_path: storagePath,
          file_name: selectedFile.name,
          media_type: "photo",
          category,
          room_location: roomLocation.trim() || null,
          caption: caption.trim() || null,
          customer_visible: customerVisible,
        });
        if (rowError) {
          await supabase.storage.from("project-media").remove([storagePath]);
          failures.push(`${selectedFile.name}: ${rowError.message}`);
          continue;
        }
        uploaded += 1;
      }

      if (uploaded) {
        setFiles([]);
        setCategory("before");
        setRoomLocation("");
        setCaption("");
        setCustomerVisible(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      }
      if (failures.length) setError(failures.join(" "));
      else setError("");
    } finally {
      setProgress("");
      setBusy(false);
    }
  }

  async function deletePhoto(item: MediaItem) {
    const confirmed = window.confirm(
      "Delete this photo from the project? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setBusy(true);

    try {
      const { error: storageError } = await supabase.storage
        .from("project-media")
        .remove([item.storage_path]);

      if (storageError) {
        setError(storageError.message);
        return;
      }

      const { error: rowError } = await supabase
        .from("project_media")
        .delete()
        .eq("id", item.id);

      if (rowError) {
        setError(rowError.message);
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function editPhoto(item: MediaItem) {
    const nextCaption = window.prompt("Photo caption", item.caption ?? "");
    if (nextCaption === null) return;
    const nextLocation = window.prompt("Room / location", item.room_location ?? "");
    if (nextLocation === null) return;
    const nextCategory = window.prompt(
      "Category: before, rendering, progress, material-selection, after, or other",
      item.category,
    );
    if (nextCategory === null) return;
    const validCategory = categories.some(([key]) => key === nextCategory)
      ? nextCategory
      : item.category;
    const visible = window.confirm(
      "Should this photo be customer-visible? Choose Cancel to keep it private.",
    );
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("project_media")
        .update({
          caption: nextCaption.trim() || null,
          room_location: nextLocation.trim() || null,
          category: validCategory,
          customer_visible: visible,
        })
        .eq("id", item.id);
      if (updateError) setError(updateError.message);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="project-media-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Project photos</h2>
          </div>
        </div>

        <form
          className="project-media-form form-grid"
          onSubmit={uploadPhoto}
        >
          <label className="span-2 project-media-file">
            Photos

            <input
              ref={fileInputRef}
              id="project-media-file"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                setFiles(Array.from(event.currentTarget.files ?? []));
                setError("");
              }}
            />

            {files.length > 0 && (
              <p className="fine-print">
                {files.length} photo{files.length === 1 ? "" : "s"} selected
              </p>
            )}
          </label>

          <label>
            Category

            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
            >
              {categories.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Room / location

            <input
              value={roomLocation}
              onChange={(event) =>
                setRoomLocation(event.target.value)
              }
              placeholder="Primary bath, kitchen, exterior..."
            />
          </label>

          <label className="span-2">
            Caption

            <input
              value={caption}
              onChange={(event) =>
                setCaption(event.target.value)
              }
              placeholder="Optional note about this photo"
            />
          </label>

          <label className="checkbox span-2">
            <input
              type="checkbox"
              checked={customerVisible}
              onChange={(event) =>
                setCustomerVisible(event.target.checked)
              }
            />

            Customer-visible
          </label>

          <div className="span-2">
            <button
              className="button button--gold"
              type="submit"
              disabled={busy}
            >
              <Upload size={17} />

              {busy ? progress || "Uploading…" : files.length ? `Upload ${files.length} photo${files.length === 1 ? "" : "s"}` : "Upload photos"}
            </button>
          </div>
        </form>

        {error && (
          <p className="error-box">
            {error}
          </p>
        )}
      </section>

      {grouped.length === 0 ? (
        <section className="panel project-media-empty">
          <Camera size={28} />

          <h3>No project photos yet</h3>

          <p>
            Upload the first photo above to start the project record.
          </p>
        </section>
      ) : (
        grouped.map((group) => (
          <section className="panel" key={group.key}>
            <div className="panel-heading">
              <div>
                <h2>{group.label}</h2>

                <p>
                  {group.items.length} photo
                  {group.items.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="project-media-grid">
              {group.items.map((item) => (
                <article
                  className="project-media-card"
                  key={item.id}
                >
                  <div className="project-media-image-wrap">
                    {item.signed_url ? (
                      <img
                        src={item.signed_url}
                        alt={
                          item.caption ||
                          categoryLabel(item.category)
                        }
                        className="project-media-image"
                      />
                    ) : (
                      <div className="project-media-image-missing">
                        Photo unavailable
                      </div>
                    )}

                    {!item.customer_visible && (
                      <span className="project-media-private">
                        <Lock size={13} />
                        Private
                      </span>
                    )}
                  </div>

                  <div className="project-media-card-body">
                    <div>
                      <strong>
                        {categoryLabel(item.category)}
                      </strong>

                      {item.room_location && (
                        <small>
                          {item.room_location}
                        </small>
                      )}
                    </div>

                    {item.caption && (
                      <p>{item.caption}</p>
                    )}

                    <div className="project-media-card-footer">
                      <small>
                        {new Date(
                          item.created_at,
                        ).toLocaleDateString()}
                      </small>

                      <div className="button-row"><button
                        type="button"
                        className="icon-button"
                        aria-label="Edit photo details"
                        disabled={busy}
                        onClick={() => editPhoto(item)}
                      ><Pencil size={16}/></button><button
                        type="button"
                        className="icon-button danger"
                        aria-label="Delete photo"
                        disabled={busy}
                        onClick={() => deletePhoto(item)}
                      >
                        <Trash2 size={16} />
                      </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
