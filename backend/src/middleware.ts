import { NextFunction, Response, Request } from "express";
import { supabase } from "./utils/supabase";

export const auth = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.json({
            status: "FAILED",
            error: "Unauthorized"
        })
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
        return res.json({
            status: "FAILED",
            error: "Unauthorized"
        })
    }

    req.userID = user.id;
    console.log("Decoded userID : ", user.id);
    next()
}