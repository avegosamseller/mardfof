import express from 'express';
import { Server } from 'colyseus';
import { createServer } from 'http';
import { OfficeRoom } from './rooms/OfficeRoom';

const app = express();
app.use(express.json());

app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

const httpServer = createServer(app);
const colyseusServer = new Server({ server: httpServer });

colyseusServer.define('office', OfficeRoom);

const PORT = Number(process.env.PORT || 3000);
colyseusServer.listen(PORT).then(() => {
    console.log(`[Server] AgentOffice listening on ws://localhost:${PORT}`);
});
