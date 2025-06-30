const { buildPrompt, sanitizeText } = require('../src/llm');

test('sanitizeText replaces links', () => {
  const input = 'check https://example.com please';
  expect(sanitizeText(input)).toBe('check [link] please');
});

test('buildPrompt uses contact name', () => {
  const hist = [
    { fromMe: false, text: 'hi', timestamp: 1 },
    { fromMe: true, text: 'yo', timestamp: 2 }
  ];
  const prompt = buildPrompt('persona', hist, 'ok', 3, 'Alice');
  expect(prompt).toContain('Alice: hi');
});
