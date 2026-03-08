import { Router } from "express";
import { createMatchDemo, confirmDepositDemo } from "../controllers/demo";

export const demoRouter = Router();

demoRouter.post('/match/create', createMatchDemo);
demoRouter.post('/payment/:matchId/confirm-deposit', confirmDepositDemo);
