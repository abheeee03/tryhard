import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

export const ESCROW_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_ESCROW_PROGRAM_ID ??
    "AystLWreZ41EQzWgkTXTRYGn83qiQoxZqiLaBAdn4iFA"
);

export const getBackendAuthorityPublicKey = () => {
  const value = process.env.NEXT_PUBLIC_BACKEND_AUTH_PUBKEY;
  if (!value) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_AUTH_PUBKEY");
  }

  return new PublicKey(value);
};

const INITIALIZE_DISCRIMINATOR = Uint8Array.from([
  175, 175, 109, 31, 13, 152, 155, 237,
]);
const JOIN_DISCRIMINATOR = Uint8Array.from([
  206, 55, 2, 106, 113, 220, 17, 163,
]);
const RESOLVE_DISCRIMINATOR = Uint8Array.from([
  246, 150, 236, 206, 108, 63, 58, 10,
]);
const DRAW_DISCRIMINATOR = Uint8Array.from([
  61, 40, 62, 184, 31, 176, 24, 130,
]);

const textEncoder = new TextEncoder();

export const solToLamports = (amount: number) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Stake amount must be greater than zero.");
  }

  return Math.round(amount * LAMPORTS_PER_SOL);
};

const encodeString = (value: string) => {
  const bytes = textEncoder.encode(value);
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, bytes.length, true);
  return concatBytes(length, bytes);
};

const encodeU64 = (value: number) => {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);
  return bytes;
};

const concatBytes = (...chunks: Uint8Array[]) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });

  return output;
};

export const getEscrowPda = (inviteCode: string) => {
  return PublicKey.findProgramAddressSync(
    [textEncoder.encode("escrow"), textEncoder.encode(inviteCode)],
    ESCROW_PROGRAM_ID
  )[0];
};

export const createInitializeEscrowInstruction = ({
  inviteCode,
  player,
  stakeLamports,
  backendAuthority,
}: {
  inviteCode: string;
  player: PublicKey;
  stakeLamports: number;
  backendAuthority: PublicKey;
}) => {
  const normalizedInviteCode = inviteCode.trim().toUpperCase();
  const escrow = getEscrowPda(normalizedInviteCode);
  const data = concatBytes(
    INITIALIZE_DISCRIMINATOR,
    encodeString(normalizedInviteCode),
    encodeU64(stakeLamports),
    backendAuthority.toBytes()
  );

  return new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID,
    keys: [
      { pubkey: player, isSigner: true, isWritable: true },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: data as Buffer,
  });
};

export const createJoinEscrowInstruction = ({
  inviteCode,
  player,
}: {
  inviteCode: string;
  player: PublicKey;
}) => {
  const normalizedInviteCode = inviteCode.trim().toUpperCase();
  const escrow = getEscrowPda(normalizedInviteCode);
  const data = concatBytes(JOIN_DISCRIMINATOR, encodeString(normalizedInviteCode));

  return new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID,
    keys: [
      { pubkey: player, isSigner: true, isWritable: true },
      { pubkey: escrow, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: data as Buffer,
  });
};

export const createResolveEscrowInstruction = ({
  inviteCode,
  backendAuthority,
  winner,
}: {
  inviteCode: string;
  backendAuthority: PublicKey;
  winner: PublicKey;
}) => {
  const normalizedInviteCode = inviteCode.trim().toUpperCase();
  const escrow = getEscrowPda(normalizedInviteCode);
  const data = concatBytes(
    RESOLVE_DISCRIMINATOR,
    encodeString(normalizedInviteCode)
  );

  return new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID,
    keys: [
      { pubkey: backendAuthority, isSigner: true, isWritable: false },
      { pubkey: winner, isSigner: false, isWritable: true },
      { pubkey: escrow, isSigner: false, isWritable: true },
    ],
    data: data as Buffer,
  });
};

export const createDrawEscrowInstruction = ({
  inviteCode,
  backendAuthority,
  player1,
  player2,
}: {
  inviteCode: string;
  backendAuthority: PublicKey;
  player1: PublicKey;
  player2: PublicKey;
}) => {
  const normalizedInviteCode = inviteCode.trim().toUpperCase();
  const escrow = getEscrowPda(normalizedInviteCode);
  const data = concatBytes(DRAW_DISCRIMINATOR, encodeString(normalizedInviteCode));

  return new TransactionInstruction({
    programId: ESCROW_PROGRAM_ID,
    keys: [
      { pubkey: backendAuthority, isSigner: true, isWritable: false },
      { pubkey: player1, isSigner: false, isWritable: true },
      { pubkey: player2, isSigner: false, isWritable: true },
      { pubkey: escrow, isSigner: false, isWritable: true },
    ],
    data: data as Buffer,
  });
};
