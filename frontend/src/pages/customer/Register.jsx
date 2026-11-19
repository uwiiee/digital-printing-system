import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <h2>Create account</h2>
      <input name="email" type="email" placeholder="Gmail address" value={form.email} onChange={handleChange} required />
      <input name="password" type="password" placeholder="Password (8+ characters)" value={form.password} onChange={handleChange} required />
      <input name="confirmPassword" type="password" placeholder="Confirm password" value={form.confirmPassword} onChange={handleChange} required />
      {error && <p className="error">{error}</p>}
      <button disabled={loading}>{loading ? "Creating..." : "Register"}</button>
      <small>Already have an account? <Link to="/login">Login</Link></small>
    </form>
  );
}