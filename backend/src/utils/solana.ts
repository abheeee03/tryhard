import { Connection, PublicKey, Keypair, clusterApiUrl } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import bs58 from 'bs58';

// ─── Program constants ──────────────────────────────────────────
const PROGRAM_ID = new PublicKey('AystLWreZ41EQzWgkTXTRYGn83qiQoxZqiLaBAdn4iFA');
const ESCROW_SEED = Buffer.from('escrow');

// ─── Connection ─────────────────────────────────────────────────
export const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

// ─── Backend authority keypair ──────────────────────────────────
const secretKey = process.env.BACKEND_WALLET_SECRET;
if (!secretKey) {
    console.warn('[solana] ⚠ BACKEND_WALLET_SECRET not set — escrow resolution will fail');
}
export const backendKeypair = secretKey
    ? Keypair.fromSecretKey(bs58.decode(secretKey))
    : Keypair.generate(); // fallback for dev — won't actually sign

console.log('[solana] Backend authority public key:', backendKeypair.publicKey.toBase58());

// ─── Generated IDL Load ─────────────────────
import IDL from './pvp_escrow.json';

// ─── Anchor provider & program ──────────────────────────────────
const provider = new AnchorProvider(
    connection,
    new Wallet(backendKeypair),
    { commitment: 'confirmed' }
);

export const program = new Program(IDL as any, provider);

// ─── Helper: strip UUID dashes to fit 32-char limit ─────────────
export function matchIdToGameId(matchUuid: string): string {
    return matchUuid.replace(/-/g, '');
}

// ─── Helper: derive escrow PDA ──────────────────────────────────
export function getEscrowPDA(gameId: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [ESCROW_SEED, Buffer.from(gameId)],
        PROGRAM_ID
    );
}

// ─── Resolve: pay everything to winner ──────────────────────────
export async function resolveEscrow(gameId: string, winnerPubkey: string): Promise<string> {
    const [escrowPDA] = getEscrowPDA(gameId);
    const winner = new PublicKey(winnerPubkey);

    console.log(`[solana] Resolving escrow for game=${gameId}, winner=${winnerPubkey}`);

    const tx = await (program.methods as any)
        .resolve(gameId)
        .accounts({
            backendAuth: backendKeypair.publicKey,
            winner,
            escrow: escrowPDA,
        })
        .signers([backendKeypair])
        .rpc();

    console.log(`[solana] Escrow resolved tx=${tx}`);
    return tx;
}

// ─── Draw: refund both players ──────────────────────────────────
export async function drawEscrow(
    gameId: string,
    player1Pubkey: string,
    player2Pubkey: string
): Promise<string> {
    const [escrowPDA] = getEscrowPDA(gameId);

    console.log(`[solana] Drawing escrow for game=${gameId}`);

    const tx = await (program.methods as any)
        .draw(gameId)
        .accounts({
            backendAuth: backendKeypair.publicKey,
            player1: new PublicKey(player1Pubkey),
            player2: new PublicKey(player2Pubkey),
            escrow: escrowPDA,
        })
        .signers([backendKeypair])
        .rpc();

    console.log(`[solana] Escrow draw tx=${tx}`);
    return tx;
}
