const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { pool } = require('./db');
const { sendMessage } = require('./send');
const audioJob = require('./audioJob');
const basicAuth = require('express-basic-auth');
const csurf = require('csurf');
const cookieParser = require('cookie-parser');
const config = require('./config');

function startDashboard(client) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  if (config.dashboardUser && config.dashboardPass) {
    const users = {};
    users[config.dashboardUser] = config.dashboardPass;
    app.use(basicAuth({ users, challenge: true }));
  }
  app.use(cookieParser());
  app.use(express.json());
  app.use(csurf({ cookie: true }));
  app.use((req, res, next) => {
    res.cookie('XSRF-TOKEN', req.csrfToken());
    next();
  });
  app.use(express.static(path.join(__dirname, '../public')));

  app.get('/drafts', async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM Outbox WHERE status='draft' ORDER BY createdAt ASC`
    );
    res.json(rows);
  });

  app.post('/send/:id', async (req, res) => {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM Outbox WHERE id=$1', [id]);
    if (result.rowCount === 0) return res.status(404).send('Not found');
    if (config.approvalRequired) {
      await pool.query('UPDATE Outbox SET status=$1 WHERE id=$2', ['queued', id]);
      io.emit('refresh');
      return res.json({ queued: true });
    }
    const draft = result.rows[0];
    const sent = await sendMessage(client, draft.chatid, draft.text, draft.sourcemessageid);
    await pool.query(
      'UPDATE Outbox SET status=$1, sentMessageId=$2 WHERE id=$3',
      ['sent', sent && (sent.id?._serialized || sent.id), id]
    );
    io.emit('refresh');
    res.json(sent ? { ok: true } : { ok: false });
  });

  app.post('/asr/start', (req, res) => {
    audioJob.startProcessing();
    res.json({ running: true });
  });

  app.post('/asr/pause', (req, res) => {
    audioJob.pauseProcessing();
    res.json({ running: false });
  });

  app.get('/asr/status', (req, res) => {
    res.json({ running: audioJob.isProcessing() });
  });

  app.get('/outbox', async (req, res) => {
    const { rows } = await pool.query(
      `SELECT * FROM Outbox WHERE status <> 'sent' ORDER BY priority DESC, id ASC`
    );
    res.json(rows);
  });

  app.post('/outbox/retry/:id', async (req, res) => {
    const { id } = req.params;
    await pool.query('UPDATE Outbox SET status=$1, attempts=0 WHERE id=$2', ['queued', id]);
    io.emit('refresh');
    res.json({ ok: true });
  });

  app.get('/jobs', async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM JobStatus');
    res.json(rows);
  });

  app.get('/sent-today', async (req, res) => {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const ts = Math.floor(start.getTime() / 1000);
    const { rows } = await pool.query(
      `SELECT m.chatId, m.timestamp, m.body, c.name
       FROM Messages m
       LEFT JOIN Contacts c ON m.chatId = c.id
       WHERE m.fromMe = true AND m.timestamp >= $1
       ORDER BY m.timestamp DESC`,
      [ts]
    );
    res.json(rows);
  });

  server.listen(3000, () => console.log('Dashboard running on http://localhost:3000'));
}

if (require.main === module) {
  startDashboard(null);
}

module.exports = startDashboard;
