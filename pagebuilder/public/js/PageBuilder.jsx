import React, { useState, useEffect, useRef } from "react";

// ─── UTILS ────────────────────────────────────────────────────────────────────

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const renderTheme = (theme, settings) => {
  try {
    if (theme.type === "custom") {
      let html = theme.htmlSource || "";
      (theme.schema || []).forEach(f => {
        if (!f.key) return;
        const val = settings[f.key] ?? f.default ?? "";
        html = html.replaceAll(`{{${f.key}}}`, val);
      });
      return html;
    }
    return theme.render ? theme.render(settings) : "";
  } catch { return "<p style='color:red;padding:20px'>Preview error</p>"; }
};

// ─── FRAPPE API ───────────────────────────────────────────────────────────────

const frappeCall = (method, args = {}) => new Promise((resolve, reject) => {
  const csrf = window.csrf_token ||
    document.cookie.split(";").find(c => c.trim().startsWith("csrf_token="))?.split("=")[1]?.trim() || "";

  const body = new URLSearchParams();
  Object.entries(args).forEach(([k, v]) => body.append(k, typeof v === "object" ? JSON.stringify(v) : v));

  fetch(`/api/method/pagebuilder.api.${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Frappe-CSRF-Token": csrf },
    body: body.toString(),
  }).then(r => r.json()).then(d => {
    if (d.exc) reject(new Error(d.exc_type || "API Error"));
    else resolve(d.message);
  }).catch(reject);
});

const loadPages = async () => {
  try {
    const pages = await frappeCall("get_pages");
    return (pages || []).map(p => ({
      id: p.name,
      name: p.page_name || p.name,
      route: p.route,
      published: !!p.published,
      themeId: p.theme_id || "",
      settings: typeof p.settings === "string" ? JSON.parse(p.settings || "{}") : (p.settings || {}),
    }));
  } catch (e) { console.error("loadPages", e); return []; }
};

const savePage = async (page) => {
  try {
    return await frappeCall("save_page", {
      name: page.id || "",
      route: page.route,
      published: page.published ? 1 : 0,
      theme_id: page.themeId || "",
      settings: JSON.stringify(page.settings || {}),
      page_name: page.name || page.route,
    });
  } catch (e) { console.error("savePage", e); throw e; }
};

const deletePageAPI = async (name) => {
  try { await frappeCall("delete_page", { name }); } catch (e) { console.error(e); }
};

const loadCustomThemes = async () => {
  try { return await frappeCall("get_custom_themes") || []; } catch { return []; }
};

const saveCustomThemeAPI = async (theme) => {
  try {
    const { render, ...saveable } = theme;
    await frappeCall("save_custom_theme", { theme_id: theme.id, theme_data: JSON.stringify(saveable) });
  } catch (e) { console.error("saveCustomTheme", e); }
};

const deleteCustomThemeAPI = async (id) => {
  try { await frappeCall("delete_custom_theme", { theme_id: id }); } catch (e) { console.error(e); }
};

// ─── ICONS ────────────────────────────────────────────────────────────────────

const Ic = ({ n, s = 16 }) => {
  const d = {
    plus: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    edit: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    trash: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>,
    eye: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    copy: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
    check: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 16 4 11"/></svg>,
    x: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    chevR: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>,
    chevL: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>,
    layers: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    image: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
    upload: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>,
    search: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    sparkle: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>,
    code: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    zip: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    info: <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  };
  return d[n] || null;
};

// ─── STYLES ───────────────────────────────────────────────────────────────────

const IB = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" };

// ─── FIELD COMPONENTS ────────────────────────────────────────────────────────

const Toggle = ({ value, onChange }) => (
  <div onClick={() => onChange(!value)} style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", background: value ? "#6c63ff" : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s" }}>
    <div style={{ position: "absolute", top: 3, left: value ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
  </div>
);

const ImageField = ({ value, onChange }) => {
  const ref = useRef();
  const [uploading, setUploading] = React.useState(false);
  const handleFile = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    setUploading(true);
    try {
      const csrf = window.csrf_token || document.cookie.split(";").find(c=>c.trim().startsWith("csrf_token="))?.split("=")[1]?.trim()||"";
      const fd = new FormData();
      fd.append("file", f, f.name); fd.append("is_private","0"); fd.append("folder","Home/Attachments");
      const res = await fetch("/api/method/upload_file",{method:"POST",headers:{"X-Frappe-CSRF-Token":csrf},body:fd});
      const data = await res.json();
      const url = data?.message?.file_url;
      if (url) onChange(url); else alert("Upload failed");
    } catch(err){ alert("Upload error: "+err.message); }
    finally { setUploading(false); if(ref.current) ref.current.value=""; }
  };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input ref={ref} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleFile} />
      {value && !value.startsWith("data:") ? <img src={value} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }} /> : <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "#555" }}><Ic n="image" s={18} /></div>}
      <button onClick={() => ref.current.click()} disabled={uploading} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: uploading?"#888":"#ccc", padding: "7px 13px", cursor: uploading?"wait":"pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><Ic n="upload" s={12} /> {uploading?"Uploading...":"Upload"}</button>
      {value && <button onClick={() => onChange("")} style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer" }}><Ic n="x" s={14} /></button>}
    </div>
  );
};

const LinksField = ({ value = [], onChange }) => {
  const opts = ["instagram", "linkedin", "twitter", "facebook", "whatsapp", "github", "youtube", "tiktok", "link"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {value.map((lk, i) => (
        <div key={i} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", padding: 10 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <select value={lk.icon} onChange={e => onChange(value.map((l, idx) => idx === i ? { ...l, icon: e.target.value } : l))} style={{ ...IB, flex: 1, padding: "5px 7px", fontSize: 12 }}>
              {opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <button onClick={() => onChange(value.filter((_, idx) => idx !== i))} style={{ background: "rgba(255,60,60,0.15)", border: "none", borderRadius: 7, color: "#ff6b6b", padding: "5px 9px", cursor: "pointer" }}><Ic n="x" s={13} /></button>
          </div>
          <input placeholder="Label" value={lk.label} onChange={e => onChange(value.map((l, idx) => idx === i ? { ...l, label: e.target.value } : l))} style={{ ...IB, marginBottom: 5, padding: "6px 10px" }} />
          <input placeholder="URL" value={lk.url} onChange={e => onChange(value.map((l, idx) => idx === i ? { ...l, url: e.target.value } : l))} style={{ ...IB, padding: "6px 10px" }} />
        </div>
      ))}
      <button onClick={() => onChange([...value, { icon: "link", label: "", url: "" }])} style={{ background: "rgba(108,99,255,0.1)", border: "1px dashed rgba(108,99,255,0.3)", borderRadius: 8, color: "#a09aff", padding: 9, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
        <Ic n="plus" s={13} /> Add Link
      </button>
    </div>
  );
};

// ─── SETTINGS FORM ───────────────────────────────────────────────────────────

const SettingsForm = ({ schema, settings, onChange }) => {
  const upd = (k, v) => onChange({ ...settings, [k]: v });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {(schema || []).map((f, i) => {
        if (f.section) return (
          <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#5a5a8a", padding: "16px 0 8px", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none", marginTop: i > 0 ? 8 : 0 }}>
            {f.section}
          </div>
        );
        const val = settings[f.key] ?? f.default ?? "";
        return (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6, fontWeight: 500 }}>{f.label}</label>
            {f.type === "text" && <input value={val} placeholder={f.placeholder || ""} onChange={e => upd(f.key, e.target.value)} style={IB} />}
            {f.type === "textarea" && <textarea value={val} placeholder={f.placeholder || ""} onChange={e => upd(f.key, e.target.value)} rows={3} style={{ ...IB, resize: "vertical" }} />}
            {f.type === "color" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: val || "#000", border: "2px solid rgba(255,255,255,0.2)", cursor: "pointer", position: "relative", overflow: "hidden" }}>
                  <input type="color" value={val || "#000000"} onChange={e => upd(f.key, e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
                </div>
                <input value={val} onChange={e => upd(f.key, e.target.value)} style={{ ...IB, flex: 1 }} />
              </div>
            )}
            {f.type === "image" && <ImageField value={val} onChange={v => upd(f.key, v)} />}
            {f.type === "toggle" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "#666" }}>{val ? "On" : "Off"}</span>
                <Toggle value={!!val} onChange={v => upd(f.key, v)} />
              </div>
            )}
            {f.type === "select" && <select value={val} onChange={e => upd(f.key, e.target.value)} style={{...IB, padding:"7px 10px"}}>{(f.options||[]).map(o => <option key={o} value={o} style={{background:"#1a1a2e",color:"#fff"}}>{o}</option>)}</select>}
            {f.type === "links" && <LinksField value={val || []} onChange={v => upd(f.key, v)} />}
            {f.type === "grid-images" && <GridImagesField value={val} onChange={v => upd(f.key, v)} />}
          </div>
        );
      })}
    </div>
  );
};

// ─── LIVE PREVIEW ─────────────────────────────────────────────────────────────

const LivePreview = ({ theme, settings }) => (
  <iframe srcDoc={theme ? renderTheme(theme, settings) : ""} title="preview" sandbox="allow-scripts" style={{ width: "100%", height: "100%", border: "none", background: "#0f0f1a" }} />
);

// ─── THEME CREATOR ───────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: "text", label: "Text" }, { value: "textarea", label: "Long Text" },
  { value: "color", label: "Color" }, { value: "image", label: "Image" },
  { value: "toggle", label: "Toggle" }, { value: "links", label: "Links" },
];

const ThemeCreator = ({ onSave, onCancel }) => {
  const [step, setStep] = useState(1);
  const [uploadMode, setUploadMode] = useState("html");
  const [htmlSource, setHtmlSource] = useState("");
  const [themeName, setThemeName] = useState("");
  const [themeDesc, setThemeDesc] = useState("");
  const [themeCategory, setThemeCategory] = useState("NFC Card");
  const [themeColor, setThemeColor] = useState("#6c63ff");
  const [schema, setSchema] = useState([]);
  const [settings, setSettings] = useState({});
  const [zipError, setZipError] = useState("");
  const [saving, setSaving] = useState(false);
  const htmlRef = useRef();
  const zipRef = useRef();

  const placeholders = [...new Set([...htmlSource.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))];

  const handleHTMLFile = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = ev => { setHtmlSource(ev.target.result); setStep(2); }; r.readAsText(f);
  };

  const handleZipFile = async e => {
    const f = e.target.files[0]; if (!f) return; setZipError("");
    try {
      if (!window.JSZip) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      const zip = await window.JSZip.loadAsync(f); const files = Object.keys(zip.files);
      let main = files.find(n => n.match(/^index\.html$/i)) || files.find(n => n.match(/\.html$/i));
      if (!main) { setZipError("No HTML file found."); return; }
      let html = await zip.files[main].async("string");
      for (const cf of files.filter(n => n.match(/\.css$/i))) { const css = await zip.files[cf].async("string"); html = html.replace(new RegExp(`<link[^>]*href=["'][^"']*${cf.split("/").pop()}["'][^>]*>`, "gi"), `<style>${css}</style>`); }
      for (const jf of files.filter(n => n.match(/\.js$/i) && !n.includes("node_modules"))) { const js = await zip.files[jf].async("string"); html = html.replace(new RegExp(`<script[^>]*src=["'][^"']*${jf.split("/").pop()}["'][^>]*></script>`, "gi"), `<script>${js}</script>`); }
      for (const img of files.filter(n => n.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i))) { const ext = img.split(".").pop().toLowerCase(); const mime = ext === "svg" ? "image/svg+xml" : `image/${ext}`; const b64 = await zip.files[img].async("base64"); html = html.replace(new RegExp(`(src|href)=["']([^"']*/)?${img.split("/").pop()}["']`, "g"), `$1="data:${mime};base64,${b64}"`); }
      setHtmlSource(html); setStep(2);
    } catch (err) { setZipError("Failed: " + err.message); }
  };

  const autoGen = () => {
    const existing = schema.map(f => f.key).filter(Boolean);
    setSchema(prev => [...prev, ...placeholders.filter(p => !existing.includes(p)).map(p => {
      const lc = p.toLowerCase(); let type = "text";
      if (lc.includes("color") || lc.includes("bg") || lc.includes("accent")) type = "color";
      if (lc.includes("image") || lc.includes("photo") || lc.includes("logo") || lc.includes("cover")) type = "image";
      if (lc.includes("bio") || lc.includes("description")) type = "textarea";
      return { key: p, type, label: p.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim(), default: "" };
    })]);
  };

  const upd = (i, k, v) => setSchema(prev => prev.map((f, idx) => idx === i ? { ...f, [k]: v } : f));
  const rm = i => setSchema(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    const theme = { id: `custom_${generateId()}`, type: "custom", name: themeName, description: themeDesc, category: themeCategory, color: themeColor, htmlSource, schema, createdAt: Date.now() };
    await saveCustomThemeAPI(theme);
    onSave(theme);
    setSaving(false);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onCancel} style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer" }}><Ic n="chevL" s={20} /></button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Create New Theme</div>
          <div style={{ display: "flex", gap: 0, marginTop: 4 }}>
            {["Upload", "Theme Info", "Schema", "Preview"].map((l, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 10, background: step === i + 1 ? "rgba(108,99,255,0.2)" : "transparent", color: step === i + 1 ? "#a09aff" : step > i + 1 ? "#6c63ff" : "#444" }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, background: step > i + 1 ? "#6c63ff" : step === i + 1 ? "rgba(108,99,255,0.3)" : "rgba(255,255,255,0.04)", color: step > i + 1 ? "#fff" : step === i + 1 ? "#a09aff" : "#444" }}>
                    {step > i + 1 ? <Ic n="check" s={8} /> : i + 1}
                  </div>{l}
                </div>
                {i < 3 && <div style={{ width: 10, height: 1, background: "rgba(255,255,255,0.07)" }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {step === 1 && (
          <div style={{ padding: "28px 32px", maxWidth: 560 }}>
            <div style={{ display: "flex", gap: 0, marginBottom: 20, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 3 }}>
              {[["html", "Single HTML", <Ic n="code" s={13} />], ["zip", "ZIP Project", <Ic n="zip" s={13} />], ["paste", "Paste HTML", <Ic n="info" s={13} />]].map(([m, l, ic]) => (
                <button key={m} onClick={() => setUploadMode(m)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: uploadMode === m ? "rgba(108,99,255,0.25)" : "transparent", color: uploadMode === m ? "#a09aff" : "#555", cursor: "pointer", fontSize: 12, fontWeight: uploadMode === m ? 600 : 400, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>{ic}{l}</button>
              ))}
            </div>
            {uploadMode === "html" && (
              <div>
                <input ref={htmlRef} type="file" accept=".html,.htm" style={{ display: "none" }} onChange={handleHTMLFile} />
                <div onClick={() => htmlRef.current.click()} style={{ border: "2px dashed rgba(108,99,255,0.3)", borderRadius: 14, padding: "44px 20px", textAlign: "center", cursor: "pointer", background: "rgba(108,99,255,0.04)" }} onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(108,99,255,0.6)"} onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(108,99,255,0.3)"}>
                  <div style={{ color: "#6c63ff", marginBottom: 10 }}><Ic n="upload" s={32} /></div>
                  <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 5 }}>Click to upload HTML file</div>
                  <div style={{ color: "#555", fontSize: 12 }}>.html or .htm</div>
                </div>
              </div>
            )}
            {uploadMode === "zip" && (
              <div>
                <input ref={zipRef} type="file" accept=".zip" style={{ display: "none" }} onChange={handleZipFile} />
                <div onClick={() => zipRef.current.click()} style={{ border: "2px dashed rgba(255,165,0,0.3)", borderRadius: 14, padding: "44px 20px", textAlign: "center", cursor: "pointer", background: "rgba(255,165,0,0.04)" }} onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,165,0,0.6)"} onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,165,0,0.3)"}>
                  <div style={{ color: "#ffa500", marginBottom: 10 }}><Ic n="zip" s={32} /></div>
                  <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 5 }}>Click to upload ZIP</div>
                  <div style={{ color: "#555", fontSize: 12 }}>CSS, JS & images auto-inlined</div>
                </div>
                {zipError && <div style={{ marginTop: 10, padding: "9px 12px", background: "rgba(255,60,60,0.1)", borderRadius: 8, color: "#ff6b6b", fontSize: 12 }}>{zipError}</div>}
              </div>
            )}
            {uploadMode === "paste" && (
              <div>
                <textarea value={htmlSource} onChange={e => setHtmlSource(e.target.value)} placeholder={"<!DOCTYPE html>\n<html>\n  <body style=\"background:{{bgColor}}\">\n    <h1>{{name}}</h1>\n  </body>\n</html>"} rows={12} style={{ ...IB, fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, resize: "vertical" }} />
                <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(108,99,255,0.06)", borderRadius: 8, fontSize: 11, color: "#7a74cc" }}>Use <code style={{ background: "rgba(255,255,255,0.08)", padding: "1px 4px", borderRadius: 3 }}>{"{{key}}"}</code> for editable parts</div>
              </div>
            )}
            {htmlSource && <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 8, display: "flex", alignItems: "center", gap: 6 }}><Ic n="check" s={12} /><span style={{ color: "#34d399", fontSize: 12 }}>Loaded — {placeholders.length} placeholder{placeholders.length !== 1 ? "s" : ""}</span></div>}
            {htmlSource && <button onClick={() => setStep(2)} style={{ marginTop: 14, background: "#6c63ff", border: "none", borderRadius: 10, color: "#fff", padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>Next <Ic n="chevR" s={14} /></button>}
          </div>
        )}

        {step === 2 && (
          <div style={{ padding: "28px 32px", maxWidth: 440 }}>
            {[["Theme Name *", themeName, setThemeName, "e.g. Modern NFC Card"], ["Description", themeDesc, setThemeDesc, "Short description"], ["Category", themeCategory, setThemeCategory, "NFC Card, Landing Page..."]].map(([l, v, setter, ph]) => (
              <div key={l} style={{ marginBottom: 16 }}><label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>{l}</label><input value={v} onChange={e => setter(e.target.value)} placeholder={ph} style={IB} /></div>
            ))}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>Accent Color</label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: themeColor, border: "2px solid rgba(255,255,255,0.2)", cursor: "pointer", position: "relative", overflow: "hidden" }}><input type="color" value={themeColor} onChange={e => setThemeColor(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} /></div>
                <input value={themeColor} onChange={e => setThemeColor(e.target.value)} style={{ ...IB, flex: 1 }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, color: "#aaa", padding: "9px 18px", fontSize: 13, cursor: "pointer" }}>Back</button>
              <button onClick={() => { autoGen(); setStep(3); }} disabled={!themeName} style={{ background: "#6c63ff", border: "none", borderRadius: 9, color: "#fff", padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: themeName ? "pointer" : "not-allowed", opacity: themeName ? 1 : 0.4 }}>Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ padding: "20px 28px", display: "flex", gap: 20, maxWidth: 860 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Settings Fields</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setSchema(prev => [...prev, { section: "New Section" }])} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 7, color: "#888", padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>+ Section</button>
                  <button onClick={() => setSchema(prev => [...prev, { key: "", type: "text", label: "", default: "" }])} style={{ background: "rgba(108,99,255,0.15)", border: "1px solid rgba(108,99,255,0.25)", borderRadius: 7, color: "#a09aff", padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>+ Field</button>
                </div>
              </div>
              {placeholders.length > 0 && <div style={{ padding: "8px 12px", background: "rgba(255,165,0,0.06)", border: "1px solid rgba(255,165,0,0.2)", borderRadius: 8, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><div style={{ fontSize: 11, color: "#ffa500" }}>Found: {placeholders.map(p => `{{${p}}}`).join(", ")}</div><button onClick={autoGen} style={{ background: "rgba(255,165,0,0.2)", border: "1px solid rgba(255,165,0,0.3)", borderRadius: 6, color: "#ffa500", padding: "3px 9px", cursor: "pointer", fontSize: 11 }}>Auto-add</button></div>}
              {schema.length === 0 && <div style={{ textAlign: "center", padding: "30px 0", color: "#444", fontSize: 13 }}>No fields yet. Click "+ Field" or "Auto-add"</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {schema.map((f, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "9px 11px" }}>
                    {f.section !== undefined ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><input value={f.section} onChange={e => upd(i, "section", e.target.value)} placeholder="Section Name" style={{ ...IB, flex: 1, fontSize: 12, fontWeight: 600, padding: "5px 9px" }} /><button onClick={() => rm(i)} style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer" }}><Ic n="x" s={12} /></button></div>
                    ) : (
                      <div>
                        <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                          <input value={f.label} onChange={e => upd(i, "label", e.target.value)} placeholder="Label" style={{ ...IB, flex: 1, padding: "5px 9px" }} />
                          <select value={f.type} onChange={e => upd(i, "type", e.target.value)} style={{ ...IB, padding: "5px 7px", fontSize: 11 }}>{FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
                          <button onClick={() => rm(i)} style={{ background: "rgba(255,60,60,0.1)", border: "none", borderRadius: 6, color: "#ff6b6b", padding: "5px 7px", cursor: "pointer" }}><Ic n="x" s={11} /></button>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <div style={{ flex: 1 }}><div style={{ fontSize: 9, color: "#555", marginBottom: 2 }}>Key ({"{{key}}"})</div><input value={f.key} onChange={e => upd(i, "key", e.target.value)} placeholder="variableName" style={{ ...IB, fontFamily: "monospace", fontSize: 11, padding: "4px 8px" }} /></div>
                          {!["image", "toggle", "links"].includes(f.type) && <div style={{ flex: 1 }}><div style={{ fontSize: 9, color: "#555", marginBottom: 2 }}>Default</div><input value={f.default || ""} onChange={e => upd(i, "default", e.target.value)} placeholder="Default..." style={{ ...IB, fontSize: 11, padding: "4px 8px" }} /></div>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => setStep(2)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, color: "#aaa", padding: "9px 18px", fontSize: 13, cursor: "pointer" }}>Back</button>
                <button onClick={() => { const init = {}; schema.forEach(f => { if (f.key) init[f.key] = f.default || ""; }); setSettings(init); setStep(4); }} style={{ background: "#6c63ff", border: "none", borderRadius: 9, color: "#fff", padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Preview & Save</button>
              </div>
            </div>
            <div style={{ width: 180 }}>
              <div style={{ fontSize: 10, color: "#555", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>Placeholders</div>
              {placeholders.map(p => <div key={p} style={{ fontFamily: "monospace", fontSize: 10, color: "#ffa500", background: "rgba(255,165,0,0.06)", border: "1px solid rgba(255,165,0,0.15)", borderRadius: 5, padding: "2px 7px", marginBottom: 3 }}>{`{{${p}}}`}</div>)}
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ display: "flex", height: "calc(100vh - 110px)", overflow: "hidden" }}>
            <div style={{ width: 280, borderRight: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", padding: "16px" }}>
              <div style={{ fontSize: 10, color: "#6c63ff", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Test Settings</div>
              <SettingsForm schema={schema} settings={settings} onChange={setSettings} />
              <div style={{ marginTop: 20, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={handleSave} disabled={saving} style={{ background: "#6c63ff", border: "none", borderRadius: 10, color: "#fff", padding: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" }}>{saving ? "Saving..." : "Save Theme"}</button>
                <button onClick={() => setStep(3)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#aaa", padding: 10, fontSize: 12, cursor: "pointer" }}>Back</button>
              </div>
            </div>
            <div style={{ flex: 1, background: "#080812", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 10, color: "#444" }}>Live Preview</div>
              <div style={{ flex: 1 }}><LivePreview theme={{ type: "custom", htmlSource, schema }} settings={settings} /></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── THEME SELECTOR ──────────────────────────────────────────────────────────

const ThemeSelector = ({ allThemes, selected, onSelect, onCreateTheme }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
    {allThemes.map(theme => (
      <div key={theme.id} onClick={() => onSelect(theme)} style={{ borderRadius: 12, overflow: "hidden", cursor: "pointer", border: selected?.id === theme.id ? `2px solid ${theme.color}` : "2px solid rgba(255,255,255,0.06)", transition: "all 0.2s", background: "rgba(255,255,255,0.03)" }}>
        <div style={{ height: 110, background: `linear-gradient(135deg,${theme.color}33,#0f0f1a)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div style={{ width: 58, height: 76, background: "rgba(255,255,255,0.05)", borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: theme.color + "66" }} />
            <div style={{ width: 34, height: 3, background: "rgba(255,255,255,0.2)", borderRadius: 3 }} />
            <div style={{ width: 28, height: 2.5, background: "rgba(255,255,255,0.1)", borderRadius: 3 }} />
            <div style={{ width: 40, height: 10, background: theme.color + "44", borderRadius: 4 }} />
          </div>
          {theme.type === "custom" && <div style={{ position: "absolute", top: 7, right: 7, background: "rgba(255,165,0,0.2)", border: "1px solid rgba(255,165,0,0.3)", borderRadius: 5, padding: "1px 6px", fontSize: 8, color: "#ffa500", fontWeight: 700 }}>CUSTOM</div>}
        </div>
        <div style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 9, color: theme.color, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>{theme.category}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{theme.name}</div>
          <div style={{ fontSize: 11, color: "#555" }}>{theme.description}</div>
        </div>
        {selected?.id === theme.id && <div style={{ background: theme.color, padding: "5px 12px", fontSize: 10, color: "#fff", fontWeight: 600, textAlign: "center" }}>✓ Selected</div>}
      </div>
    ))}
    <div onClick={onCreateTheme} style={{ borderRadius: 12, border: "2px dashed rgba(108,99,255,0.25)", minHeight: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", background: "rgba(108,99,255,0.03)", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(108,99,255,0.55)"; e.currentTarget.style.background = "rgba(108,99,255,0.09)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(108,99,255,0.25)"; e.currentTarget.style.background = "rgba(108,99,255,0.03)"; }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(108,99,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6c63ff" }}><Ic n="plus" s={20} /></div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#6c63ff" }}>Add Theme</div>
      <div style={{ fontSize: 11, color: "#555", textAlign: "center", padding: "0 12px" }}>Upload .html or .zip</div>
    </div>
  </div>
);

