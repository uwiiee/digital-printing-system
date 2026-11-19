import { useAuth } from "../../context/AuthContext";
import ChangePasswordForm from "../../components/ChangePasswordForm";

export default function Account() {
  const { user } = useAuth();
  return (
    <>
      <h2>My account</h2>
      <p className="account-info">Signed in as <strong>{user.email}</strong></p>
      <ChangePasswordForm />
    </>
  );
}
