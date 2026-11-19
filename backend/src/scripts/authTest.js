// Tests the password rules and the "stale token" rule. Needs no database or server.
import { passwordProblem } from "../services/passwordRules.js";
import { isTokenStale } from "../services/tokenService.js";

let passed = 0;
let failed = 0;
function check(name, ok) {
  if (ok) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}`);
  }
}

check("a normal password is accepted", passwordProblem("goodpassword1") === null);
check("exactly 8 characters is accepted", passwordProblem("12345678") === null);
check("7 characters is refused", /at least 8/.test(passwordProblem("1234567")));
check("an empty password is refused", passwordProblem("") !== null);
check("a missing or non-text password is refused", passwordProblem(undefined) !== null && passwordProblem({ a: 1 }) !== null && passwordProblem(12345678) !== null);
check("72 bytes is accepted", passwordProblem("a".repeat(72)) === null);
check("73 bytes is refused", /too long/.test(passwordProblem("a".repeat(73))));
check("the limit counts bytes, not characters (25 emoji = 100 bytes is refused)", passwordProblem("😀".repeat(25)) !== null);
check("spaces and symbols are fine", passwordProblem("my pass phrase #1!") === null);

const changedAt = new Date("2026-10-27T10:00:10Z");
const sec = (iso) => Math.floor(new Date(iso).getTime() / 1000);
check("a token from before the change is stale", isTokenStale(sec("2026-10-27T10:00:05Z"), changedAt) === true);
check("a token from after the change is fine", isTokenStale(sec("2026-10-27T10:00:11Z"), changedAt) === false);
check("a token issued in the same second as the change is fine (the fresh token must work)", isTokenStale(sec("2026-10-27T10:00:10Z"), changedAt) === false);
check("users who never changed their password are never stale", isTokenStale(1, undefined) === false && isTokenStale(1, null) === false);

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