// ─── TABBED CUSTOMIZE PANEL ──────────────────────────────────────────────────

const TAB_DEFS = [
  {
    id: "profile",
    label: "Profile",
    icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    keywords: ["personal", "profile", "info", "name", "title", "bio", "footer", "services", "copyright"],
  },
  {
    id: "theme",
    label: "Theme",
    icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>,
    keywords: ["appearance", "theme", "color", "bg", "accent", "text", "button", "style", "font", "typography", "quick", "background"],
  },
  {
    id: "links",
    label: "Links",
    icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
    keywords: ["social", "links", "link", "instagram", "facebook", "twitter", "contact", "phone", "whatsapp", "email", "vcf", "website", "location", "calendly", "google", "review", "url"],
  },
  {
    id: "media",
    label: "Media",
    icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
    keywords: ["media", "image", "photo", "cover", "logo", "gif", "banner", "slider", "gallery"],
  },
  
];

const getTabForSection = (sectionName) => {
  const lower = (sectionName || "").toLowerCase();
  for (const tab of TAB_DEFS) {
    if (tab.keywords.some(kw => lower.includes(kw))) return tab.id;
  }
  return "profile";
};

const getTabForField = (field) => {
  const lower = (field.key || field.label || "").toLowerCase();
  for (const tab of TAB_DEFS) {
    if (tab.keywords.some(kw => lower.includes(kw))) return tab.id;
  }
  return null;
};

