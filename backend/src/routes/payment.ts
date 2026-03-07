import { Router } from "express";
import { confirmDeposit } from "../controllers/payment";

export const paymentRouter = Router();

paymentRouter.post('/:matchId/confirm-deposit', confirmDeposit);
