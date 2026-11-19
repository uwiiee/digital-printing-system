import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ChartColumn, ClipboardList, KeyRound, LayoutDashboard, LogOut, TrendingUp } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "../admin.css"; // styles for the reports and forecast screens

const LINKS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/reports", label: "Reports", icon: ChartColumn },
  { to: "/admin/forecast", label: "Forecast", icon: TrendingUp },
  { to: "/admin/account", label: "Account", icon: KeyRound },
  // Inventory gets added later
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <strong>Admin Panel</strong>
        {LINKS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}>
            <Icon size={18} aria-hidden="true" /> {label}
          </NavLink>
        ))}
        <small>{user.email}</small>
        <button onClick={handleLogout}>
          <LogOut size={16} aria-hidden="true" /> Logout
        </button>
      </aside>
      <section className="admin-main">
        <Outlet />
      </section>
    </div>
  );
}
