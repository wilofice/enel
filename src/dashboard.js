const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { pool } = require('./db');
const { sendMessage } = require('./send');

function startDashboard(client) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  app.use(express.json());

  app.get('/drafts', async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM AiReplies WHERE status=$1', ['draft']);
    res.json(rows);
  });

  app.post('/send/:id', async (req, res) => {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM AiReplies WHERE id=$1', [id]);
    if (result.rowCount === 0) return res.status(404).send('Not found');
    const draft = result.rows[0];
    const sent = await sendMessage(client, draft.originalmessageid, draft.drafttext, draft.originalmessageid);
    await pool.query('UPDATE AiReplies SET status=$1 WHERE id=$2', ['sent', id]);
    io.emit('refresh');
    res.json(sent ? { ok: true } : { ok: false });
  });

  server.listen(3000, () => console.log('Dashboard running on http://localhost:3000'));
}

module.exports = startDashboard;
