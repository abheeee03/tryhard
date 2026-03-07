import { useState, useCallback } from "react";
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  SendTransactionError,
} from "@solana/web3.js";
import { useWalletStore } from "../stores/wallet-store";

const APP_IDENTITY = {
  name: "TryHard",
  uri: "https://tryhard.app",
  icon: "favicon.ico",
};

const MAX_RETRIES = 2;

export function useWallet() {
  const { isDevnet, publicKeyBase58, setPublicKeyBase58 } = useWalletStore();
  const publicKey = publicKeyBase58 ? new PublicKey(publicKeyBase58) : null;
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);

  const cluster = isDevnet ? "devnet" : "mainnet-beta";
  const connection = new Connection(clusterApiUrl(cluster), "confirmed");

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const authResult = await transact(
        async (wallet: Web3MobileWallet) => {
          const result = await wallet.authorize({
            chain: `solana:${cluster}`,
            identity: APP_IDENTITY,
          });
          return result;
        }
      );

      const pubkey = new PublicKey(
        Buffer.from(authResult.accounts[0].address, "base64")
      );
      setPublicKeyBase58(pubkey.toBase58());
      console.log(`[wallet] Connected: ${pubkey.toBase58()}`);
      return pubkey;
    } catch (error: unknown) {
      console.error("[wallet] Connect failed:", error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [cluster, setPublicKeyBase58]);

  const disconnect = useCallback(() => {
    console.log("[wallet] Disconnected");
    setPublicKeyBase58(null);
  }, [setPublicKeyBase58]);

  const getBalance = useCallback(async (): Promise<number> => {
    if (!publicKey) return 0;
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  }, [publicKey, connection]);

  const signAndSendTransaction = useCallback(
    async (transaction: Transaction): Promise<string> => {
      if (!publicKey) throw new Error("Wallet not connected");

      setSending(true);
      console.log("[wallet] Signing and sending transaction…");

      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const { blockhash, lastValidBlockHeight } =
            await connection.getLatestBlockhash("confirmed");

          transaction.recentBlockhash = blockhash;
          transaction.feePayer = publicKey;

          const signedTransactions = await transact(
            async (wallet: Web3MobileWallet) => {
              await wallet.authorize({
                chain: `solana:${cluster}`,
                identity: APP_IDENTITY,
              });

              return await wallet.signTransactions({
                transactions: [transaction],
              });
            }
          );

          if (!signedTransactions || signedTransactions.length === 0) {
            throw new Error("User canceled signing or no transaction signed");
          }

          const signedTx = signedTransactions[0];

          console.log("[wallet] Dispatching raw transaction to network...");
          const txSignature = await connection.sendRawTransaction(
            signedTx.serialize(),
            {
              skipPreflight: false,
            }
          );

          console.log(`[wallet] Requesting confirmation for: ${txSignature}`);
          const confirmation = await connection.confirmTransaction(
            {
              signature: txSignature,
              blockhash,
              lastValidBlockHeight,
            },
            "confirmed"
          );

          if (confirmation.value.err) {
            throw new Error(
              `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
            );
          }

          console.log(
            `[wallet] ✅ Transaction sent and confirmed: ${txSignature}`
          );
          return txSignature;
        } catch (error: unknown) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.error(`[wallet] Attempt ${attempt + 1} failed:`, lastError.message);

          const errorMessage = lastError.message;

          if (
            errorMessage.includes("Blockhash not found") ||
            errorMessage.includes("blockhash not found")
          ) {
            console.log(
              `[wallet] Blockhash expired, retrying with fresh blockhash (attempt ${
                attempt + 1
              }/${MAX_RETRIES + 1})...`
            );
            continue;
          }

          if (error instanceof SendTransactionError) {
            try {
              const logs = await error.getLogs(connection);
              if (logs && Array.isArray(logs) && logs.length > 0) {
                console.error("[wallet] Transaction logs:", logs);
              }
            } catch {
              // Ignore log retrieval errors
            }

            const txMsg = (error as any).transactionMessage;
            if (txMsg) {
              console.error("[wallet] Transaction message:", txMsg);
            }
          }

          if (errorMessage.includes("Program") && errorMessage.includes("does not exist")) {
            throw new Error(
              "The escrow program is not deployed to the network. Please deploy the program first."
            );
          }
          if (errorMessage.includes("insufficient funds")) {
            throw new Error(
              "Insufficient SOL balance for this transaction. Please add more SOL to your wallet."
            );
          }
          if (errorMessage.includes("User canceled") || errorMessage.includes("cancel")) {
            throw new Error("Transaction was cancelled by user.");
          }

          throw lastError;
        }
      }

      throw lastError || new Error("Transaction failed after retries");
    },
    [publicKey, connection, cluster]
  );

  const sendSOL = useCallback(
    async (toAddress: string, amountSOL: number): Promise<string> => {
      if (!publicKey) throw new Error("Wallet not connected");

      setSending(true);
      try {
        const toPublicKey = new PublicKey(toAddress);
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: toPublicKey,
            lamports: Math.round(amountSOL * LAMPORTS_PER_SOL),
          })
        );

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signedTransactions = await transact(
          async (wallet: Web3MobileWallet) => {
            await wallet.authorize({
              chain: `solana:${cluster}`,
              identity: APP_IDENTITY,
            });

            return await wallet.signTransactions({
              transactions: [transaction],
            });
          }
        );

        if (!signedTransactions || signedTransactions.length === 0) {
          throw new Error("User canceled signing or no transaction signed");
        }

        const signedTx = signedTransactions[0];
        const txSignature = await connection.sendRawTransaction(
          signedTx.serialize(),
          {
            skipPreflight: false,
          }
        );

        const confirmation = await connection.confirmTransaction(
          {
            signature: txSignature,
            blockhash,
            lastValidBlockHeight,
          },
          "confirmed"
        );

        if (confirmation.value.err) {
          throw new Error(
            `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
          );
        }

        return txSignature;
      } catch (error: unknown) {
        if (error instanceof Error) {
          const errorMessage = error.message;
          if (
            errorMessage.includes("insufficient funds") ||
            errorMessage.includes("Insufficient")
          ) {
            throw new Error(
              "Insufficient SOL balance. Please add more SOL to your wallet."
            );
          }
          if (errorMessage.includes("User canceled") || errorMessage.includes("cancel")) {
            throw new Error("Transaction was cancelled by user.");
          }
        }
        throw error;
      } finally {
        setSending(false);
      }
    },
    [publicKey, connection, cluster]
  );

  return {
    publicKey,
    connected: !!publicKey,
    connecting,
    sending,
    connect,
    disconnect,
    getBalance,
    sendSOL,
    signAndSendTransaction,
    connection,
  };
}
