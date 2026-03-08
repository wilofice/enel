const { pool } = require('./db');

async function cleanup() {
    console.log('Starting contact cleanup...');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const targetIds = [
            'status@broadcast',
            '%@newsletter',
            '%@g.us'
        ];

        // 1. Delete dependent records of messages from system contacts
        await client.query(`
      DELETE FROM Transcripts WHERE messageId IN (SELECT id FROM Messages WHERE chatId = 'status@broadcast' OR chatId LIKE '%@newsletter' OR chatId LIKE '%@g.us')
    `);
        await client.query(`
      DELETE FROM Attachments WHERE messageId IN (SELECT id FROM Messages WHERE chatId = 'status@broadcast' OR chatId LIKE '%@newsletter' OR chatId LIKE '%@g.us')
    `);
        await client.query(`
      DELETE FROM AiReplies WHERE originalMessageId IN (SELECT id FROM Messages WHERE chatId = 'status@broadcast' OR chatId LIKE '%@newsletter' OR chatId LIKE '%@g.us')
    `);
        await client.query(`
      DELETE FROM Outbox WHERE sourceMessageId IN (SELECT id FROM Messages WHERE chatId = 'status@broadcast' OR chatId LIKE '%@newsletter' OR chatId LIKE '%@g.us')
    `);
        await client.query(`
      DELETE FROM VectorMeta WHERE messageId IN (SELECT id FROM Messages WHERE chatId = 'status@broadcast' OR chatId LIKE '%@newsletter' OR chatId LIKE '%@g.us')
    `);

        // 2. Delete messages from system contacts
        await client.query(`
      DELETE FROM Messages WHERE chatId = 'status@broadcast' OR chatId LIKE '%@newsletter' OR chatId LIKE '%@g.us'
    `);

        // 3. Delete followups
        await client.query(`
      DELETE FROM FollowUps WHERE contactId = 'status@broadcast' OR contactId LIKE '%@newsletter' OR contactId LIKE '%@g.us'
    `);

        // 4. Finally delete the contacts
        const { rowCount } = await client.query(`
      DELETE FROM Contacts 
      WHERE id = 'status@broadcast' 
         OR id LIKE '%@newsletter' 
         OR id LIKE '%@g.us'
    `);

        await client.query('COMMIT');
        console.log(`Cleanup complete. Removed ${rowCount} non-human contact(s) and their associated data.`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Cleanup failed:', err.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

if (require.main === module) {
    cleanup();
}

module.exports = { cleanup };