const buildTabGroups = (schema) => {
  const groups = { profile: [], theme: [], links: [], media: [], layout: [] };
  let currentTab = "profile";
  let currentSection = null;

  (schema || []).forEach(f => {
    if (f.section) {
      const tab = getTabForSection(f.section);
      currentTab = tab;
      currentSection = f.section;
      if (!groups[currentTab]) groups[currentTab] = [];
      groups[currentTab].push({ ...f, _isSection: true });
    } else if (f.key) {
      const fieldTab = getTabForField(f);
      const tab = fieldTab || currentTab;
      if (!groups[tab]) groups[tab] = [];
      // Add section header if switching context
      groups[tab].push(f);
    }
  });
  return groups;
};

const GridImagesField = ({ value, onChange }) => {
  const images = value ? value.split(',').filter(Boolean) : [];
  const fileRef = React.useRef();
  const [uploading, setUploading] = React.useState(false);
  const removeImg = (i) => onChange(images.filter((_,idx)=>idx!==i).join(','));
  const handleFile = async (e) => {
    const file = e.target.files[0]; if(!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('is_private', 0);
      const r = await fetch('/api/method/upload_file', {method:'POST', headers:{'X-Frappe-CSRF-Token': window.csrf_token||''}, body:fd});
      const d = await r.json();
      const url = d.message?.file_url;
      if(url) onChange([...images, url].join(','));
    } catch(err){ alert('Upload error: '+err.message); }
    finally { setUploading(false); if(fileRef.current) fileRef.current.value=''; }
  };
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:8 }}>
        {images.map((src,i) => (
          <div key={i} style={{ position:'relative', aspectRatio:'1/1', borderRadius:6, overflow:'hidden', border:'1px solid rgba(255,255,255,0.1)' }}>
            <img src={src} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            <button onClick={()=>removeImg(i)} style={{ position:'absolute', top:2, right:2, background:'rgba(255,0,0,0.7)', border:'none', borderRadius:'50%', width:18, height:18, color:'#fff', fontSize:10, cursor:'pointer' }}>×</button>
          </div>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFile} />
      <button onClick={()=>fileRef.current.click()} disabled={uploading} style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:8, color:uploading?'#888':'#ccc', padding:'7px 13px', cursor:'pointer', fontSize:12 }}>{uploading?'Uploading...':'+ Add Image'}</button>
      <div style={{ fontSize:11, color:'#555', marginTop:4 }}>{images.length} image{images.length!==1?'s':''} added</div>
    </div>
  );
};

