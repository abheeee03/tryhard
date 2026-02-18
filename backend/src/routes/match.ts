import { Router } from "express";
import { createMatch } from "../controllers/match";

export const matchRouter = Router();

matchRouter.post('/create', createMatch);