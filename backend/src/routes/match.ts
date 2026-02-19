import { Router } from "express";
import { createMatch, joinMatch, startMatch } from "../controllers/match";

export const matchRouter = Router();

matchRouter.post('/create', createMatch);
matchRouter.post('/:id/join', joinMatch);
matchRouter.post('/:id/start', startMatch);