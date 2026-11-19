import { useAuth } from "../../context/AuthContext";
import ChangePasswordForm from "../../components/ChangePasswordForm";

export default function AdminAccount() {
  const { user } = useAuth();
  return (
    <>
      <h1>Account</h1>
      <p className="account-info">Signed in as <strong>{user.email}</strong> (owner)</p>
      <ChangePasswordForm />
    </>
  );
}
