import dotenv from 'dotenv'
import express from 'express'
import { matchRouter } from './routes/match';


dotenv.config()

const app = express();
app.use(express.json())
const PORT = 8080;

app.use('/api/match', matchRouter);



app.listen(PORT, () => {
    console.log("backend started running on : ", PORT);

})