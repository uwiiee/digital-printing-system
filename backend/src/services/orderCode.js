import { randomBytes } from "node:crypto";

// No I, L, O, 0 or 1, so a code read aloud or typed from a screenshot isn't misread
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

// e.g. "K7P3XQ". Rejection sampling keeps every character equally likely.
export function generateOrderCode(random = randomBytes) {
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let code = "";
  while (code.length < CODE_LENGTH) {
    for (const byte of random(CODE_LENGTH * 2)) {
      if (byte < limit && code.length < CODE_LENGTH) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
  }
  return code;
}

// Accepts what a person might type: "#k7p3xq", " K7P-3XQ "
export const normalizeOrderCode = (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
