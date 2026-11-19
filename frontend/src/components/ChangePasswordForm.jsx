import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "../account.css";

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };
const MIN_LENGTH = 8;

// Used on both the customer and the admin account pages
export default function ChangePasswordForm() {
  const { changePassword } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setDone(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setDone(false);

    // Quick checks here; the server checks everything again
    if (form.newPassword.length < MIN_LENGTH) return setError(`New password must be at least ${MIN_LENGTH} characters`);
    if (form.newPassword !== form.confirmPassword) return setError("New passwords do not match");
    if (form.newPassword === form.currentPassword) return setError("The new password must be different from the current one");

    setSaving(true);
    try {
      await changePassword(form);
      setForm(EMPTY);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const type = show ? "text" : "password";

  return (
    <form className="form account-form" onSubmit={handleSubmit}>
      <h2>Change password</h2>

      <label>
        Current password
        <input name="currentPassword" type={type} autoComplete="current-password" value={form.currentPassword} onChange={handleChange} required />
      </label>
      <label>
        New password
        <input name="newPassword" type={type} autoComplete="new-password" value={form.newPassword} onChange={handleChange} required />
        <small>At least {MIN_LENGTH} characters.</small>
      </label>
      <label>
        Confirm new password
        <input name="confirmPassword" type={type} autoComplete="new-password" value={form.confirmPassword} onChange={handleChange} required />
      </label>

      <button type="button" className="toggle-link" onClick={() => setShow(!show)}>
        {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        {show ? "Hide passwords" : "Show passwords"}
      </button>

      {error && <p className="error">{error}</p>}
      {done && <p className="notice">Your password was changed. Any other devices have been logged out.</p>}

      <button disabled={saving}>{saving ? "Saving..." : "Change password"}</button>
    </form>
  );
}
