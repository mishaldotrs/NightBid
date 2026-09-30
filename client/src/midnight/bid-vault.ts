import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';

/**
 * The opening of a sealed bid: the amount and random nonce that hash (with
 * the bidder's secret identity) to the on-chain commitment. It exists ONLY in
 * this browser — without it, nobody (including the bidder) can reveal the bid.
 */
export type SealedBidSecret = {
  gigId: bigint;
  amount: bigint;
  nonce: Uint8Array;
  placedAt: number;
};

type StoredSecret = { gigId: string; amount: string; nonce: string; placedAt: number };

const key = (contractAddress: string, account: string) =>
  `nightbid:bids:${contractAddress}:${account}`;

const readAll = (contractAddress: string, account: string): StoredSecret[] => {
  try {
    return JSON.parse(localStorage.getItem(key(contractAddress, account)) ?? '[]');
  } catch {
    return [];
  }
};

export const bidVault = {
  list(contractAddress: string, account: string): SealedBidSecret[] {
    return readAll(contractAddress, account).map((s) => ({
      gigId: BigInt(s.gigId),
      amount: BigInt(s.amount),
      nonce: new Uint8Array(fromHex(s.nonce)),
      placedAt: s.placedAt,
    }));
  },

  save(contractAddress: string, account: string, secret: SealedBidSecret): void {
    const others = readAll(contractAddress, account).filter(
      (s) => s.gigId !== secret.gigId.toString(),
    );
    others.push({
      gigId: secret.gigId.toString(),
      amount: secret.amount.toString(),
      nonce: toHex(secret.nonce),
      placedAt: secret.placedAt,
    });
    localStorage.setItem(key(contractAddress, account), JSON.stringify(others));
  },
};

export const freshNonce = (): Uint8Array => crypto.getRandomValues(new Uint8Array(32));
