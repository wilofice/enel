# Environment Verification

Run the following command before starting the app to verify required tools are available:

```bash
node src/checkEnv.js
```

The script checks that the `DATABASE_URL` is configured and that the `whisper` binary is available in your `PATH`. If any check fails the exit code will be non-zero.
