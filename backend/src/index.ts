import dotenv from 'dotenv'
dotenv.config()
import express from 'express'
import { matchRouter } from './routes/match';
import { auth } from './middleware';
import { generateQuestions } from './utils/questions';


const app = express();
app.use(express.json())
const PORT = 8080;

app.use('/api/match', auth, matchRouter);
app.listen(PORT, () => {
    console.log("backend started running on : ", PORT);

})