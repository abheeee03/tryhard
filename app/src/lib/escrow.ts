/**
 * Escrow transaction builders for the pvp-escrow Solana program.
 * These build unsigned transactions that the mobile wallet adapter signs & sends.
 */
import {
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const PROGRAM_ID = new PublicKey('AystLWreZ41EQzWgkTXTRYGn83qiQoxZqiLaBAdn4iFA');
const ESCROW_SEED = Buffer.from('escrow');

// Anchor discriminators (first 8 bytes of sha256("global:<method_name>"))
// Pre-computed to avoid needing the full Anchor SDK on the client
const DISCRIMINATOR_INITIALIZE = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);
const DISCRIMINATOR_JOIN = Buffer.from([206, 55, 2, 106, 113, 220, 17, 163]);

/**
 * Strip UUID dashes to create a 32-char game_id (matches the backend).
 */
export function matchIdToGameId(matchUuid: string): string {
    return matchUuid.replace(/-/g, '');
}

/**
 * Derive the escrow PDA for a given game ID.
 */
export function getEscrowPDA(gameId: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [ESCROW_SEED, Buffer.from(gameId)],
        PROGRAM_ID
    );
}

/**
 * Encode a Rust-style String: 4-byte LE length prefix + UTF-8 bytes
 */
function encodeString(str: string): Buffer {
    const bytes = Buffer.from(str, 'utf-8');
    const len = Buffer.alloc(4);
    len.writeUInt32LE(bytes.length, 0);
    return Buffer.concat([len, bytes]);
}

/**
 * Encode a u64 as 8-byte LE buffer
 */
function encodeU64(value: number | bigint): Buffer {
    const buf = Buffer.alloc(8);
    // Use BigInt for safe u64 encoding
    const big = BigInt(value);
    buf.writeBigUInt64LE(big, 0);
    return buf;
}

/**
 * Build an `initialize` instruction.
 * Player1 creates the escrow and deposits their bet.
 */
export function buildInitializeEscrowTx(
    player1: PublicKey,
    gameId: string,
    betAmountLamports: number | bigint,
    backendAuthPubkey: PublicKey,
): Transaction {
    const [escrowPDA] = getEscrowPDA(gameId);

    console.log(`[escrow] Building initialize tx: game=${gameId}, player1=${player1.toBase58()}, bet=${betAmountLamports}`);

    // Instruction data: discriminator + game_id (string) + bet_amount (u64) + backend_auth (pubkey)
    const data = Buffer.concat([
        DISCRIMINATOR_INITIALIZE,
        encodeString(gameId),
        encodeU64(betAmountLamports),
        backendAuthPubkey.toBuffer(),
    ]);

    const instruction = new TransactionInstruction({
        keys: [
            { pubkey: player1, isSigner: true, isWritable: true },
            { pubkey: escrowPDA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
    });

    const tx = new Transaction().add(instruction);
    tx.feePayer = player1;

    return tx;
}

/**
 * Build a `join` instruction.
 * Player2 joins the escrow and deposits their matching bet.
 */
export function buildJoinEscrowTx(
    player2: PublicKey,
    gameId: string,
): Transaction {
    const [escrowPDA] = getEscrowPDA(gameId);

    console.log(`[escrow] Building join tx: game=${gameId}, player2=${player2.toBase58()}`);

    // Instruction data: discriminator + game_id (string)
    const data = Buffer.concat([
        DISCRIMINATOR_JOIN,
        encodeString(gameId),
    ]);

    const instruction = new TransactionInstruction({
        keys: [
            { pubkey: player2, isSigner: true, isWritable: true },
            { pubkey: escrowPDA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
    });

    const tx = new Transaction().add(instruction);
    tx.feePayer = player2;

    return tx;
}

/**
 * Convert SOL amount to lamports.
 */
export function solToLamports(sol: number): number {
    return Math.round(sol * LAMPORTS_PER_SOL);
}
