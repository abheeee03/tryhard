import { Request, Response } from "express";
import { supabase } from "../utils/supabase";
import { connection } from "../utils/solana";

export const confirmDeposit = async (req: Request, res: Response) => {
    const matchId = req.params.matchId;
    const { txSignature, role } = req.body;

    if (!txSignature || !["player1", "player2"].includes(role)) {
        console.log(`[payment] Invalid confirm-deposit request: txSignature=${txSignature}, role=${role}`);
        return res.status(400).json({
            status: "FAILED",
            error: "txSignature and role (player1 | player2) are required"
        });
    }

    console.log(`[payment] Confirming deposit for match=${matchId}, role=${role}, tx=${txSignature}`);

    try {
        // Verify the transaction exists and is confirmed on-chain
        const txInfo = await connection.getTransaction(txSignature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
        });

        if (!txInfo) {
            console.log(`[payment] Transaction not found or not confirmed: ${txSignature}`);
            return res.status(400).json({
                status: "FAILED",
                error: "Transaction not found or not yet confirmed on-chain"
            });
        }

        if (txInfo.meta?.err) {
            console.log(`[payment] Transaction failed on-chain: ${txSignature}`, txInfo.meta.err);
            return res.status(400).json({
                status: "FAILED",
                error: "Transaction failed on-chain"
            });
        }

        // Update the match row with the deposit tx
        // Update the match row with the deposit tx and advance status to waiting if it was player1 funding
        const column = role === "player1" ? "player1_deposit_tx" : "player2_deposit_tx";
        
        const updatePayload: any = { [column]: txSignature };
        if (role === "player1") {
            updatePayload.status = "waiting";
        }

        const { error: updateErr } = await supabase
            .from("matches")
            .update(updatePayload)
            .eq("id", matchId);

        if (updateErr) {
            console.error(`[payment] Failed to update match deposit: `, updateErr);
            return res.status(500).json({
                status: "FAILED",
                error: "Failed to record deposit"
            });
        }

        console.log(`[payment] ✅ Deposit confirmed for match=${matchId}, role=${role}, tx=${txSignature}`);

        return res.json({
            status: "SUCCESS",
            data: { message: "Deposit confirmed" }
        });
    } catch (err) {
        console.error(`[payment] Error confirming deposit:`, err);
        return res.status(500).json({
            status: "FAILED",
            error: "Internal server error"
        });
    }
};
