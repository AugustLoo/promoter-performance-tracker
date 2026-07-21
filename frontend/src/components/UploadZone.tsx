/**
 * UploadZone — Camera-first photo capture with preview thumbnails.
 *
 * Two clear actions on mobile:
 *  - Snap Photo: opens the phone camera directly (capture="environment")
 *  - Choose Photos: opens the gallery / file picker (multiple)
 * Selected photos show as removable thumbnails before upload.
 */

import { useState, useRef, useCallback } from "react";

interface Props {
  files: File[];
  onFilesSelected: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  maxFiles?: number;
}

const CameraIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const GalleryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

export default function UploadZone({ files, onFilesSelected, onRemoveFile, maxFiles = 20 }: Props) {
  const [limitWarning, setLimitWarning] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const remaining = maxFiles - files.length;

  const filterImages = useCallback(
    (fileList: FileList | null): File[] => {
      if (!fileList) return [];
      const images = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
      if (files.length + images.length > maxFiles) {
        const allowed = images.slice(0, remaining);
        setLimitWarning(
          `Maximum ${maxFiles} photos per upload. ${images.length - allowed.length} photo(s) were not added.`
        );
        setTimeout(() => setLimitWarning(""), 4000);
        return allowed;
      }
      setLimitWarning("");
      return images;
    },
    [files.length, maxFiles, remaining]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = filterImages(e.target.files);
    if (selected.length > 0) onFilesSelected(selected);
    e.target.value = "";
  };

  return (
    <div>
      <div className="capture-row">
        <button
          type="button"
          className="capture-btn"
          onClick={() => cameraRef.current?.click()}
          disabled={remaining <= 0}
        >
          <CameraIcon />
          <span className="capture-btn-label">Snap Photo</span>
          <span className="capture-btn-hint">Open camera</span>
        </button>

        <button
          type="button"
          className="capture-btn"
          onClick={() => galleryRef.current?.click()}
          disabled={remaining <= 0}
        >
          <GalleryIcon />
          <span className="capture-btn-label">Choose Photos</span>
          <span className="capture-btn-hint">From gallery</span>
        </button>
      </div>

      {/* Hidden inputs: camera capture + multi-select gallery */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        style={{ display: "none" }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
        style={{ display: "none" }}
      />

      {files.length > 0 && (
        <div className="capture-count">
          {files.length} photo{files.length !== 1 ? "s" : ""} ready · {remaining} more allowed
        </div>
      )}

      {limitWarning && <div className="upload-zone-warning">{limitWarning}</div>}

      {files.length > 0 && (
        <div className="preview-grid">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="preview-item">
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                onLoad={(e) => {
                  URL.revokeObjectURL((e.target as HTMLImageElement).src);
                }}
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
      )}
    </div>
  );
}
