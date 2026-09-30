import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { GigStatus, type Gig } from 'nightbid-contract';
import { useState, type FormEvent } from 'react';
import type { SealedBidSecret } from './midnight/bid-vault';
import type { NightBidMarket, PublicMarketState } from './midnight/nightbid-api';
import { useNightBid, type TxStatus } from './useNightBid';

const short = (value: string, size = 6) =>
  value.length > size * 2 + 3 ? `${value.slice(0, size)}…${value.slice(-size)}` : value;

const STATUS_LABEL: Record<GigStatus, string> = {
  [GigStatus.open]: '🌑 Sealed bidding',
  [GigStatus.bidding_closed]: '🌓 Reveal phase',
  [GigStatus.awarded]: '🌕 Awarded',
  [GigStatus.cancelled]: '✖ Cancelled',
};

export function App() {
  const nb = useNightBid();
  const [observerView, setObserverView] = useState(false);

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="moon" aria-hidden>🌑</span>
          <div>
            <h1>NightBid</h1>
            <p>Sealed-bid gigs on Midnight</p>
          </div>
        </div>
        <WalletBadge nb={nb} />
      </header>

      <TxBanner tx={nb.tx} onDismiss={nb.dismissTx} />

      {!nb.session && nb.wallets.length === 0 && <WalletHelp injected={nb.injected} />}

      {!nb.session && <Landing />}

      {nb.session && !nb.market && (
        <MarketPicker onDeploy={nb.deployMarket} onJoin={nb.joinMarket} busy={nb.tx.kind === 'pending'} />
      )}

      {nb.market && (
        <>
          <section className="market-bar card">
            <div>
              <span className="label">Market contract</span>
              <code title={nb.market.contractAddress}>{short(nb.market.contractAddress, 10)}</code>
              <button className="link" onClick={() => navigator.clipboard.writeText(nb.market!.contractAddress)}>
                copy
              </button>
            </div>
            <div className="market-actions">
              <label className="toggle">
                <input type="checkbox" checked={observerView} onChange={(e) => setObserverView(e.target.checked)} />
                <span>👁 Observer view</span>
              </label>
              <button className="ghost" onClick={nb.leaveMarket}>Switch market</button>
            </div>
          </section>

          {!nb.marketState ? (
            <p className="muted center">Syncing with the Midnight indexer…</p>
          ) : observerView ? (
            <ObserverView state={nb.marketState} />
          ) : (
            <Marketplace
              market={nb.market}
              state={nb.marketState}
              myBids={nb.mySealedBids}
              busy={nb.tx.kind === 'pending'}
              run={nb.run}
            />
          )}
        </>
      )}

      <footer className="footer">
        <span>Bids sleep in the dark. Winners wake in the light.</span>
        <span>Built on Midnight · Compact + ZK proofs</span>
      </footer>
    </div>
  );
}

function WalletBadge({ nb }: { nb: ReturnType<typeof useNightBid> }) {
  if (nb.session) {
    return (
      <div className="wallet connected" title={nb.session.shieldedAddress}>
        <span className="dot" /> {nb.session.walletName} · {nb.session.networkId} ·{' '}
        <code>{short(nb.session.shieldedAddress)}</code>
      </div>
    );
  }
  if (nb.wallets.length === 0) {
    return (
      <a className="button" href="https://www.lace.io" target="_blank" rel="noreferrer">
        Install Lace
      </a>
    );
  }
  return (
    <div className="wallet-buttons">
      {nb.wallets.map((w) => (
        <button key={w.rdns ?? w.name} onClick={() => nb.connect(w)} disabled={nb.tx.kind === 'pending'}>
          {w.icon && <img src={w.icon} alt="" width={18} height={18} />} Connect {w.name}
        </button>
      ))}
    </div>
  );
}

