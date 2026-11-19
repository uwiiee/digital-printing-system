export const MIN_LENGTH = 8;
export const MAX_BYTES = 72; // bcrypt ignores everything after 72 bytes, so longer passwords are refused

// Returns a message describing what is wrong with the password, or null when it is acceptable
export function passwordProblem(password) {
  if (typeof password !== "string" || password.length === 0) return "Password is required";
  if (password.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters`;
  if (Buffer.byteLength(password, "utf8") > MAX_BYTES) return `Password is too long (maximum ${MAX_BYTES} bytes)`;
  return null;
}
