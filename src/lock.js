const fs = require('fs');
const path = require('path');

const LOCK_FILE = path.join(__dirname, '../app.lock');

function acquireLock() {
    if (fs.existsSync(LOCK_FILE)) {
        const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'), 10);
        try {
            // Check if the process is still running
            process.kill(pid, 0);
            console.error(`Application is already running (PID: ${pid}). Exiting.`);
            process.exit(1);
        } catch (e) {
            // Process is not running, safe to remove stale lock file
            console.log('Removing stale lock file.');
            fs.unlinkSync(LOCK_FILE);
        }
    }

    fs.writeFileSync(LOCK_FILE, process.pid.toString(), 'utf8');

    // Ensure lock file is removed on exit
    process.on('exit', () => {
        try {
            if (fs.existsSync(LOCK_FILE)) {
                const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'), 10);
                if (pid === process.pid) {
                    fs.unlinkSync(LOCK_FILE);
                }
            }
        } catch (e) {
            // Ignore errors during exit
        }
    });

    // Handle common signals to ensure exit handlers run
    ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig => {
        process.on(sig, () => {
            process.exit(0);
        });
    });
}

module.exports = { acquireLock };
