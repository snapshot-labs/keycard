import { verifyTypedData } from '@ethersproject/wallet';

const DOMAIN = { name: 'snapshot', version: '0.1.4' };

export type OwnerSignedParams = {
  from: string;
  alias: string;
  timestamp: number;
  sig: string;
};

// The type name is hashed into every signature;
const OWNER_TYPES = {
  GetKeys: [
    { name: 'from', type: 'address' },
    { name: 'alias', type: 'address' },
    { name: 'timestamp', type: 'uint64' }
  ]
};

export function recoverOwnerSigner(
  message: { from: string; alias: string; timestamp: number },
  sig: string
): string {
  return verifyTypedData(DOMAIN, OWNER_TYPES, message, sig);
}
