# Using Google Generative AI

The application can now generate message drafts with Google's Gemini model. To enable it:

1. Set `llmEngine` to `"google"` in `config.json`.
2. Provide your API key in the `GEMINI_API_KEY` environment variable.

When this engine is selected, the prompt is sent to the Generative Language API and the returned text is used as the draft reply.
