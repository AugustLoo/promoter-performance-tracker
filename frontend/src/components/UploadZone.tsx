/**
 * UploadZone — Snap-first capture.
 *
 *  - "Snap & Upload": opens the camera; the captured photo is handed to
 *    onCameraCapture, which uploads it immediately (no extra tap).
 *  - "Choose from gallery": batch-select existing photos to review, then
 *    upload with the form's button.
 */

import { useRef, useState, useCallback } from "react";

interface Props {
  files: File[];
  onCameraCapture: (files: File[]) => void;
  onGallerySelect: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  maxFiles?: number;
  busy?: boolean;
}

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

export default function UploadZone({
  files,
  onCameraCapture,
  onGallerySelect,
  onRemoveFile,
  maxFiles = 20,
  busy = false,
}: Props) {
  const [limitWarning, setLimitWarning] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const remaining = maxFiles - files.length;

  // Accept images by MIME type OR extension — HEIC (iPhone) often has an
  // empty MIME on some browsers, so fall back to the file extension.
  const isImageFile = (f: File) => {
    if (f.type.startsWith("image/")) return true;
    const ext = f.name.toLowerCase().split(".").pop();
    return ["jpg", "jpeg", "png", "webp", "heic", "heif", "bmp", "tiff"].includes(ext || "");
  };

  const filterImages = useCallback(
    (fileList: FileList | null): File[] => {
      if (!fileList) return [];
      const images = Array.from(fileList).filter(isImageFile);
      if (files.length + images.length > maxFiles) {
        const allowed = images.slice(0, Math.max(0, remaining));
        setLimitWarning(
          `Maximum ${maxFiles} photos per upload. ${images.length - allowed.length} not added.`
        );
        setTimeout(() => setLimitWarning(""), 4000);
        return allowed;
      }
      setLimitWarning("");
      return images;
    },
    [files.length, maxFiles, remaining]
  );

  const handleCamera = (e: React.ChangeEvent<HTMLInputElement>) => {
    const captured = Array.from(e.target.files || []).filter(isImageFile);
    e.target.value = "";
    if (captured.length > 0) onCameraCapture(captured);
  };

  const handleGallery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = filterImages(e.target.files);
    e.target.value = "";
    if (selected.length > 0) onGallerySelect(selected);
  };

  return (
    <div>
      <button
        type="button"
        className="snap-primary"
        onClick={() => cameraRef.current?.click()}
        disabled={busy}
      >
        <CameraIcon />
        {busy ? "Uploading…" : "Snap & Upload"}
      </button>

      <button
        type="button"
        className="gallery-link"
        onClick={() => galleryRef.current?.click()}
        disabled={busy}
      >
        or choose photos from gallery
      </button>

      {/* Camera: single shot, uploads immediately */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCamera}
        style={{ display: "none" }}
      />
      {/* Gallery: multi-select, review then upload */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleGallery}
        style={{ display: "none" }}
      />

      {limitWarning && <div className="upload-zone-warning">{limitWarning}</div>}

      {files.length > 0 && (
        <>
          <div className="capture-count">
            {files.length} photo{files.length !== 1 ? "s" : ""} selected — tap Upload below
          </div>
          <div className="preview-grid">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="preview-item">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                />
                <button
                  type="button"
                  className="preview-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFile(index);
                  }}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
