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
    console.log("id is : ", token);
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data) {
        console.log(error);
        return res.status(401).json({
            status: "FAILED",
            error: "Unauthorized"
        })
    }
    req.userID = data.user.id;
    next()
}