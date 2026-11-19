import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const { count, clearCart } = useCart();
  const navigate = useNavigate();
  const isCustomer = user?.role === "customer";

  const handleLogout = () => {
    clearCart(); // the next person on this browser starts with an empty cart
    logout();
    navigate("/");
  };

  return (
    <>
      <header className="navbar">
        <Link to="/"><strong>PrintShop</strong></Link>
        <nav>
          <Link to="/">Home</Link>
          {isCustomer && <Link to="/orders">My Orders</Link>}
          {isCustomer && <Link to="/cart">Cart ({count})</Link>}
          {isCustomer && <Link to="/account">Account</Link>}
          {user ? (
            <>
              <span style={{ marginLeft: "1rem" }}>{user.email}</span>
              <a href="#logout" onClick={(e) => { e.preventDefault(); handleLogout(); }}>Logout</a>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </nav>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
