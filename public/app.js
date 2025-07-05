async function fetchDrafts() {
  const res = await fetch('/drafts');
  const drafts = await res.json();
  const list = document.getElementById('drafts');
  list.innerHTML = '';
  drafts.forEach(d => {
    const div = document.createElement('div');
    div.className = 'draft';
    div.textContent = d.drafttext;
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

const socket = io();
socket.on('refresh', () => {
  fetchDrafts();
  fetchSent();
});

fetchDrafts();
fetchAsrStatus();
fetchSent();

