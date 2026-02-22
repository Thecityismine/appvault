import { memo, useState, useMemo, useEffect, useCallback } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, writeBatch
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "./firebase";

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ["All", "CRE", "Finance", "Family", "Fitness", "Medical", "Pet Care", "Other"];

const SAMPLE_APPS = [
  { name: "GanttFlow",          url: "https://ganttflow.vercel.app",      description: "Project schedule management with multi-phase Gantt charts, task tracking, and export.", category: "CRE",      image: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&q=80" },
  { name: "CRE Project Manager",url: "https://cre-pm.vercel.app",         description: "Full construction project tracker with RFIs, submittals, change orders, and budgets.",  category: "CRE",      image: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=80" },
  { name: "Bitcoin Tracker",    url: "https://btc-tracker.vercel.app",    description: "Trade entry, P&L analytics, and performance grading for Bitcoin positions.",             category: "Finance",  image: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=600&q=80" },
  { name: "Budget Manager",     url: "https://budget-app.vercel.app",     description: "Household budget tracker with expense categories and monthly summaries.",                 category: "Finance",  image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&q=80" },
  { name: "Medina Family Tree", url: "https://medina-family.vercel.app",  description: "Interactive genealogy app with birthday tracking and authentication.",                   category: "Family",   image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80" },
  { name: "Wag & Wander",       url: "https://wagwander.vercel.app",      description: "Pet care business management — bookings, client profiles, and scheduling.",              category: "Pet Care", image: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600&q=80" },
];

// ─── Shared styles ────────────────────────────────────────────────────────────

const normalizeUrl = (value = "") => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const isPersistentImageUrl = (value = "") => {
  const trimmed = value.trim();
  return !!trimmed && !trimmed.startsWith("blob:");
};

const buildScreenshotUrl = (url = "") => {
  const normalized = normalizeUrl(url);
  if (!normalized) return "";
  return `https://image.thum.io/get/width/640/crop/420/noanimate/${encodeURI(normalized)}`;
};

const optimizeImageUrl = (value = "") => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.includes("image.thum.io/get/")) {
    return trimmed
      .replace(/\/width\/\d+\//, "/width/640/")
      .replace(/\/crop\/\d+\//, "/crop/420/");
  }

  if (trimmed.includes("images.unsplash.com/")) {
    try {
      const url = new URL(trimmed);
      url.searchParams.set("w", "720");
      url.searchParams.set("q", "75");
      url.searchParams.set("auto", "format");
      return url.toString();
    } catch {
      return trimmed;
    }
  }

  return trimmed;
};

const resolveImageUrl = (image = "", url = "") => {
  const source = isPersistentImageUrl(image) ? image : buildScreenshotUrl(url);
  return optimizeImageUrl(source);
};

const uploadScreenshotFile = async (file) => {
  const ext = (file?.name?.split(".").pop() || "png").toLowerCase();
  const path = `app-previews/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file, { contentType: file.type || "image/png" });
  return getDownloadURL(fileRef);
};

const inputStyle = {
  width: "100%", background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
  padding: "11px 14px", color: "#eeeef5",
  fontFamily: "'DM Sans', sans-serif", fontSize: "14px",
  outline: "none", boxSizing: "border-box",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function VaultLogo({ size = 36 }) {
  const logoSrc = `${process.env.PUBLIC_URL || ""}/apple-touch-icon.png`;
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.22,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)",
    }}>
      <img
        src={logoSrc}
        alt="App Vault"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}

const AppCard = memo(function AppCard({ app, onDelete, onEdit }) {
  const [imgError, setImgError] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const imageUrl = useMemo(() => resolveImageUrl(app.image, app.url), [app.image, app.url]);

  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Remove "${app.name}" from the vault?`)) return;
    setDeleting(true);
    await onDelete(app.id);
  };

  return (
    <div
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)} onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        background: "linear-gradient(160deg, #161828 0%, #0f1120 100%)",
        border: `1px solid ${pressed ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: "16px", overflow: "hidden",
        transition: "all 0.18s ease",
        transform: pressed ? "scale(0.98)" : "scale(1)",
        boxShadow: pressed ? "0 0 0 1px rgba(139,92,246,0.3), 0 8px 24px rgba(0,0,0,0.5)" : "0 2px 12px rgba(0,0,0,0.4)",
        opacity: deleting ? 0.5 : 1,
      }}
    >
      {/* Image */}
      <div style={{ position: "relative", height: "130px", background: "#0a0b14", overflow: "hidden" }}>
        {!imgError ? (
          <img src={imageUrl} alt={app.name} onError={() => setImgError(true)} loading="lazy" decoding="async" fetchPriority="low"
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.65 }} />
        ) : (
          <div style={{
            width: "100%", height: "100%", display: "flex", alignItems: "center",
            justifyContent: "center", background: "linear-gradient(135deg, #1a1c2e, #0d0f1a)", fontSize: "40px",
          }}>🖥️</div>
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,17,32,0.85) 0%, transparent 55%)" }} />
        <div style={{ position: "absolute", top: "10px", left: "10px", display: "flex", gap: "6px" }}>
          <button onClick={(e) => { e.stopPropagation(); onEdit(app); }} style={{
            background: "rgba(139,92,246,0.55)", border: "1px solid rgba(139,92,246,0.4)",
            borderRadius: "6px", padding: "4px 9px", color: "#d8b4fe",
            fontSize: "11px", cursor: "pointer", backdropFilter: "blur(4px)",
            fontFamily: "'DM Mono', monospace", fontWeight: 700,
          }}>✏️</button>
          <button onClick={handleDelete} disabled={deleting} style={{
            background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "6px", padding: "4px 9px", color: "rgba(255,255,255,0.5)",
            fontSize: "11px", cursor: deleting ? "not-allowed" : "pointer", backdropFilter: "blur(4px)",
          }}>✕</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <h3 style={{
          margin: 0, fontFamily: "'Outfit', 'DM Sans', sans-serif",
          fontWeight: 600, fontSize: "15px", color: "#eeeef5", letterSpacing: "0.01em", lineHeight: 1.15,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
        }}>{app.name}</h3>
        <a href={app.url} target="_blank" rel="noopener noreferrer" style={{
          background: "linear-gradient(135deg, #7c3aed, #8b5cf6)", color: "#fff",
          fontSize: "10px", fontWeight: 700, fontFamily: "'DM Mono', monospace",
          letterSpacing: "0.08em", padding: "7px 14px", borderRadius: "8px",
          textDecoration: "none", boxShadow: "0 4px 12px rgba(139,92,246,0.35)", flexShrink: 0,
        }}>LAUNCH →</a>
      </div>
    </div>
  );
});

function FetchButton({ url, onResult, label = "⟳ FETCH" }) {
  const [fetching, setFetching] = useState(false);
  const [status, setStatus] = useState("");

  const handleFetch = async () => {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) return;
    setFetching(true);
    setStatus("");
    try {
      const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(normalizedUrl)}&screenshot=true&meta=false&embed=screenshot.url`;
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = reject;
        img.src = screenshotUrl;
      });
      onResult({ image: screenshotUrl, status: "success" });
      setStatus("success");
    } catch {
      onResult({ image: "", status: "error" });
      setStatus("error");
    } finally {
      setFetching(false);
    }
  };

  return (
    <button onClick={handleFetch} disabled={fetching || !url} style={{
      background: fetching ? "rgba(139,92,246,0.4)" : status === "success" ? "rgba(16,185,129,0.2)" : "rgba(139,92,246,0.2)",
      border: `1px solid ${status === "success" ? "rgba(16,185,129,0.4)" : "rgba(139,92,246,0.4)"}`,
      color: fetching ? "rgba(167,139,250,0.6)" : status === "success" ? "#34d399" : "#a78bfa",
      fontFamily: "'DM Mono', monospace", fontSize: "11px", fontWeight: 700,
      padding: "11px 12px", borderRadius: "10px",
      cursor: fetching || !url ? "not-allowed" : "pointer",
      whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.2s ease",
    }}>
      {fetching ? "FETCHING…" : status === "success" ? "✓ DONE" : label}
    </button>
  );
}

function AddModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: "", url: "", description: "", category: "CRE", image: "" });
  const [previewImg, setPreviewImg] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleFetchResult = ({ image, status }) => {
    if (status === "success") { setPreviewImg(image); setPreviewFile(null); setFetchError(false); }
    else setFetchError(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.url) return;
    setSaving(true);
    setSaveError("");
    try {
      const normalizedUrl = normalizeUrl(form.url);
      const imageToSave = previewFile
        ? await uploadScreenshotFile(previewFile)
        : resolveImageUrl(previewImg || form.image, normalizedUrl);
      await onAdd({ ...form, url: normalizedUrl, image: imageToSave });
      onClose();
    } catch (err) {
      const message = err?.message ? String(err.message).replace(/^Firebase:\s*/i, "") : "Could not save bookmark. Please try again.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      backdropFilter: "blur(10px)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 200,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #1a1c2e 0%, #13152a 100%)",
        border: "1px solid rgba(139,92,246,0.3)", borderRadius: "24px",
        padding: "28px 24px 40px", width: "calc(100% - 24px)", maxWidth: "520px",
        boxShadow: "0 -20px 60px rgba(0,0,0,0.6)", overflowY: "auto", maxHeight: "90vh",
      }}>
        <div style={{ width: "40px", height: "4px", background: "rgba(255,255,255,0.15)", borderRadius: "2px", margin: "0 auto 24px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
          <h2 style={{ margin: 0, fontFamily: "'Outfit', 'DM Sans', sans-serif", fontWeight: 600, fontSize: "20px", color: "#eeeef5", letterSpacing: "0.01em" }}>Add App</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: "18px", cursor: "pointer" }}>✕</button>
        </div>

        {previewImg && (
          <div style={{ marginBottom: "18px", borderRadius: "12px", overflow: "hidden", height: "110px" }}>
            <img src={previewImg} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.75 }} />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* URL + Fetch */}
          <div style={{ display: "flex", gap: "8px" }}>
            <input placeholder="https://your-app.vercel.app" value={form.url}
              onChange={e => { setForm(f => ({ ...f, url: e.target.value })); setFetchError(false); setSaveError(""); }}
              style={{ ...inputStyle, flex: 1 }} />
            <FetchButton url={form.url} onResult={handleFetchResult} label="⟳ FETCH" />
          </div>
          {fetchError && <p style={{ margin: 0, fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "rgba(251,191,36,0.8)" }}>⚠ Couldn't fetch screenshot — upload one below.</p>}

          <input placeholder="App Name" value={form.name}
            onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setSaveError(""); }} style={inputStyle} />

          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            style={{ ...inputStyle, cursor: "pointer" }}>
            {CATEGORIES.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {saveError && <p style={{ margin: 0, fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "rgba(248,113,113,0.95)" }}>Save failed: {saveError}</p>}

          <label style={{
            display: "flex", alignItems: "center", gap: "10px",
            background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)",
            borderRadius: "10px", padding: "12px 14px", cursor: "pointer",
            fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "rgba(255,255,255,0.3)",
          }}>
            📷 Upload custom screenshot
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
              const file = e.target.files[0];
              if (file) {
                setPreviewFile(file);
                setPreviewImg(URL.createObjectURL(file));
                setFetchError(false);
                setSaveError("");
              }
            }} />
          </label>

          <button onClick={handleSubmit} disabled={saving || !form.name || !form.url} style={{
            background: saving ? "rgba(139,92,246,0.4)" : "linear-gradient(135deg, #7c3aed, #8b5cf6)",
            border: "none", color: "#fff", fontFamily: "'DM Mono', monospace",
            fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em",
            padding: "14px", borderRadius: "12px", cursor: saving ? "not-allowed" : "pointer",
            boxShadow: "0 6px 20px rgba(139,92,246,0.4)", marginTop: "4px",
          }}>
            {saving ? "SAVING…" : "+ ADD TO VAULT"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ app, onClose, onSave }) {
  const [form, setForm] = useState({ name: app.name, url: app.url, description: app.description, category: app.category, image: app.image });
  const [previewImg, setPreviewImg] = useState(app.image || "");
  const [previewFile, setPreviewFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleFetchResult = ({ image, status }) => {
    if (status === "success") { setPreviewImg(image); setPreviewFile(null); setFetchError(false); }
    else setFetchError(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.url) return;
    setSaving(true);
    setSaveError("");
    try {
      const normalizedUrl = normalizeUrl(form.url);
      const imageToSave = previewFile
        ? await uploadScreenshotFile(previewFile)
        : resolveImageUrl(previewImg || form.image, normalizedUrl);
      await onSave({ ...app, ...form, url: normalizedUrl, image: imageToSave });
      onClose();
    } catch (err) {
      const message = err?.message ? String(err.message).replace(/^Firebase:\s*/i, "") : "Could not save bookmark. Please try again.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
      backdropFilter: "blur(10px)", display: "flex",
      alignItems: "flex-end", justifyContent: "center", zIndex: 200,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "linear-gradient(160deg, #1a1c2e 0%, #13152a 100%)",
        border: "1px solid rgba(139,92,246,0.3)", borderRadius: "24px 24px 0 0",
        padding: "28px 24px 40px", width: "100%", maxWidth: "520px",
        boxShadow: "0 -20px 60px rgba(0,0,0,0.6)", overflowY: "auto", maxHeight: "90vh",
      }}>
        <div style={{ width: "40px", height: "4px", background: "rgba(255,255,255,0.15)", borderRadius: "2px", margin: "0 auto 24px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
          <h2 style={{ margin: 0, fontFamily: "'Outfit', 'DM Sans', sans-serif", fontWeight: 600, fontSize: "20px", color: "#eeeef5", letterSpacing: "0.01em" }}>Edit App</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: "18px", cursor: "pointer" }}>✕</button>
        </div>

        {previewImg && (
          <div style={{ marginBottom: "18px", borderRadius: "12px", overflow: "hidden", height: "110px" }}>
            <img src={previewImg} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.75 }}
              onError={() => setPreviewImg("")} />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <input placeholder="App Name" value={form.name}
            onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setSaveError(""); }} style={inputStyle} />

          {/* URL + Fetch */}
          <div style={{ display: "flex", gap: "8px" }}>
            <input placeholder="https://your-app.vercel.app" value={form.url}
              onChange={e => { setForm(f => ({ ...f, url: e.target.value })); setFetchError(false); setSaveError(""); }}
              style={{ ...inputStyle, flex: 1 }} />
            <FetchButton url={form.url} onResult={handleFetchResult} label="⟳ FETCH" />
          </div>
          {fetchError && <p style={{ margin: 0, fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "rgba(251,191,36,0.8)" }}>⚠ Couldn't fetch screenshot — upload one below.</p>}

          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            style={{ ...inputStyle, cursor: "pointer" }}>
            {CATEGORIES.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {saveError && <p style={{ margin: 0, fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "rgba(248,113,113,0.95)" }}>Save failed: {saveError}</p>}

          <label style={{
            display: "flex", alignItems: "center", gap: "10px",
            background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)",
            borderRadius: "10px", padding: "12px 14px", cursor: "pointer",
            fontFamily: "'DM Mono', monospace", fontSize: "11px", color: "rgba(255,255,255,0.3)",
          }}>
            📷 Change screenshot
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
              const file = e.target.files[0];
              if (file) {
                setPreviewFile(file);
                setPreviewImg(URL.createObjectURL(file));
                setFetchError(false);
                setSaveError("");
              }
            }} />
          </label>

          <button onClick={handleSubmit} disabled={saving || !form.name || !form.url} style={{
            background: saving ? "rgba(139,92,246,0.4)" : "linear-gradient(135deg, #7c3aed, #8b5cf6)",
            border: "none", color: "#fff", fontFamily: "'DM Mono', monospace",
            fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em",
            padding: "14px", borderRadius: "12px", cursor: saving ? "not-allowed" : "pointer",
            boxShadow: "0 6px 20px rgba(139,92,246,0.4)", marginTop: "4px",
          }}>
            {saving ? "SAVING…" : "SAVE CHANGES"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HamburgerMenu({ activeCategory, setActiveCategory, onClose, apps }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(8px)", zIndex: 150, display: "flex", justifyContent: "flex-end",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "260px", height: "100%",
        background: "linear-gradient(160deg, #1a1c2e, #0f1120)",
        borderLeft: "1px solid rgba(139,92,246,0.2)",
        padding: "60px 24px 40px", display: "flex", flexDirection: "column", gap: "8px",
        boxShadow: "-20px 0 60px rgba(0,0,0,0.5)", overflowY: "auto",
      }}>
        <p style={{
          fontFamily: "'DM Mono', monospace", fontSize: "10px",
          letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)",
          textTransform: "uppercase", marginBottom: "12px",
        }}>Filter by Category</p>
        {CATEGORIES.map(cat => {
          const count = cat === "All" ? apps.length : apps.filter(a => a.category === cat).length;
          const active = activeCategory === cat;
          return (
            <button key={cat} onClick={() => { setActiveCategory(cat); onClose(); }} style={{
              background: active ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.03)",
              border: active ? "1px solid rgba(139,92,246,0.5)" : "1px solid rgba(255,255,255,0.07)",
              borderRadius: "10px", padding: "13px 16px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              cursor: "pointer", transition: "all 0.15s ease",
            }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: active ? 600 : 400, fontSize: "14px", color: active ? "#a78bfa" : "rgba(255,255,255,0.6)" }}>{cat}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: active ? "#a78bfa" : "rgba(255,255,255,0.25)", background: active ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "20px" }}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function AppVault() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [fabPressed, setFabPressed] = useState(false);
  const [editApp, setEditApp] = useState(null);

  // ── Firestore real-time listener ────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, "apps"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        // First run — seed sample data
        await seedSampleApps();
      } else {
        setApps(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    }, (err) => {
      console.error("Firestore error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const seedSampleApps = async () => {
    const batch = writeBatch(db);
    SAMPLE_APPS.forEach(app => {
      const ref = doc(collection(db, "apps"));
      batch.set(ref, { ...app, createdAt: serverTimestamp() });
    });
    await batch.commit();
    // snapshot listener will fire again and populate state
  };

  // ── CRUD operations ─────────────────────────────────────────────────────────
  const handleAdd = useCallback(async (appData) => {
    await addDoc(collection(db, "apps"), { ...appData, createdAt: serverTimestamp() });
  }, []);

  const handleDelete = useCallback(async (id) => {
    await deleteDoc(doc(db, "apps", id));
  }, []);

  const handleSave = useCallback(async (updated) => {
    const { id, ...data } = updated;
    await updateDoc(doc(db, "apps", id), { ...data, updatedAt: serverTimestamp() });
  }, []);

  // ── Filtering ───────────────────────────────────────────────────────────────
  const uniqueCategories = [...new Set(apps.map(a => a.category))].length;

  const filtered = useMemo(() => apps.filter(app => {
    return activeCategory === "All" || app.category === activeCategory;
  }), [apps, activeCategory]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;700&family=Outfit:wght@500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        html, body { background: #090a14; overscroll-behavior: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.3); border-radius: 2px; }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.22); }
        input:focus, textarea:focus, select:focus { border-color: rgba(139,92,246,0.5) !important; }
        select option { background: #1a1c2e; color: #eeeef5; }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fabPulse {
          0%   { box-shadow: 0 6px 24px rgba(139,92,246,0.5); }
          50%  { box-shadow: 0 6px 36px rgba(139,92,246,0.7); }
          100% { box-shadow: 0 6px 24px rgba(139,92,246,0.5); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .app-card {
          animation: fadeSlideUp 0.3s ease both;
          content-visibility: auto;
          contain-intrinsic-size: 250px;
        }

        /* ── Responsive layout ── */
        .vault-header-inner {
          max-width: 600px; margin: 0 auto;
          height: 60px; display: flex; align-items: center;
          justify-content: space-between; gap: 12px;
        }
        .vault-main { padding: 20px; max-width: 600px; margin: 0 auto; }
        .vault-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }

        @media (min-width: 640px) {
          .vault-header-inner { max-width: 960px; }
          .vault-main { max-width: 960px; padding: 24px 32px; }
          .vault-grid { grid-template-columns: 1fr 1fr; gap: 16px; }
        }
        @media (min-width: 1100px) {
          .vault-header-inner { max-width: 1280px; }
          .vault-main { max-width: 1280px; padding: 28px 48px; }
          .vault-grid { grid-template-columns: 1fr 1fr 1fr; gap: 18px; }
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 30% 0%, rgba(139,92,246,0.1) 0%, transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(16,185,129,0.05) 0%, transparent 50%), #090a14",
        color: "#eeeef5", fontFamily: "'DM Sans', sans-serif", paddingBottom: "100px",
      }}>

        {/* ── Header ── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(9,10,20,0.85)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          padding: "calc(env(safe-area-inset-top) + 8px) 20px 0",
        }}>
          <div className="vault-header-inner">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
              <VaultLogo size={34} />
              <div style={{ fontFamily: "'Outfit', 'DM Sans', sans-serif", fontWeight: 600, fontSize: "17px", color: "#eeeef5", letterSpacing: "0.02em", lineHeight: 1.1 }}>App Vault</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button onClick={() => setShowMenu(true)} style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px", width: "38px", height: "38px",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexDirection: "column", gap: "4px",
              }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: i === 1 ? "12px" : "16px", height: "2px", background: "rgba(255,255,255,0.5)", borderRadius: "1px" }} />
                ))}
              </button>
            </div>
          </div>
        </div>

        {/* ── Main ── */}
        <div className="vault-main">

          {/* Active filter pill */}
          {activeCategory !== "All" && (
            <div style={{ marginBottom: "16px" }}>
              <span style={{
                background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.35)",
                color: "#a78bfa", fontFamily: "'DM Mono', monospace", fontSize: "11px",
                fontWeight: 700, padding: "5px 12px", borderRadius: "20px",
                display: "inline-flex", alignItems: "center", gap: "8px",
              }}>
                {activeCategory}
                <span onClick={() => setActiveCategory("All")} style={{ cursor: "pointer", opacity: 0.7 }}>✕</span>
              </span>
            </div>
          )}

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
            {[{ label: "Total Apps", value: apps.length, icon: "⚡" }, { label: "Categories", value: uniqueCategories, icon: "🗂" }].map(s => (
              <div key={s.label} style={{
                background: "linear-gradient(160deg, rgba(25,27,44,0.9), rgba(15,17,32,0.9))",
                border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "18px 16px",
                display: "flex", flexDirection: "column", gap: "4px",
              }}>
                <span style={{ fontSize: "18px" }}>{s.icon}</span>
                <span style={{ fontFamily: "'Outfit', 'DM Sans', sans-serif", fontWeight: 600, fontSize: "28px", color: "#a78bfa", lineHeight: 1 }}>{s.value}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Results label */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <span style={{ fontFamily: "'Outfit', 'DM Sans', sans-serif", fontWeight: 600, fontSize: "16px", color: "rgba(255,255,255,0.7)", letterSpacing: "0.01em" }}>
              {activeCategory === "All" ? "All Apps" : activeCategory}
            </span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>{filtered.length} apps</span>
          </div>

          {/* Loading state */}
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
              <div style={{ width: "32px", height: "32px", border: "3px solid rgba(139,92,246,0.2)", borderTopColor: "#8b5cf6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>
              No apps found.{" "}
              <span style={{ color: "#8b5cf6", cursor: "pointer" }} onClick={() => setShowModal(true)}>Add one →</span>
            </div>
          ) : (
            <div className="vault-grid">
              {filtered.map((app, i) => (
                <div key={app.id} className="app-card" style={{ animationDelay: `${i * 0.05}s` }}>
                  <AppCard app={app} onDelete={handleDelete} onEdit={setEditApp} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FAB */}
        <button
          onClick={() => setShowModal(true)}
          onMouseDown={() => setFabPressed(true)} onMouseUp={() => setFabPressed(false)}
          onTouchStart={() => setFabPressed(true)} onTouchEnd={() => setFabPressed(false)}
          style={{
            position: "fixed", bottom: "calc(env(safe-area-inset-bottom) + 20px)", right: "24px",
            width: "58px", height: "58px", borderRadius: "50%",
            background: "linear-gradient(135deg, #7c3aed, #8b5cf6)", border: "none",
            color: "#fff", fontSize: "26px", fontWeight: 300,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", zIndex: 100,
            transform: fabPressed ? "scale(0.92)" : "scale(1)",
            transition: "transform 0.15s ease",
            animation: "fabPulse 3s ease-in-out infinite",
            boxShadow: "0 6px 24px rgba(139,92,246,0.5)",
          }}
        >+</button>
      </div>

      {showMenu && <HamburgerMenu activeCategory={activeCategory} setActiveCategory={setActiveCategory} onClose={() => setShowMenu(false)} apps={apps} />}
      {showModal && <AddModal onClose={() => setShowModal(false)} onAdd={handleAdd} />}
      {editApp && <EditModal app={editApp} onClose={() => setEditApp(null)} onSave={handleSave} />}
    </>
  );
}

