async function loadContacts() {
  const res = await fetch('/contacts');
  const contacts = await res.json();
  const list = document.getElementById('contactList');
  list.innerHTML = '';
  contacts.forEach(c => {
    const div = document.createElement('div');
    div.textContent = c.name || c.id;
    div.style.cursor = 'pointer';
    div.onclick = () => selectContact(c.id, c.name);
    list.appendChild(div);
  });
}

let currentId = null;

async function selectContact(id, name) {
  const res = await fetch('/contacts/' + id);
  const data = await res.json();
  currentId = id;
  document.getElementById('contactName').textContent = name || id;
  document.getElementById('profileText').value = data.profile || '';
}

async function saveProfile() {
  if (!currentId) return;
  const text = document.getElementById('profileText').value;
  await fetch('/contacts/' + currentId + '/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: text })
  });
  alert('Saved');
}

document.getElementById('saveBtn').onclick = saveProfile;

loadContacts();
