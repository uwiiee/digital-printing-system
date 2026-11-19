import { Route, Routes, useLocation } from "react-router-dom";
import RequireRole from "./components/RequireRole";
import CustomerLayout from "./layouts/CustomerLayout";
import AdminLayout from "./layouts/AdminLayout";
import Home from "./pages/customer/Home";
import Login from "./pages/customer/Login";
import Register from "./pages/customer/Register";
import Cart from "./pages/customer/Cart";
import MyOrders from "./pages/customer/MyOrders";
import Account from "./pages/customer/Account";
import TrackOrder from "./pages/customer/TrackOrder";
import OrderPlaced from "./pages/customer/OrderPlaced";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminOrderDetail from "./pages/admin/AdminOrderDetail";
import AdminReports from "./pages/admin/AdminReports";
import AdminForecast from "./pages/admin/AdminForecast";
import AdminAccount from "./pages/admin/AdminAccount";

function NotFound() {
  const { pathname } = useLocation();
  return <h1 style={{ padding: "2rem" }}>Page not found: {pathname}</h1>;
}

export default function App() {
  return (
    <Routes>
      {/* Customer area */}
      <Route element={<CustomerLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* Guests can order and track too, so these don't need a login */}
        <Route path="/cart" element={<Cart />} />
        <Route path="/track" element={<TrackOrder />} />
        <Route path="/order-placed" element={<OrderPlaced />} />
        <Route element={<RequireRole role="customer" redirectTo="/login" />}>
          <Route path="/orders" element={<MyOrders />} />
          <Route path="/account" element={<Account />} />
        </Route>
      </Route>

      {/* Admin area: separate login and layout, guarded by role */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<RequireRole role="admin" redirectTo="/admin/login" />}>
        <Route element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="forecast" element={<AdminForecast />} />
          <Route path="account" element={<AdminAccount />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
