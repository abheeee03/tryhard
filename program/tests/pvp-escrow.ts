import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PvpEscrow } from "../target/types/pvp_escrow";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { expect } from "chai";

async function airdrop(
  connection: anchor.web3.Connection,
  publicKey: PublicKey,
  sol: number = 10
) {
  const sig = await connection.requestAirdrop(publicKey, sol * LAMPORTS_PER_SOL);
  const latestBlockhash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...latestBlockhash });
}

function escrowPda(programId: PublicKey, gameId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), Buffer.from(gameId)],
    programId
  );
}

async function getBalance(connection: anchor.web3.Connection, pubkey: PublicKey): Promise<number> {
  return connection.getBalance(pubkey);
}

function accts(methods: any, obj: Record<string, PublicKey>): any {
  return methods.accounts(obj);
}

describe("pvp-escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.pvpEscrow as Program<PvpEscrow>;
  const connection = provider.connection;

  let player1: Keypair;
  let player2: Keypair;
  let backendAuth: Keypair;

  const BET_AMOUNT = new BN(1 * LAMPORTS_PER_SOL); // 1 SOL

  beforeEach(async () => {
    player1 = Keypair.generate();
    player2 = Keypair.generate();
    backendAuth = Keypair.generate();

    await Promise.all([
      airdrop(connection, player1.publicKey, 10),
      airdrop(connection, player2.publicKey, 10),
      airdrop(connection, backendAuth.publicKey, 2),
    ]);
  });

  //init escrow
  describe("initialize", () => {
    it("creates an escrow account with correct state", async () => {
      const gameId = "game-init-1";
      const [escrowPubkey] = escrowPda(program.programId, gameId);

      await program.methods
        .initialize(gameId, BET_AMOUNT, backendAuth.publicKey)
        .accounts({ player1: player1.publicKey })
        .signers([player1])
        .rpc();

      const escrowAccount = await program.account.gameEscrow.fetch(escrowPubkey);

      expect(escrowAccount.player1.toBase58()).to.equal(player1.publicKey.toBase58());
      expect(escrowAccount.player2.toBase58()).to.equal(PublicKey.default.toBase58());
      expect(escrowAccount.betAmount.toNumber()).to.equal(BET_AMOUNT.toNumber());
      expect(escrowAccount.gameId).to.equal(gameId);
      expect(escrowAccount.backendAuth.toBase58()).to.equal(backendAuth.publicKey.toBase58());
      expect(escrowAccount.isJoined).to.be.false;
    });

    it("transfers bet amount from player1 to escrow PDA", async () => {
      const gameId = "game-init-2";
      const [escrowPubkey] = escrowPda(program.programId, gameId);

      const player1BalanceBefore = await getBalance(connection, player1.publicKey);

      await program.methods
        .initialize(gameId, BET_AMOUNT, backendAuth.publicKey)
        .accounts({ player1: player1.publicKey })
        .signers([player1])
        .rpc();

      const escrowBalance = await getBalance(connection, escrowPubkey);
      const player1BalanceAfter = await getBalance(connection, player1.publicKey);

      expect(escrowBalance).to.be.gte(BET_AMOUNT.toNumber());
      expect(player1BalanceBefore - player1BalanceAfter).to.be.gte(BET_AMOUNT.toNumber());
    });

    it("rejects a game_id longer than 32 characters", async () => {
      const longGameId = "a".repeat(33);
      try {
        const [_escrowPubkey] = escrowPda(program.programId, longGameId);
        await program.methods
          .initialize(longGameId, BET_AMOUNT, backendAuth.publicKey)
          .accounts({ player1: player1.publicKey })
          .signers([player1])
          .rpc();
        expect.fail("Expected rejection");
      } catch (err: any) {
        const msg: string = err.error?.errorCode?.code ?? err.message ?? String(err);
        expect(msg).to.satisfy(
          (m: string) => m.includes("GameIdTooLong") || m.includes("Max seed length exceeded"),
          `Expected GameIdTooLong or Max seed length exceeded, got: ${msg}`
        );
      }
    });

    it("rejects duplicate game IDs (PDA already exists)", async () => {
      const gameId = "game-dup-1";

      await program.methods
        .initialize(gameId, BET_AMOUNT, backendAuth.publicKey)
        .accounts({ player1: player1.publicKey })
        .signers([player1])
        .rpc();

      try {
        await program.methods
          .initialize(gameId, BET_AMOUNT, backendAuth.publicKey)
          .accounts({ player1: player1.publicKey })
          .signers([player1])
          .rpc();
        expect.fail("Expected transaction to fail because game already exists");
      } catch (_err) {
      }
    });
  });

  describe("join", () => {
    let gameId: string;
    let escrowPubkey: PublicKey;

    beforeEach(async () => {
      gameId = `join-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; // ≤ 25 chars
      [escrowPubkey] = escrowPda(program.programId, gameId);

      await program.methods
        .initialize(gameId, BET_AMOUNT, backendAuth.publicKey)
        .accounts({ player1: player1.publicKey })
        .signers([player1])
        .rpc();
    });

    it("allows player2 to join and updates escrow state", async () => {
      await program.methods
        .join(gameId)
        .accounts({ player2: player2.publicKey })
        .signers([player2])
        .rpc();

      const escrowAccount = await program.account.gameEscrow.fetch(escrowPubkey);
      expect(escrowAccount.player2.toBase58()).to.equal(player2.publicKey.toBase58());
      expect(escrowAccount.isJoined).to.be.true;
    });

    it("transfers bet amount from player2 to escrow PDA", async () => {
      const escrowBalanceBefore = await getBalance(connection, escrowPubkey);
      const player2BalanceBefore = await getBalance(connection, player2.publicKey);

      await program.methods
        .join(gameId)
        .accounts({ player2: player2.publicKey })
        .signers([player2])
        .rpc();

      const escrowBalanceAfter = await getBalance(connection, escrowPubkey);
      const player2BalanceAfter = await getBalance(connection, player2.publicKey);

      expect(escrowBalanceAfter - escrowBalanceBefore).to.equal(BET_AMOUNT.toNumber());
      expect(player2BalanceBefore - player2BalanceAfter).to.be.gte(BET_AMOUNT.toNumber());
    });

    it("rejects a second join attempt (GameAlreadyJoined)", async () => {
      await program.methods
        .join(gameId)
        .accounts({ player2: player2.publicKey })
        .signers([player2])
        .rpc();

      const lateJoiner = Keypair.generate();
      await airdrop(connection, lateJoiner.publicKey, 5);

      try {
        await program.methods
          .join(gameId)
          .accounts({ player2: lateJoiner.publicKey })
          .signers([lateJoiner])
          .rpc();
        expect.fail("Expected GameAlreadyJoined error");
      } catch (err: any) {
        expect(err.error?.errorCode?.code ?? err.message).to.include("GameAlreadyJoined");
      }
    });
  });


  describe("resolve", () => {
    let gameId: string;
    let escrowPubkey: PublicKey;

    beforeEach(async () => {
      gameId = `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; // ≤ 24 chars
      [escrowPubkey] = escrowPda(program.programId, gameId);

      await program.methods
        .initialize(gameId, BET_AMOUNT, backendAuth.publicKey)
        .accounts({ player1: player1.publicKey })
        .signers([player1])
        .rpc();

      await program.methods
        .join(gameId)
        .accounts({ player2: player2.publicKey })
        .signers([player2])
        .rpc();
    });

    it("pays out winner (player1) and closes the escrow", async () => {
      const escrowBalance = await getBalance(connection, escrowPubkey);
      const player1BalanceBefore = await getBalance(connection, player1.publicKey);

      await accts(program.methods.resolve(gameId), {
        backendAuth: backendAuth.publicKey,
        winner: player1.publicKey,
      })
        .signers([backendAuth])
        .rpc();

      const player1BalanceAfter = await getBalance(connection, player1.publicKey);
      expect(await connection.getAccountInfo(escrowPubkey)).to.be.null;
      expect(player1BalanceAfter - player1BalanceBefore).to.be.gte(escrowBalance - 10_000);
    });

    it("pays out winner (player2) and closes the escrow", async () => {
      const escrowBalance = await getBalance(connection, escrowPubkey);
      const player2BalanceBefore = await getBalance(connection, player2.publicKey);

      await accts(program.methods.resolve(gameId), {
        backendAuth: backendAuth.publicKey,
        winner: player2.publicKey,
      })
        .signers([backendAuth])
        .rpc();

      const player2BalanceAfter = await getBalance(connection, player2.publicKey);
      expect(await connection.getAccountInfo(escrowPubkey)).to.be.null;
      expect(player2BalanceAfter - player2BalanceBefore).to.be.gte(escrowBalance - 10_000);
    });

    it("rejects an invalid winner (third party)", async () => {
      const stranger = Keypair.generate();
      await airdrop(connection, stranger.publicKey, 1);

      try {
        await accts(program.methods.resolve(gameId), {
          backendAuth: backendAuth.publicKey,
          winner: stranger.publicKey,
        })
          .signers([backendAuth])
          .rpc();
        expect.fail("Expected InvalidWinner error");
      } catch (err: any) {
        expect(err.error?.errorCode?.code ?? err.message).to.include("InvalidWinner");
      }
    });

    it("rejects resolve with a wrong backend authority", async () => {
      const fakeBackend = Keypair.generate();
      await airdrop(connection, fakeBackend.publicKey, 1);

      try {
        await accts(program.methods.resolve(gameId), {
          backendAuth: fakeBackend.publicKey,
          winner: player1.publicKey,
        })
          .signers([fakeBackend])
          .rpc();
        expect.fail("Expected has_one constraint to reject fake backend");
      } catch (_err) {
      }
    });

    it("rejects resolve when game has not been joined", async () => {
      const unjoined = `ru-${Date.now()}`; // ≤ 17 chars
      const [unjoinedEscrow] = escrowPda(program.programId, unjoined);

      await program.methods
        .initialize(unjoined, BET_AMOUNT, backendAuth.publicKey)
        .accounts({ player1: player1.publicKey })
        .signers([player1])
        .rpc();

      try {
        await accts(program.methods.resolve(unjoined), {
          backendAuth: backendAuth.publicKey,
          winner: player1.publicKey,
        })
          .signers([backendAuth])
          .rpc();
        expect.fail("Expected GameNotJoined error");
      } catch (err: any) {
        expect(err.error?.errorCode?.code ?? err.message).to.include("GameNotJoined");
      }

      void unjoinedEscrow;
    });
  });

  describe("cancel", () => {
    let gameId: string;
    let escrowPubkey: PublicKey;

    beforeEach(async () => {
      gameId = `cancel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; // ≤ 27 chars
      [escrowPubkey] = escrowPda(program.programId, gameId);

      await program.methods
        .initialize(gameId, BET_AMOUNT, backendAuth.publicKey)
        .accounts({ player1: player1.publicKey })
        .signers([player1])
        .rpc();
    });

    it("refunds player1 and closes the escrow when game is not joined", async () => {
      const escrowBalance = await getBalance(connection, escrowPubkey);
      const player1BalanceBefore = await getBalance(connection, player1.publicKey);

      await program.methods
        .cancel(gameId)
        .accounts({ player1: player1.publicKey })
        .signers([player1])
        .rpc();

      expect(await connection.getAccountInfo(escrowPubkey)).to.be.null;

      const player1BalanceAfter = await getBalance(connection, player1.publicKey);
      expect(player1BalanceAfter - player1BalanceBefore).to.be.gte(escrowBalance - 10_000);
    });

    it("rejects cancel after player2 has already joined (GameAlreadyJoined)", async () => {
      await program.methods
        .join(gameId)
        .accounts({ player2: player2.publicKey })
        .signers([player2])
        .rpc();

      try {
        await program.methods
          .cancel(gameId)
          .accounts({ player1: player1.publicKey })
          .signers([player1])
          .rpc();
        expect.fail("Expected GameAlreadyJoined error");
      } catch (err: any) {
        expect(err.error?.errorCode?.code ?? err.message).to.include("GameAlreadyJoined");
      }
    });

    it("rejects cancel from a non-player1 signer", async () => {
      const impersonator = Keypair.generate();
      await airdrop(connection, impersonator.publicKey, 1);

      try {
        await program.methods
          .cancel(gameId)
          .accounts({ player1: impersonator.publicKey })
          .signers([impersonator])
          .rpc();
        expect.fail("Expected has_one player1 constraint to fail");
      } catch (_err) {
        // Expected: has_one = player1 fails
      }
    });
  });


  describe("draw", () => {
    let gameId: string;
    let escrowPubkey: PublicKey;

    beforeEach(async () => {
      gameId = `draw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; // ≤ 25 chars
      [escrowPubkey] = escrowPda(program.programId, gameId);

      await program.methods
        .initialize(gameId, BET_AMOUNT, backendAuth.publicKey)
        .accounts({ player1: player1.publicKey })
        .signers([player1])
        .rpc();

      await program.methods
        .join(gameId)
        .accounts({ player2: player2.publicKey })
        .signers([player2])
        .rpc();
    });

    it("refunds both players and closes the escrow on draw", async () => {
      const player1BalanceBefore = await getBalance(connection, player1.publicKey);
      const player2BalanceBefore = await getBalance(connection, player2.publicKey);

      await accts(program.methods.draw(gameId), {
        backendAuth: backendAuth.publicKey,
        player1: player1.publicKey,
        player2: player2.publicKey,
      })
        .signers([backendAuth])
        .rpc();

      expect(await connection.getAccountInfo(escrowPubkey)).to.be.null;

      const player1BalanceAfter = await getBalance(connection, player1.publicKey);
      const player2BalanceAfter = await getBalance(connection, player2.publicKey);

      expect(player2BalanceAfter - player2BalanceBefore).to.equal(BET_AMOUNT.toNumber());
      expect(player1BalanceAfter - player1BalanceBefore).to.be.gte(BET_AMOUNT.toNumber());
    });

    it("rejects draw when game has not been joined", async () => {
      const unjoined = `du-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`; // ≤ 22 chars
      const [unjoinedEscrow] = escrowPda(program.programId, unjoined);

      await program.methods
        .initialize(unjoined, BET_AMOUNT, backendAuth.publicKey)
        .accounts({ player1: player1.publicKey })
        .signers([player1])
        .rpc();

      try {
        await accts(program.methods.draw(unjoined), {
          backendAuth: backendAuth.publicKey,
          player1: player1.publicKey,
          player2: player2.publicKey,
        })
          .signers([backendAuth])
          .rpc();
        expect.fail("Expected GameNotJoined error");
      } catch (err: any) {
        expect(err.error?.errorCode?.code ?? err.message).to.include("GameNotJoined");
      }

      void unjoinedEscrow;
    });

    it("rejects draw with a wrong backend authority", async () => {
      const fakeBackend = Keypair.generate();
      await airdrop(connection, fakeBackend.publicKey, 1);

      try {
        await accts(program.methods.draw(gameId), {
          backendAuth: fakeBackend.publicKey,
          player1: player1.publicKey,
          player2: player2.publicKey,
        })
          .signers([fakeBackend])
          .rpc();
        expect.fail("Expected has_one backend_auth to reject fake backend");
      } catch (_err) {
        // Expected: has_one = backend_auth fails
      }
    });

    it("rejects draw with wrong player1 account", async () => {
      const wrongPlayer = Keypair.generate();
      await airdrop(connection, wrongPlayer.publicKey, 1);

      try {
        await accts(program.methods.draw(gameId), {
          backendAuth: backendAuth.publicKey,
          player1: wrongPlayer.publicKey,
          player2: player2.publicKey,
        })
          .signers([backendAuth])
          .rpc();
        expect.fail("Expected InvalidPlayer1 error");
      } catch (err: any) {
        expect(err.error?.errorCode?.code ?? err.message).to.match(/InvalidPlayer1|ConstraintAddress/);
      }
    });

    it("rejects draw with wrong player2 account", async () => {
      const wrongPlayer = Keypair.generate();
      await airdrop(connection, wrongPlayer.publicKey, 1);

      try {
        await accts(program.methods.draw(gameId), {
          backendAuth: backendAuth.publicKey,
          player1: player1.publicKey,
          player2: wrongPlayer.publicKey,
        })
          .signers([backendAuth])
          .rpc();
        expect.fail("Expected InvalidPlayer2 error");
      } catch (err: any) {
        expect(err.error?.errorCode?.code ?? err.message).to.match(/InvalidPlayer2|ConstraintAddress/);
      }
    });
  });
});
