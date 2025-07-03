# Contact Profiling Job

This background job generates a short profile for each contact by analysing the messages stored in the database.
Both sides of the conversation are included so the LLM can infer how you relate to the contact.

## Usage

Run the job manually when you want to refresh contact profiles:

```
node src/profileJob.js
```

It fetches recent messages for every contact, sends them to a separate LLM (configured via `profileLlmEngine` and `profileLlmModel` in `config.json`), and updates the `profile` column in the `Contacts` table. The prompt asks the model to describe the relationship as well as basic details.

Profiles may evolve as more messages arrive, so rerun the job periodically.

