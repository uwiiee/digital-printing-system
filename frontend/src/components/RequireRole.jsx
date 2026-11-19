import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequireRole({ role, redirectTo }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user || user.role !== role) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }
  return <Outlet />;
}