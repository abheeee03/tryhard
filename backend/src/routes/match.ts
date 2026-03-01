import { Router } from "express";
import { createMatch, joinMatch, startMatch, submitAnswer, findMatchByCode } from "../controllers/match";

export const matchRouter = Router();

matchRouter.post('/create', createMatch);
matchRouter.get('/code/:code', findMatchByCode);
matchRouter.post('/:id/join', joinMatch);
matchRouter.post('/:id/start', startMatch);
matchRouter.post('/:id/submit', submitAnswer);