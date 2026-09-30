import {
  deployContract,
  findDeployedContract,
  type FoundContract,
} from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { Buffer } from 'buffer';
import {
  Contract,
  createNightBidPrivateState,
  ledger,
  pureCircuits,
  witnesses,
  type Gig,
  type NightBidPrivateState,
} from 'nightbid-contract';
import { map, type Observable } from 'rxjs';
import { bidVault, freshNonce, type SealedBidSecret } from './bid-vault';
import { PRIVATE_STATE_ID } from './config';
import type { NightBidProviders } from './providers';

type NightBidContract = Contract<NightBidPrivateState>;

const compiledNightBid = CompiledContract.make<NightBidContract>('nightbid', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  // Artifacts are fetched via the ZK config provider; the path is informational.
  CompiledContract.withCompiledFileAssets('nightbid'),
);

/** The public ledger, exactly as any observer of the chain sees it. */
export type PublicMarketState = {
  gigs: Gig[];
  sealedCommitments: string[];
};

export class NightBidMarket {
  private constructor(
    private readonly deployed: FoundContract<NightBidContract>,
    private readonly providers: NightBidProviders,
    readonly contractAddress: string,
    private readonly account: string,
    /** This user's NightBid identity: a hash of their secret key. */
    readonly myPublicKey: string,
  ) {}

  /**
   * A fresh secret key, stored as a Buffer (a Uint8Array subclass) so the
   * encrypted private-state store can round-trip it.
   */
  private static newPrivateState(): NightBidPrivateState {
    return createNightBidPrivateState(
      Buffer.from(crypto.getRandomValues(new Uint8Array(32))),
    );
  }

  private static identityOf(privateState: NightBidPrivateState): string {
    return toHex(pureCircuits.derivePublicKey(privateState.secretKey));
  }

  static async deploy(providers: NightBidProviders, account: string): Promise<NightBidMarket> {
    const initialPrivateState = NightBidMarket.newPrivateState();
    const deployed = await deployContract(providers, {
      compiledContract: compiledNightBid,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState,
    });
    const address = deployed.deployTxData.public.contractAddress;
    return new NightBidMarket(
      deployed,
      providers,
      address,
      account,
      NightBidMarket.identityOf(initialPrivateState),
    );
  }

  static async join(
    providers: NightBidProviders,
    account: string,
    contractAddress: string,
  ): Promise<NightBidMarket> {
    providers.privateStateProvider.setContractAddress(contractAddress as never);
    const existing = await providers.privateStateProvider.get(PRIVATE_STATE_ID);
    const privateState = existing ?? NightBidMarket.newPrivateState();
    const deployed = await findDeployedContract(providers, {
      compiledContract: compiledNightBid,
      contractAddress,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: privateState,
    });
    return new NightBidMarket(
      deployed,
      providers,
      contractAddress,
      account,
      NightBidMarket.identityOf(privateState),
    );
  }

  /** Live public state, pushed by the indexer on every new block. */
  state$(): Observable<PublicMarketState> {
    return this.providers.publicDataProvider
      .contractStateObservable(this.contractAddress as never, { type: 'latest' })
      .pipe(
        map((contractState) => {
          const view = ledger(contractState.data);
          return {
            gigs: [...view.gigs].map(([, gig]) => gig).sort((a, b) => Number(b.id - a.id)),
            sealedCommitments: [...view.sealedBids].map(toHex),
          };
        }),
      );
  }

  /** Bid openings stored locally in this browser. Never sent anywhere. */
  mySealedBids(): SealedBidSecret[] {
    return bidVault.list(this.contractAddress, this.account);
  }

  async createGig(title: string, budget: bigint): Promise<string> {
    const tx = await this.deployed.callTx.createGig(title, budget);
    return tx.public.txId;
  }

  async placeBid(gigId: bigint, amount: bigint): Promise<string> {
    const nonce = freshNonce();
    const tx = await this.deployed.callTx.placeBid(gigId, amount, nonce);
    // Only persist the opening once the commitment is on-chain.
    bidVault.save(this.contractAddress, this.account, {
      gigId,
      amount,
      nonce,
      placedAt: Date.now(),
    });
    return tx.public.txId;
  }

  async closeBidding(gigId: bigint): Promise<string> {
    return (await this.deployed.callTx.closeBidding(gigId)).public.txId;
  }

  async claimWin(gigId: bigint): Promise<string> {
    const secret = this.mySealedBids().find((s) => s.gigId === gigId);
    if (!secret) throw new Error('No sealed bid for this gig in this browser.');
    const tx = await this.deployed.callTx.claimWin(gigId, secret.amount, secret.nonce);
    return tx.public.txId;
  }

  async awardGig(gigId: bigint): Promise<string> {
    return (await this.deployed.callTx.awardGig(gigId)).public.txId;
  }

  async cancelGig(gigId: bigint): Promise<string> {
    return (await this.deployed.callTx.cancelGig(gigId)).public.txId;
  }
}
