import "server-only";

import { randomBytes, createHash } from "crypto";

const ATLUS_BASE = "https://knowledge-base-api.lumenalta.com";
const ATLUS_AUTHORIZE_URL = `${ATLUS_BASE}/auth/authorize`;
const ATLUS_TOKEN_URL = `${ATLUS_BASE}/auth/token`;
const ATLUS_REGISTER_URL = `${ATLUS_BASE}/auth/register`;

export function generatePKCE(): {
  verifier: string;
  challenge: string;
} {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

export function generateState(): string {
  return randomBytes(16).toString("base64url");
}

export async function registerAtlusClient(
  redirectUri: string,
): Promise<string> {
  const res = await fetch(ATLUS_REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "lumenalta-hackathon",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });

  if (!res.ok) {
    throw new Error(
      `AtlusAI client registration failed: ${res.status} ${await res.text()}`,
    );
  }

  const data = await res.json();
  return data.client_id as string;
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}): string {
  const url = new URL(ATLUS_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", "offline_access");
  return url.toString();
}

export async function exchangeCodeForTokens(params: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ access_token: string; refresh_token?: string }> {
  const res = await fetch(ATLUS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AtlusAI token exchange failed: ${res.status} ${body}`);
  }

  return res.json();
}
