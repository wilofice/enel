const inquirer = require('inquirer');

async function confirmDraft(draftText) {
  if (!draftText) draftText = '';
  console.log('\nDraft reply:\n');
  console.log(draftText);
  console.log('');

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Send this reply?',
      choices: [
        { name: 'Approve', value: 'approve' },
        { name: 'Edit', value: 'edit' },
        { name: 'Reject', value: 'reject' }
      ]
    }
  ]);

  if (action === 'reject') return null;

  let finalText = draftText;
  if (action === 'edit') {
    const { text } = await inquirer.prompt([
      {
        type: 'editor',
        name: 'text',
        message: 'Edit the reply and save:',
        default: draftText
      }
    ]);
    finalText = text.trim();
  }

  return finalText;
}

if (require.main === module) {
  (async () => {
    const result = await confirmDraft('Hello! This is a sample draft message.');
    console.log('Final result:', result);
  })();
}

module.exports = confirmDraft;
