import { NextFunction, Response, Request } from "express";
import jwt from 'jsonwebtoken'
export const auth = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.json({
            status: "FAILED",
            error: "Unauthorized"
        })
    }

    //using dummy jwt for now. later this will be replaced by supabase auth jwt
    const data = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
    if (!data.id) {
        return res.json({
            status: "FAILED",
            error: "Unauthorized"
        })
    }
    req.userID = data.id;
    console.log("Decoded userID : ", data.id);
    next()
}