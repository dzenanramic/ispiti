import { randomInt } from "node:crypto";

// Bez sličnih znakova (0/O, 1/I) da se kod lakše prepiše sa projektora.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return code;
}

export function generateToken(): string {
  return crypto.randomUUID();
}
