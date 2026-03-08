import dotenv from 'dotenv'
dotenv.config()
import { Buffer } from 'buffer';
import express from 'express'
import { matchRouter } from './routes/match';
import { paymentRouter } from './routes/payment';
import { demoRouter } from './routes/demo';
import { auth } from './middleware';
import { startGameEngine } from './controllers/matchEngine';
import cors from 'cors'

const app = express();
app.use(express.json())
app.use(cors({
    origin: "*",
    credentials: true,
}))
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
const PORT = 8080;

app.use('/api/match', auth, matchRouter);
app.use('/api/payment', auth, paymentRouter);
app.use('/api/demo', auth, demoRouter);

app.get('/ping', (req, res) => {
    console.log("REQ COME TO BACKEND");

    res.json({
        msg: "pong"
    })
})

app.use((req, res) => {
    res.status(404).json({
        status: "FAILED",
        error: `Route not found: ${req.method} ${req.path}`
    });
})

app.listen(PORT, "0.0.0.0", () => {
    console.log("backend started running on : ", PORT);
    startGameEngine()
})