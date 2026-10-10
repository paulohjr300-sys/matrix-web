import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

// Criptografia dos tokens das integrações (AES-256-GCM) e assinatura do
// "state" do OAuth (HMAC). A chave vem de INTEGRATIONS_SECRET: qualquer
// texto longo e aleatório. Trocar a chave invalida as conexões salvas.

function key() {
  const secret = process.env.INTEGRATIONS_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("INTEGRATIONS_SECRET não configurada (mínimo de 32 caracteres).");
  }

  return createHash("sha256").update(secret).digest();
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);

  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url")).join(".");
}

export function decrypt(value: string) {
  const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// Assina um objeto com validade, para ir e voltar por um site externo.
export function signState(payload: Record<string, unknown>, ttlSeconds = 600) {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", key()).update(body).digest("base64url");

  return `${body}.${signature}`;
}

export function verifyState<T>(state: string): T | null {
  const [body, signature] = state.split(".");
  if (!body || !signature) return null;

  const expected = createHmac("sha256", key()).update(body).digest();
  const received = Buffer.from(signature, "base64url");

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));

  return payload.exp > Date.now() ? (payload as T) : null;
}

// PKCE (RFC 7636)
export function createPkce() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  return { verifier, challenge };
}