function WalletHelp({ injected }: { injected: string[] }) {
  return (
    <section className="card wallet-help">
      <h3>{injected.length > 0 ? 'Midnight wallet found, but not compatible' : 'No Midnight wallet detected'}</h3>
      {injected.length > 0 ? (
        <>
          <p className="muted">
            NightBid needs a wallet that supports the Midnight dApp connector API v4 (a <code>connect()</code> method).
            Update Lace to the latest version, then reload this page. Detected:
          </p>
          <ul>
            {injected.map((w) => (
              <li key={w}>
                <code>{w}</code>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <ol className="muted">
          <li>Install the Lace extension and create a wallet.</li>
          <li>In Lace settings, enable <strong>Midnight</strong> and select the <strong>Preprod</strong> network.</li>
          <li>Reload this page. It detects the wallet automatically.</li>
        </ol>
      )}
    </section>
  );
}

function TxBanner({ tx, onDismiss }: { tx: TxStatus; onDismiss: () => void }) {
  if (tx.kind === 'idle') return null;
  return (
    <div className={`banner ${tx.kind}`} role="status">
      {tx.kind === 'pending' && (
        <span>
          <span className="spinner" /> {tx.label}… generating a zero-knowledge proof, this can take a moment.
        </span>
      )}
      {tx.kind === 'success' && (
        <span>
          ✓ {tx.label} confirmed · <code>{short(tx.txId, 8)}</code>
        </span>
      )}
      {tx.kind === 'error' && (
        <span>
          ✕ {tx.label} failed: {tx.message}
        </span>
      )}
      {tx.kind !== 'pending' && (
        <button className="link" onClick={onDismiss} aria-label="Dismiss">
          dismiss
        </button>
      )}
    </div>
  );
}

function Landing() {
  return (
    <main className="landing">
      <section className="hero">
        <h2>
          Hire freelancers with <em>sealed bids</em>.
        </h2>
        <p>
          Clients post a gig with a public budget. Freelancers submit bids that are sealed by zero-knowledge
          cryptography — nobody can see or undercut them. When bidding ends, the lowest bidder proves their
          bid and wins. Losing bids are never revealed.
        </p>
        <p className="muted">Connect a Midnight Lace wallet on Preprod to get started.</p>
      </section>
      <ol className="steps">
        <li>
          <strong>🌑 Post</strong>
          <span>A client posts a gig with a title and maximum budget.</span>
        </li>
        <li>
          <strong>🔒 Seal</strong>
          <span>Freelancers bid. Only a hash commitment hits the chain, plus a ZK proof that the bid is within budget.</span>
        </li>
        <li>
          <strong>🌓 Reveal</strong>
          <span>The client closes bidding. Bidders prove their sealed bid to claim the win — lowest verified bid leads.</span>
        </li>
        <li>
          <strong>🌕 Award</strong>
          <span>The client awards the gig. Every losing bid stays sealed forever.</span>
        </li>
      </ol>
    </main>
  );
}

function MarketPicker({
  onDeploy,
  onJoin,
  busy,
}: {
  onDeploy: () => void;
  onJoin: (address: string) => void;
  busy: boolean;
}) {
  const [address, setAddress] = useState('');
  return (
    <main className="picker">
      <section className="card">
        <h3>Join an existing market</h3>
        <p className="muted">Paste a NightBid contract address shared by a client.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (address.trim()) onJoin(address);
          }}
        >
          <input placeholder="Contract address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <button disabled={busy || !address.trim()}>Join market</button>
        </form>
      </section>
      <section className="card">
        <h3>Launch a new market</h3>
        <p className="muted">Deploy your own NightBid contract to Midnight and share its address.</p>
        <button onClick={onDeploy} disabled={busy}>
          Deploy contract
        </button>
      </section>
    </main>
  );
}

function Marketplace({
  market,
  state,
  myBids,
  busy,
  run,
}: {
  market: NightBidMarket;
  state: PublicMarketState;
  myBids: SealedBidSecret[];
  busy: boolean;
  run: (label: string, action: () => Promise<string | void>) => void;
}) {
  const [title, setTitle] = useState('');
  const [budget, setBudget] = useState('');

  const submitGig = (e: FormEvent) => {
    e.preventDefault();
    run('Posting gig', () => market.createGig(title.trim(), BigInt(budget)));
    setTitle('');
    setBudget('');
  };

  return (
    <main className="market">
      <section className="stats">
        <Stat label="Gigs" value={state.gigs.length} />
        <Stat label="Sealed bids on-chain" value={state.sealedCommitments.length} />
        <Stat label="Your sealed bids" value={myBids.length} />
      </section>

      <section className="card">
        <h3>Post a gig</h3>
        <form className="row" onSubmit={submitGig}>
          <input
            placeholder="e.g. Design a landing page"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <input
            placeholder="Max budget"
            type="number"
            min={1}
            step={1}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            required
          />
          <button disabled={busy}>Post gig</button>
        </form>
        <p className="hint">Title and budget are public. Bids against it will be sealed.</p>
      </section>

      {state.gigs.length === 0 ? (
        <p className="muted center">No gigs yet — post the first one. 🌑</p>
      ) : (
        <section className="gigs">
          {state.gigs.map((gig) => (
            <GigCard
              key={gig.id.toString()}
              gig={gig}
              isMine={toHex(gig.client) === market.myPublicKey}
              myBid={myBids.find((b) => b.gigId === gig.id)}
              myPublicKey={market.myPublicKey}
              busy={busy}
              run={run}
              market={market}
            />
          ))}
        </section>
      )}
    </main>
  );
}

function GigCard({
  gig,
  isMine,
  myBid,
  myPublicKey,
  busy,
  run,
  market,
}: {
  gig: Gig;
  isMine: boolean;
  myBid?: SealedBidSecret;
  myPublicKey: string;
  busy: boolean;
  run: (label: string, action: () => Promise<string | void>) => void;
  market: NightBidMarket;
}) {
  const [amount, setAmount] = useState('');
  const iLead = gig.hasWinner && toHex(gig.winner) === myPublicKey;
  const canClaim =
    gig.status === GigStatus.bidding_closed &&
    myBid !== undefined &&
    !iLead &&
    (!gig.hasWinner || myBid.amount < gig.winningBid);

  return (
    <article className={`card gig status-${gig.status}`}>
      <div className="gig-head">
        <span className="badge">{STATUS_LABEL[gig.status]}</span>
        {isMine && <span className="badge mine">Your gig</span>}
        {iLead && <span className="badge lead">{gig.status === GigStatus.awarded ? 'You won 🎉' : 'You lead'}</span>}
      </div>
      <h4>{gig.title}</h4>
      <dl className="facts">
        <div>
          <dt>Budget</dt>
          <dd>{gig.budget.toString()}</dd>
        </div>
        <div>
          <dt>Sealed bids</dt>
          <dd>{gig.bidCount.toString()}</dd>
        </div>
        <div>
          <dt>{gig.status === GigStatus.awarded ? 'Winning bid' : 'Lowest revealed'}</dt>
          <dd>{gig.hasWinner ? gig.winningBid.toString() : '—'}</dd>
        </div>
      </dl>

      {myBid && (
        <p className="secret">
          🔒 Your sealed bid: <strong>{myBid.amount.toString()}</strong>
          <span> — only visible in this browser</span>
        </p>
      )}

      <div className="gig-actions">
        {gig.status === GigStatus.open && !isMine && !myBid && (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              run('Sealing bid', () => market.placeBid(gig.id, BigInt(amount)));
            }}
          >
            <input
              type="number"
              min={1}
              max={gig.budget.toString()}
              placeholder={`Your bid (≤ ${gig.budget})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <button disabled={busy}>Seal bid</button>
          </form>
        )}

        {gig.status === GigStatus.open && isMine && (
          <>
            <button disabled={busy || gig.bidCount === 0n} onClick={() => run('Closing bidding', () => market.closeBidding(gig.id))}>
              Close bidding
            </button>
            <button className="ghost" disabled={busy} onClick={() => run('Cancelling gig', () => market.cancelGig(gig.id))}>
              Cancel gig
            </button>
          </>
        )}

        {canClaim && (
          <button disabled={busy} onClick={() => run('Revealing & claiming', () => market.claimWin(gig.id))}>
            Reveal my bid & claim
          </button>
        )}

        {gig.status === GigStatus.bidding_closed && myBid && !canClaim && !iLead && (
          <p className="muted">Outbid — your bid stays sealed forever. 🌑</p>
        )}

        {gig.status === GigStatus.bidding_closed && isMine && (
          <button disabled={busy || !gig.hasWinner} onClick={() => run('Awarding gig', () => market.awardGig(gig.id))}>
            {gig.hasWinner ? `Award to lowest bid (${gig.winningBid})` : 'Waiting for bidders to reveal…'}
          </button>
        )}
      </div>
    </article>
  );
}

function ObserverView({ state }: { state: PublicMarketState }) {
  return (
    <main className="observer">
      <section className="card">
        <h3>👁 What the blockchain sees</h3>
        <p className="muted">
          This is the complete public ledger of this NightBid market — everything any observer, indexer, or
          competitor can read. Notice what's missing: bid amounts and bidder identities.
        </p>
      </section>
      <section className="card">
        <h4>Sealed bid commitments ({state.sealedCommitments.length})</h4>
        {state.sealedCommitments.length === 0 ? (
          <p className="muted">None yet.</p>
        ) : (
          <ul className="commitments">
            {state.sealedCommitments.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
        )}
        <p className="hint">Each is persistentHash(gigId, amount, nonce, bidder) — irreversible without the secret opening.</p>
      </section>
      <section className="card">
        <h4>Gigs</h4>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Budget</th>
              <th>Status</th>
              <th>Bids</th>
              <th>Client ID</th>
              <th>Winner / bid</th>
            </tr>
          </thead>
          <tbody>
            {state.gigs.map((g) => (
              <tr key={g.id.toString()}>
                <td>{g.id.toString()}</td>
                <td>{g.title}</td>
                <td>{g.budget.toString()}</td>
                <td>{GigStatus[g.status]}</td>
                <td>{g.bidCount.toString()}</td>
                <td>
                  <code>{short(toHex(g.client))}</code>
                </td>
                <td>{g.hasWinner ? <><code>{short(toHex(g.winner))}</code> / {g.winningBid.toString()}</> : 'sealed'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat card">
      <span className="stat-value">{value}</span>
      <span className="label">{label}</span>
    </div>
  );
}
