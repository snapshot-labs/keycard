import { verifyTypedData } from '@ethersproject/wallet';

const DOMAIN = { name: 'snapshot', version: '0.1.4' };

const TYPES = {
  GetKeys: [
    { name: 'from', type: 'address' },
    { name: 'alias', type: 'address' },
    { name: 'timestamp', type: 'uint64' }
  ],
  CreateKey: [
    { name: 'from', type: 'address' },
    { name: 'alias', type: 'address' },
    { name: 'name', type: 'string' },
    { name: 'timestamp', type: 'uint64' }
  ],
  RenameKey: [
    { name: 'from', type: 'address' },
    { name: 'alias', type: 'address' },
    { name: 'key', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'timestamp', type: 'uint64' }
  ],
  DeleteKey: [
    { name: 'from', type: 'address' },
    { name: 'alias', type: 'address' },
    { name: 'key', type: 'string' },
    { name: 'timestamp', type: 'uint64' }
  ]
};

export type SignedType = keyof typeof TYPES;

export function recoverSigner(
  type: SignedType,
  message: Record<string, unknown>,
  sig: string
): string {
  return verifyTypedData(DOMAIN, { [type]: TYPES[type] }, message, sig);
}
