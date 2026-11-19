import { useState } from "react";
import { uploadDesign, FILE_URL } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { estimateUnit, peso } from "../utils/format";

export default function AddToCartModal({ product, onClose, onAdd }) {
  const { token } = useAuth();
  const [values, setValues] = useState({});
  const [designFile, setDesignFile] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const setValue = (key, value) =>
    setValues((prev) => ({ ...prev, [key]: value }));
  const estimate = estimateUnit(product, values);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      setDesignFile(await uploadDesign(file, token));
    } catch (err) {
      setError(err.message);
      setDesignFile("");
      e.target.value = "";
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const specs = {};
    const details = [];

    for (const f of product.formFields) {
      const raw = values[f.key];
      const value = typeof raw === "string" ? raw.trim() : raw;

      if (value === undefined || value === "") {
        if (f.required) return setError(`${f.label} is required`);
        continue;
      }
      if (f.inputType === "number") {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0)
          return setError(`${f.label} must be a positive number`);
        specs[f.key] = n;
        details.push({ label: f.label, value: String(n) });
      } else {
        specs[f.key] = value;
        details.push({ label: f.label, value });
      }
    }
    onAdd({ product, specs, details, designFile });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3>{product.name}</h3>

        {product.formFields.map((f) => (
          <label key={f.key}>
            {f.label}
            {f.required && " *"}
            {f.inputType === "select" ? (
              <select
                value={values[f.key] || ""}
                onChange={(e) => setValue(f.key, e.target.value)}
              >
                <option value="">Choose...</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : f.inputType === "textarea" ? (
              <textarea
                value={values[f.key] || ""}
                onChange={(e) => setValue(f.key, e.target.value)}
              />
            ) : (
              <input
                type={f.inputType === "number" ? "number" : "text"}
                {...(f.inputType === "number" ? { min: 0, step: "any" } : {})}
                value={values[f.key] || ""}
                onChange={(e) => setValue(f.key, e.target.value)}
              />
            )}
          </label>
        ))}

        <label>
          Your design (optional, PNG/JPG/WEBP, max 5 MB)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFile}
          />
        </label>
        {uploading && <small>Uploading...</small>}
        {designFile && (
          <img
            className="thumb"
            src={FILE_URL + designFile}
            alt="Your design"
          />
        )}

        {estimate > 0 && (
          <p className="estimate">
            Estimated price (each): {peso(estimate)}{" "}
            <small>(final price set by the shop)</small>
          </p>
        )}

        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button disabled={uploading}>Add to cart</button>
        </div>
      </form>
    </div>
  );
}
