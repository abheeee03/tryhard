import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import { matchRouter } from './routes/match';
import { auth } from './middleware';
import { startGameEngine } from './controllers/matchEngine';
import cors from 'cors'

const app = express();
app.use(express.json())
app.use(cors({
    origin: "*"
}))
const PORT = 8080;

app.use('/api/match', auth, matchRouter);
app.get('/ping', (req, res) => {
    console.log("REQ COME TO BACKEND");

    res.json({
        msg: "pong"
    })
})
app.listen(PORT, "0.0.0.0", () => {
    console.log("backend started running on : ", PORT);
    startGameEngine()
})