"use client";

import { useRef, useState } from "react";
import {
  Button,
  Field,
  inputClass,
  PageHead,
  Panel,
  Tag,
  Toast,
  useToast,
} from "@/components/ui";

const CATEGORIES = [
  { value: "offer", label: "Offer" },
  { value: "package", label: "Package" },
  { value: "service", label: "Service example" },
  { value: "general", label: "General" },
] as const;

type MediaItem = {
  id: number;
  title: string;
  category: string;
  keywords: string[];
  caption: string;
  service_id: number | null;
  mime_type: string;
  active: boolean;
  url: string;
  public_token: string;
};

type Service = { id: number; name: string };

const emptyDraft = {
  title: "",
  category: "general" as string,
  keywords: "",
  caption: "",
  service_id: "",
};

export default function MediaEditor({
  initialMedia,
  services,
  readOnly,
}: {
  initialMedia: MediaItem[];
  services: Service[];
  readOnly: boolean;
}) {
  const [media, setMedia] = useState(initialMedia);
  const [draft, setDraft] = useState(emptyDraft);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { message, show } = useToast();

  async function refresh() {
    const res = await fetch("/api/media");
    const data = await res.json();
    if (data.ok) setMedia(data.media);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return show("Please pick an image first.");

    const form = new FormData();
    form.append("file", file);
    form.append("title", draft.title);
    form.append("category", draft.category);
    form.append("keywords", draft.keywords);
    form.append("caption", draft.caption);
    if (draft.service_id) form.append("service_id", draft.service_id);

    setUploading(true);
    const res = await fetch("/api/media", { method: "POST", body: form });
    setUploading(false);
    const data = await res.json();

    if (!data.ok) {
      const msgs: Record<string, string> = {
        no_file: "No file attached.",
        missing_title: "Title is required.",
        unsupported_mime_type: "Only JPEG, PNG, and WebP images are accepted.",
        file_too_large: "The file is larger than 5 MB.",
      };
      return show(msgs[data.error] ?? "Could not upload that image.");
    }

    setDraft(emptyDraft);
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
    await refresh();
    show("Photo added to the media library.");
  }

  async function toggle(item: MediaItem) {
    await fetch(`/api/media/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
    });
    await refresh();
    show(item.active ? "Photo hidden from the assistant." : "Photo is live again.");
  }

  const catLabel = (v: string) =>
    CATEGORIES.find((c) => c.value === v)?.label ?? v;

  const catTone = (v: string): "good" | "warn" | "neutral" | "bad" => {
    const map: Record<string, "good" | "warn" | "neutral" | "bad"> = {
      offer: "good",
      package: "warn",
      service: "neutral",
      general: "neutral",
    };
    return map[v] ?? "neutral";
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <PageHead
        title="Media library"
        lead="Photos the assistant can show mid-conversation — offers, packages, service examples, and ad-matched images."
      />

      {/* ── Grid of existing photos ── */}
      {media.length === 0 ? (
        <Panel className="mb-6">
          <p className="text-sm text-ink-soft py-6 text-center">
            No photos yet. Add one so the assistant can show it when customers ask about
            offers or packages.
          </p>
        </Panel>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {media.map((item) => (
            <div
              key={item.id}
              className={`bg-panel border border-line rounded-lg overflow-hidden flex flex-col ${
                !item.active ? "opacity-60" : ""
              }`}
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-canvas overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              {/* Meta */}
              <div className="p-3 flex-1 flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm leading-snug">{item.title}</p>
                  <Tag tone={item.active ? catTone(item.category) : "neutral"}>
                    {!item.active ? "hidden" : catLabel(item.category)}
                  </Tag>
                </div>

                {item.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {item.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-canvas text-ink-soft border border-line"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}

                {item.caption && (
                  <p className="text-xs text-ink-soft mt-0.5 line-clamp-2">{item.caption}</p>
                )}

                {!readOnly && (
                  <div className="flex gap-2 mt-auto pt-2">
                    <Button
                      variant="quiet"
                      className="text-xs px-2.5 py-1"
                      onClick={() => toggle(item)}
                    >
                      {item.active ? "Hide" : "Show"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add photo form ── */}
      {!readOnly && (
        <Panel>
          <h2 className="font-semibold mb-5">Add a photo</h2>

          <form onSubmit={handleUpload} className="space-y-4">
            {/* File picker + preview */}
            <Field label="Image file" hint="JPEG, PNG, or WebP — max 5 MB.">
              <div className="flex flex-col gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  onChange={handleFileChange}
                  className="block text-sm text-ink-soft file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-line file:text-sm file:font-medium file:bg-canvas file:text-ink hover:file:bg-panel"
                />
                {preview && (
                  <div className="w-40 h-28 rounded border border-line overflow-hidden bg-canvas">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Title">
                <input
                  className={inputClass}
                  required
                  placeholder="e.g. Summer Promo 50% off"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </Field>

              <Field label="Category">
                <select
                  className={inputClass}
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Keywords"
                hint="Comma-separated. The assistant matches these against what the customer writes."
              >
                <input
                  className={inputClass}
                  placeholder="e.g. promo, offer, 50%, summer"
                  value={draft.keywords}
                  onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
                />
              </Field>

              <Field label="Link to service" hint="Optional — ties this photo to a specific service.">
                <select
                  className={inputClass}
                  value={draft.service_id}
                  onChange={(e) => setDraft({ ...draft, service_id: e.target.value })}
                >
                  <option value="">— none —</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Caption" hint="Optional text the bot sends alongside the image.">
              <textarea
                className={`${inputClass} min-h-[72px] resize-y`}
                placeholder="A short caption or offer details…"
                value={draft.caption}
                onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
              />
            </Field>

            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading…" : "Add photo"}
            </Button>
          </form>
        </Panel>
      )}

      <Toast message={message} />
    </div>
  );
}
