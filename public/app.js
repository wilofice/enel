async function fetchDrafts() {
  const res = await fetch('/drafts');
  const drafts = await res.json();
  const list = document.getElementById('drafts');
  list.innerHTML = '';
  drafts.forEach(d => {
    const div = document.createElement('div');
    div.className = 'draft';
    div.textContent = d.text;
    const btn = document.createElement('button');
    btn.textContent = 'Send';
    btn.onclick = async () => {
      await fetch('/send/' + d.id, { method: 'POST' });
      fetchDrafts();
      fetchSent();
    };
    div.appendChild(btn);
    list.appendChild(div);
  });
}

async function fetchAsrStatus() {
  const res = await fetch('/asr/status');
  const data = await res.json();
  document.getElementById('asrStatus').textContent = data.running ? 'running' : 'paused';
}

document.getElementById('start').onclick = async () => {
  await fetch('/asr/start', { method: 'POST' });
  fetchAsrStatus();
};

document.getElementById('pause').onclick = async () => {
  await fetch('/asr/pause', { method: 'POST' });
  fetchAsrStatus();
};

async function fetchSent() {
  const res = await fetch('/sent-today');
  const msgs = await res.json();
  const container = document.getElementById('sent');
  container.innerHTML = '';
  msgs.forEach(m => {
    const div = document.createElement('div');
    const name = m.name || m.chatid;
    const date = new Date(m.timestamp * 1000).toLocaleTimeString();
    div.textContent = `${date} - ${name}: ${m.body}`;
    container.appendChild(div);
  });
}

async function fetchOutbox() {
  const res = await fetch('/outbox');
  const rows = await res.json();
  const container = document.getElementById('outbox');
  container.innerHTML = '';
  rows.forEach(r => {
    const div = document.createElement('div');
    div.className = 'draft';
    div.textContent = `${r.status} [${r.priority}] ${r.text}`;
    if (r.status === 'failed') {
      const btn = document.createElement('button');
      btn.textContent = 'Retry';
      btn.onclick = async () => {
        await fetch('/outbox/retry/' + r.id, { method: 'POST' });
        fetchOutbox();
      };
      div.appendChild(btn);
    }
    container.appendChild(div);
  });
}

async function fetchJobs() {
  const res = await fetch('/jobs');
  const jobs = await res.json();
  const container = document.getElementById('jobs');
  container.innerHTML = '';
  jobs.forEach(j => {
    const div = document.createElement('div');
    div.textContent = `${j.job}: start ${j.laststart || 'n/a'} end ${j.lastend || 'n/a'} error ${j.lasterror || ''}`;
    container.appendChild(div);
  });
}

async function fetchFollowUps() {
  const res = await fetch('/followups');
  const items = await res.json();
  const container = document.getElementById('followups');
  container.innerHTML = '';
  items.forEach(f => {
    const div = document.createElement('div');
    const name = f.name || f.contactid;
    div.textContent = `${name} (${f.reason})`;
    container.appendChild(div);
  });
}

const socket = io();
socket.on('refresh', () => {
  fetchDrafts();
  fetchSent();
  fetchOutbox();
  fetchJobs();
  fetchFollowUps();
});

fetchDrafts();
fetchAsrStatus();
fetchSent();
fetchOutbox();
fetchJobs();
fetchFollowUps();

