import { SiweMessage } from "siwe";

export interface VerifySiweParams {
  message: string;
  signature: string;
  nonce: string;
  domain?: string;
}

export interface SiweResult {
  address: string;
  chainId: number;
}

/**
 * Verify a Sign-In with Ethereum (SIWE) message.
 * Returns the signer address if valid.
 */
export async function verifySiwe(params: VerifySiweParams): Promise<SiweResult> {
  const siwe = new SiweMessage(params.message);

  const result = await siwe.verify({
    signature: params.signature,
    domain: params.domain,
    nonce: params.nonce,
  });

  if (!result.success) {
    throw new Error("SIWE verification failed");
  }

  return {
    address: siwe.address.toLowerCase(),
    chainId: siwe.chainId,
  };
}

/**
 * Generate a random nonce for SIWE.
 */
export function generateNonce(): string {
  return Math.random().toString(36).substring(2, 10) +
         Math.random().toString(36).substring(2, 10);
}
