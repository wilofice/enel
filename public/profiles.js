let currentId = null;

function getNumericContactNumber(contact) {
  if (!contact) return null;
  const id = contact.id || '';
  const rawContactNumber = contact.contactNumber || '';
  const hasPhoneId = id.toLowerCase().endsWith('@c.us');
  const source = rawContactNumber.toLowerCase().endsWith('@lid')
    ? (hasPhoneId ? id : '')
    : (rawContactNumber || (hasPhoneId ? id : ''));
  const digits = source.split('@')[0].replace(/\D/g, '');
  return digits.length >= 7 ? digits : null;
}

function formatContactNumber(contact) {
  const digits = getNumericContactNumber(contact);
  return digits ? '+' + digits : 'Unknown';
}

function displayName(contact) {
  if (contact && contact.name && contact.name.trim()) return contact.name.trim();
  const number = getNumericContactNumber(contact);
  return number ? '+' + number : (contact && contact.id ? contact.id : 'Unknown contact');
}

async function loadContacts() {
  const res = await fetch('/contacts');
  const contacts = await res.json();
  const list = document.getElementById('contactList');
  list.innerHTML = '';
  contacts.forEach(c => {
    const div = document.createElement('div');
    const phone = formatContactNumber(c);
    const label = displayName(c);
    div.textContent = phone !== 'Unknown' && label !== phone ? `${label} (${phone})` : label;
    div.style.cursor = 'pointer';
    div.onclick = () => selectContact(c);
    list.appendChild(div);
  });
}

async function selectContact(contact) {
  const res = await fetch('/contacts/' + contact.id);
  const data = await res.json();
  const merged = { ...contact, ...data, id: contact.id };
  currentId = merged.id;
  document.getElementById('contactName').textContent = displayName(merged);
  document.getElementById('contactNumber').textContent = 'Number: ' + formatContactNumber(merged);
  document.getElementById('contactId').textContent = 'WhatsApp ID: ' + merged.id;
  document.getElementById('profileText').value = merged.profile || '';
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