const TabbedCustomizePanel = ({ selectedTheme, settings, setSettings, isEdit, saving, saveError, onBack, onSave }) => {
  const [activeTab, setActiveTab] = useState("profile");
  const [viewMode, setViewMode] = useState("mobile");

  const schema = selectedTheme.schema || [];
  const tabGroups = buildTabGroups(schema);

  // Find first tab that has fields
  const tabsWithFields = TAB_DEFS.filter(t => (tabGroups[t.id] || []).length > 0);
  const firstTab = tabsWithFields[0]?.id || "profile";
  const currentFields = tabGroups[activeTab] || [];

  const renderField = (f, i) => {
    if (f._isSection) return (
      <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#5a5a8a", padding: "14px 0 8px", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none", marginTop: i > 0 ? 6 : 0, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
        {f.section}
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
      </div>
    );

    const val = settings[f.key] ?? f.default ?? "";
    const upd = v => setSettings(prev => ({ ...prev, [f.key]: v }));

    return (
      <div key={f.key || i} style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6, fontWeight: 500 }}>{f.label}</label>
        {f.type === "text" && <input value={val} placeholder={f.placeholder || ""} onChange={e => upd(e.target.value)} style={IB} />}
        {f.type === "textarea" && <textarea value={val} placeholder={f.placeholder || ""} onChange={e => upd(e.target.value)} rows={3} style={{ ...IB, resize: "vertical" }} />}
        {f.type === "color" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: val || "#000", border: "2px solid rgba(255,255,255,0.15)", cursor: "pointer", position: "relative", overflow: "hidden", flexShrink: 0 }}>
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(val) ? val : "#000000"} onChange={e => upd(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }} />
            </div>
            <input value={val} onChange={e => upd(e.target.value)} style={{ ...IB, flex: 1 }} />
          </div>
        )}
        {f.type === "image" && <ImageField value={val} onChange={upd} />}
        {f.type === "toggle" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ fontSize: 13, color: val ? "#fff" : "#666" }}>{val ? "Enabled" : "Disabled"}</span>
            <Toggle value={!!val} onChange={upd} />
          </div>
        )}
        {f.type === "select" && <select value={val} onChange={e => upd(e.target.value)} style={{...IB, padding:"7px 10px"}}>{(f.options||[]).map(o => <option key={o} value={o} style={{background:"#1a1a2e",color:"#fff"}}>{o}</option>)}</select>}
        {f.type === "links" && <LinksField value={val || []} onChange={upd} />}
        {f.type === "grid-images" && <GridImagesField value={val} onChange={upd} />}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* Left: Tabbed Settings */}
      <div style={{ width: 320, borderRight: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", background: "#0d0d1a" }}>

        {/* Header */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#888" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Card Settings</span>
          </div>
          <span style={{ fontSize: 10, color: selectedTheme.color, fontWeight: 600, background: selectedTheme.color + "22", padding: "2px 8px", borderRadius: 10 }}>{selectedTheme.name}</span>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex" }}>
            {TAB_DEFS.map(tab => {
              const hasFields = (tabGroups[tab.id] || []).length > 0;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: "10px 4px 8px", border: "none", background: "transparent", color: isActive ? "#fff" : hasFields ? "#555" : "#333", cursor: hasFields ? "pointer" : "default", borderBottom: isActive ? `2px solid ${selectedTheme.color || "#6c63ff"}` : "2px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 10, fontWeight: isActive ? 600 : 400, transition: "all 0.15s" }}>
                  <span style={{ color: isActive ? (selectedTheme.color || "#6c63ff") : hasFields ? "#555" : "#333" }}>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
          {currentFields.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#444", fontSize: 12 }}>
              No settings in this tab.<br />
              <span style={{ fontSize: 11, color: "#333" }}>Add fields to the theme schema</span>
            </div>
          ) : (
            currentFields.map((f, i) => renderField(f, i))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          {!isEdit && <button onClick={onBack} style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}><Ic n="chevL" s={11} /> Change Theme</button>}
          {saveError && <div style={{ marginBottom: 8, padding: "7px 10px", background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.2)", borderRadius: 7, color: "#ff6b6b", fontSize: 11 }}>{saveError}</div>}
          <button onClick={onSave} disabled={saving} style={{ background: "#6c63ff", border: "none", borderRadius: 10, color: "#fff", padding: 12, fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" }}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Page"}
          </button>
        </div>
      </div>

      {/* Right: Preview */}
      <div style={{ flex: 1, background: "#080812", display: "flex", flexDirection: "column" }}>
        {/* Preview toolbar */}
        <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, color: "#aaa", display: "flex", alignItems: "center", gap: 6 }}>
            <Ic n="eye" s={13} /> Live Preview
            <span style={{ fontSize: 10, color: "#444" }}>— Changes apply instantly</span>
          </div>
          <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 7, padding: 2 }}>
            {[["mobile", <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>],
              ["tablet", <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>],
              ["wide", <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>]
            ].map(([m, ic]) => (
              <button key={m} onClick={() => setViewMode(m)} style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: viewMode === m ? "rgba(108,99,255,0.25)" : "transparent", color: viewMode === m ? "#a09aff" : "#555", cursor: "pointer", fontSize: 10, fontWeight: viewMode === m ? 600 : 400, display: "flex", alignItems: "center", gap: 3 }}>
                {ic} {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", background: "#080812", padding: viewMode === "wide" ? 0 : "20px 0" }}>
          <div style={{ width: viewMode === "mobile" ? 390 : viewMode === "tablet" ? 768 : "100%", flexShrink: 0, height: viewMode === "wide" ? "100%" : "100vh" }}>
            <LivePreview theme={selectedTheme} settings={settings} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── CREATE WIZARD ───────────────────────────────────────────────────────────

const getDefaults = schema => { const d = {}; (schema || []).forEach(f => { if (f.key) d[f.key] = f.default ?? ""; }); return d; };

const CreateWizard = ({ allThemes, onSave, onCancel, editPage, onThemeSaved }) => {
  const isEdit = !!editPage;
  const [step, setStep] = useState(isEdit ? 3 : 1);
  const [name, setName] = useState(editPage?.name || "");
  const [route, setRoute] = useState(editPage?.route || "");
  const [published, setPublished] = useState(editPage?.published ?? true);
  const [selectedTheme, setSelectedTheme] = useState(isEdit ? allThemes.find(t => t.id === editPage.themeId) : null);
  const [settings, setSettings] = useState(isEdit ? editPage.settings : {});
  const [routeEdited, setRouteEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showThemeCreator, setShowThemeCreator] = useState(false);

  useEffect(() => { if (!routeEdited && name) setRoute(slugify(name)); }, [name, routeEdited]);

  const pickTheme = t => { setSelectedTheme(t); if (!isEdit) setSettings(getDefaults(t.schema)); };

  if (showThemeCreator) return <ThemeCreator onCancel={() => setShowThemeCreator(false)} onSave={t => { onThemeSaved(t); setShowThemeCreator(false); pickTheme(t); setStep(3); }} />;

  const handleSave = async () => {
    setSaving(true); setSaveError("");
    try {
      const pageId = await savePage({ id: editPage?.id || null, name, route, published, themeId: selectedTheme.id, settings });
      onSave({ id: pageId || editPage?.id, name, route, published, themeId: selectedTheme.id, settings });
    } catch (e) { setSaveError("Save failed."); console.error(e); }
    setSaving(false);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onCancel} style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer" }}><Ic n="chevL" s={20} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{isEdit ? `Edit — ${editPage.name || editPage.route}` : "Create New Page"}</div>
          {!isEdit && <div style={{ display: "flex", gap: 0, marginTop: 4 }}>
            {["Page Info", "Choose Theme", "Customize"].map((l, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, fontSize: 10, background: step === i + 1 ? "rgba(108,99,255,0.2)" : "transparent", color: step === i + 1 ? "#a09aff" : step > i + 1 ? "#6c63ff" : "#444" }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, background: step > i + 1 ? "#6c63ff" : step === i + 1 ? "rgba(108,99,255,0.3)" : "rgba(255,255,255,0.04)", color: step > i + 1 ? "#fff" : step === i + 1 ? "#a09aff" : "#444" }}>{step > i + 1 ? <Ic n="check" s={8} /> : i + 1}</div>{l}
                </div>
                {i < 2 && <div style={{ width: 10, height: 1, background: "rgba(255,255,255,0.07)" }} />}
              </div>
            ))}
          </div>}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {step === 1 && (
          <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
            <div style={{ maxWidth: 420 }}>
              <div style={{ marginBottom: 16 }}><label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>Page Name *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="My Business Card" autoFocus style={IB} /></div>
              <div style={{ marginBottom: 16 }}><label style={{ display: "block", fontSize: 12, color: "#888", marginBottom: 6 }}>Route (URL slug)</label>
                <div style={{ display: "flex" }}><div style={{ padding: "9px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.09)", borderRight: "none", borderRadius: "8px 0 0 8px", color: "#555", fontSize: 13 }}>/cards/</div><input value={route} onChange={e => { setRoute(e.target.value); setRouteEdited(true); }} placeholder="my-page" style={{ ...IB, borderRadius: "0 8px 8px 0" }} /></div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
                <Toggle value={published} onChange={setPublished} />
                <span style={{ color: "#aaa", fontSize: 13 }}>Published</span>
              </div>
              <button onClick={() => setStep(2)} disabled={!name || !route} style={{ background: "#6c63ff", border: "none", borderRadius: 9, color: "#fff", padding: "11px 22px", fontSize: 13, fontWeight: 600, cursor: name && route ? "pointer" : "not-allowed", opacity: name && route ? 1 : 0.4, display: "flex", alignItems: "center", gap: 7 }}>Next <Ic n="chevR" s={14} /></button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ flex: 1, padding: "20px 28px", overflowY: "auto" }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>Pick a theme or upload your own.</div>
            <ThemeSelector allThemes={allThemes} selected={selectedTheme} onSelect={pickTheme} onCreateTheme={() => setShowThemeCreator(true)} />
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setStep(1)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, color: "#aaa", padding: "9px 18px", fontSize: 13, cursor: "pointer" }}>Back</button>
              <button onClick={() => setStep(3)} disabled={!selectedTheme} style={{ background: "#6c63ff", border: "none", borderRadius: 9, color: "#fff", padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: selectedTheme ? "pointer" : "not-allowed", opacity: selectedTheme ? 1 : 0.4 }}>Next: Customize</button>
            </div>
          </div>
        )}

        {step === 3 && selectedTheme && (
          <TabbedCustomizePanel
            selectedTheme={selectedTheme}
            settings={settings}
            setSettings={setSettings}
            isEdit={isEdit}
            saving={saving}
            saveError={saveError}
            onBack={() => setStep(2)}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
};

// ─── PAGE CARD ───────────────────────────────────────────────────────────────

const PageCard = ({ page, allThemes, onEdit, onDelete, onPreview }) => {
  const theme = allThemes.find(t => t.id === page.themeId);
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ background: "rgba(255,255,255,0.025)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden", transition: "border-color 0.2s" }} onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(108,99,255,0.3)"} onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}>
      <div style={{ height: 150, background: "#080812", overflow: "hidden", position: "relative" }}>
        {theme ? <iframe srcDoc={renderTheme(theme, page.settings)} title={page.name} sandbox="allow-scripts" style={{ width: "200%", height: "200%", border: "none", transform: "scale(0.5)", transformOrigin: "top left", pointerEvents: "none" }} /> : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333" }}><Ic n="layers" s={28} /></div>}
        <div style={{ position: "absolute", top: 8, right: 8, background: page.published ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.08)", border: `1px solid ${page.published ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 20, padding: "2px 8px", fontSize: 9, fontWeight: 700, color: page.published ? "#34d399" : "#666", textTransform: "uppercase" }}>
          {page.published ? "Live" : "Draft"}
        </div>
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 3 }}>{page.name || page.route}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: "#555" }}>/cards/{page.route}</span>
          <button onClick={() => { navigator.clipboard.writeText(`/cards/${page.route}`); setCopied(true); setTimeout(() => setCopied(false), 1800); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#444", padding: 2 }}>{copied ? <Ic n="check" s={11} /> : <Ic n="copy" s={11} />}</button>
        </div>
        {theme && <div style={{ fontSize: 9, color: theme.color, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{theme.name}</div>}
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onEdit(page)} style={{ flex: 1, background: "rgba(108,99,255,0.12)", border: "1px solid rgba(108,99,255,0.2)", borderRadius: 7, color: "#a09aff", padding: "7px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Ic n="edit" s={11} /> Edit</button>
          <button onClick={() => onTogglePublish(page)} title={page.published ? "Unpublish" : "Publish"} style={{ background: page.published ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.05)", border: `1px solid ${page.published ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 7, color: page.published ? "#34d399" : "#555", padding: "7px 10px", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>{page.published ? "Live" : "Draft"}</button>
          <button onClick={() => onPreview(page)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, color: "#777", padding: "7px 10px", cursor: "pointer" }}><Ic n="eye" s={12} /></button>
          <button onClick={() => onDelete(page.id)} style={{ background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.15)", borderRadius: 7, color: "#ff6b6b", padding: "7px 10px", cursor: "pointer" }}><Ic n="trash" s={12} /></button>
        </div>
      </div>
    </div>
  );
};

// ─── THEMES LIBRARY ──────────────────────────────────────────────────────────

const ThemesLibrary = ({ allThemes, onAdd, onDelete }) => (
  <div style={{ padding: "22px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
      <div><h1 style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 3 }}>Themes Library</h1><p style={{ fontSize: 12, color: "#555" }}>{allThemes.length} themes</p></div>
      <button onClick={onAdd} style={{ background: "rgba(108,99,255,0.15)", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 9, color: "#a09aff", padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Ic n="plus" s={13} /> Add Theme</button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12 }}>
      {allThemes.map(theme => (
        <div key={theme.id} style={{ background: "rgba(255,255,255,0.025)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
          <div style={{ height: 90, background: `linear-gradient(135deg,${theme.color}33,#0a0a14)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 46, height: 60, background: "rgba(255,255,255,0.05)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: 5 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: theme.color + "66" }} />
              <div style={{ width: 26, height: 2.5, background: "rgba(255,255,255,0.2)", borderRadius: 2 }} />
            </div>
          </div>
          <div style={{ padding: "10px 12px" }}>
            <div style={{ fontSize: 9, color: theme.color, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>{theme.category}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{theme.name}</div>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 8 }}>{(theme.schema || []).filter(f => f.key).length} settings</div>
            <button onClick={() => onDelete(theme.id)} style={{ background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.15)", borderRadius: 6, color: "#ff6b6b", padding: "3px 8px", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}><Ic n="trash" s={10} /> Delete</button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── PREVIEW MODAL ───────────────────────────────────────────────────────────

const PreviewModal = ({ page, allThemes, onClose }) => {
  const theme = allThemes.find(t => t.id === page?.themeId);
  if (!page) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>Preview — {page.name || page.route}</div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 7, color: "#fff", padding: "6px 12px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><Ic n="x" s={12} /> Close</button>
      </div>
      <div style={{ flex: 1 }}>{theme && <LivePreview theme={theme} settings={page.settings} />}</div>
    </div>
  );
};

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function PageBuilder() {
  const [pages, setPages] = useState([]);
  const [customThemes, setCustomThemes] = useState([]);
  const [view, setView] = useState("pages");
  const [editPage, setEditPage] = useState(null);
  const [previewPage, setPreviewPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([loadPages(), loadCustomThemes()]).then(([p, t]) => {
      setPages(p || []); setCustomThemes(t || []); setLoading(false);
    });
  }, []);

  const handleSavePage = async page => {
    const exists = pages.find(p => p.id === page.id);
    setPages(prev => exists ? prev.map(p => p.id === page.id ? page : p) : [...prev, page]);
    setView("pages"); setEditPage(null);
  };

  const handleDeletePage = async id => {
    if (!confirm("Delete this page?")) return;
    await deletePageAPI(id);
    setPages(prev => prev.filter(p => p.id !== id));
  };

  const handleSaveTheme = async theme => {
    await saveCustomThemeAPI(theme);
    setCustomThemes(prev => { const e = prev.find(t => t.id === theme.id); return e ? prev.map(t => t.id === theme.id ? theme : t) : [...prev, theme]; });
  };

  const handleDeleteTheme = async id => {
    if (!confirm("Delete this theme?")) return;
    await deleteCustomThemeAPI(id);
    setCustomThemes(prev => prev.filter(t => t.id !== id));
  };

  const filtered = pages.filter(p => (p.name || p.route || "").toLowerCase().includes(search.toLowerCase()));

  if (view === "create" || view === "edit") return (
    <div style={{ height: "100vh", background: "#0a0a14", color: "#fff", fontFamily: "system-ui,sans-serif", display: "flex", flexDirection: "column" }}>
      <CreateWizard allThemes={customThemes} editPage={view === "edit" ? editPage : null} onSave={handleSavePage} onCancel={() => { setView("pages"); setEditPage(null); }} onThemeSaved={handleSaveTheme} />
    </div>
  );

  if (view === "addTheme") return (
    <div style={{ height: "100vh", background: "#0a0a14", color: "#fff", fontFamily: "system-ui,sans-serif", display: "flex", flexDirection: "column" }}>
      <ThemeCreator onCancel={() => setView("themes")} onSave={async t => { await handleSaveTheme(t); setView("themes"); }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a14", color: "#fff", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ padding: "0 20px", height: 54, borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#0a0a14", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#6c63ff,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic n="layers" s={14} /></div>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>Page<span style={{ color: "#6c63ff" }}>Builder</span></span>
        </div>
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.04)", borderRadius: 9, padding: 3 }}>
          {[["pages", "My Pages"], ["themes", "Themes"]].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "5px 14px", borderRadius: 7, border: "none", background: view === v ? "rgba(108,99,255,0.25)" : "transparent", color: view === v ? "#a09aff" : "#666", cursor: "pointer", fontSize: 12, fontWeight: view === v ? 600 : 400 }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {view === "pages" && <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "5px 10px" }}>
              <Ic n="search" s={12} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ background: "transparent", border: "none", color: "#fff", fontSize: 12, outline: "none", width: 110 }} />
            </div>
            <button onClick={() => setView("create")} style={{ background: "#6c63ff", border: "none", borderRadius: 8, color: "#fff", padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><Ic n="plus" s={13} /> New Page</button>
          </>}
          {view === "themes" && <button onClick={() => setView("addTheme")} style={{ background: "rgba(108,99,255,0.15)", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 8, color: "#a09aff", padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><Ic n="plus" s={13} /> Add Theme</button>}
        </div>
      </div>

      {view === "pages" && (
        <div style={{ padding: "22px" }}>
          <div style={{ marginBottom: 18 }}><h1 style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 3 }}>My Pages</h1><p style={{ fontSize: 12, color: "#555" }}>{pages.length} page{pages.length !== 1 ? "s" : ""} · {pages.filter(p => p.published).length} published</p></div>
          {loading && <div style={{ textAlign: "center", padding: "80px 0", color: "#555" }}>Loading...</div>}
          {!loading && pages.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(108,99,255,0.1)", border: "1px solid rgba(108,99,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic n="sparkle" s={22} /></div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>No pages yet</div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>Create your first NFC card or web page</div>
              <button onClick={() => setView("create")} style={{ background: "#6c63ff", border: "none", borderRadius: 9, color: "#fff", padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><Ic n="plus" s={14} /> Create First Page</button>
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
              {filtered.map(page => <PageCard key={page.id} page={page} allThemes={customThemes} onEdit={p => { setEditPage(p); setView("edit"); }} onDelete={handleDeletePage} onPreview={setPreviewPage} onTogglePublish={async (pg) => {
  const newPub = !pg.published;
  await savePage({ id: pg.id, name: pg.name, route: pg.route, published: newPub, themeId: pg.themeId, settings: pg.settings });
  setPages(prev => prev.map(x => x.id === pg.id ? { ...x, published: newPub } : x));
}} />)}
            </div>
          )}
        </div>
      )}

      {view === "themes" && <ThemesLibrary allThemes={customThemes} onAdd={() => setView("addTheme")} onDelete={handleDeleteTheme} />}
      {previewPage && <PreviewModal page={previewPage} allThemes={customThemes} onClose={() => setPreviewPage(null)} />}
    </div>
  );
}