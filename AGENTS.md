# Development Guidelines

- Keep code modular and use CommonJS modules.
- Format code with 2-space indentation.
- Place new documentation under `docs/`.
- After making changes, run `node src/setupDb.js` followed by `npm start` to ensure the app boots.
- If you need a PostgreSQL instance quickly, you can start one with Docker:
  `docker run --name enel-postgres -e POSTGRES_PASSWORD=pass -p 5432:5432 -d postgres`
