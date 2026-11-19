import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);
const STORAGE_KEY = "auth";
const EMPTY = { token: null, user: null };

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || EMPTY;
  } catch {
    return EMPTY;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadSaved);

  const save = (data) => {
    const next = { token: data.token, user: data.user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAuth(next);
    return data.user;
  };

  const post = (path) => async (form) => save(await api(path, { method: "POST", body: form }));

  const register = post("/auth/register");
  const login = post("/auth/login");
  const adminLogin = post("/auth/admin/login");

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(EMPTY);
  };

  // The server refused our token (expired, or the password was changed on another device): log out
  useEffect(() => {
    const onExpired = () => {
      localStorage.removeItem(STORAGE_KEY);
      setAuth(EMPTY);
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  // The server returns a fresh token, so this device stays logged in while other devices are logged out
  const changePassword = async (form) => {
    save(await api("/auth/password", { method: "PATCH", token: auth.token, body: form }));
  };

  return (
    <AuthContext.Provider value={{ ...auth, register, login, adminLogin, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
