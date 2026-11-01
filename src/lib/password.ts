import bcrypt from "bcryptjs";

const ROUNDS = 11;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

let dummyHash: string | undefined;

/** Compares against a real hash, or a throwaway one when there is no user, so timing does not leak existence. */
export function verifyPassword(plain: string, hash: string | undefined): Promise<boolean> {
  dummyHash ??= bcrypt.hashSync("not-a-real-password", ROUNDS);
  return bcrypt.compare(plain, hash ?? dummyHash).then((ok) => ok && hash !== undefined);
}
