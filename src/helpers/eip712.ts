import { verifyTypedData } from '@ethersproject/wallet';

const DOMAIN = { name: 'snapshot', version: '0.1.4' };

const GET_KEYS_TYPES = {
  GetKeys: [
    { name: 'from', type: 'address' },
    { name: 'alias', type: 'address' },
    { name: 'timestamp', type: 'uint64' }
  ]
};

export function recoverGetKeysSigner(
  message: { from: string; alias: string; timestamp: number },
  sig: string
): string {
  return verifyTypedData(DOMAIN, GET_KEYS_TYPES, message, sig);
}
