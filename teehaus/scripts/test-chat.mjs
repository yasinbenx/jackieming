// Lokaler Test der Serverless Function mit gestubbtem fetch (kein Netz, kein Schlüssel nötig).
// Aufruf: node scripts/test-chat.mjs
import assert from 'node:assert/strict';

let mode = 'ok';
let calls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (!String(url).includes('api.anthropic.com')) return realFetch(url, init);
  calls++;
  const msg = (content, stop = 'end_turn') =>
    new Response(
      JSON.stringify({
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'x',
        stop_reason: stop,
        stop_sequence: null,
        content,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  if (mode === 'ok')
    return msg([
      {
        type: 'text',
        text: JSON.stringify({
          answer: 'Ha! Ich liebe Tee.',
          topic_ok: true,
          word: { zh: '茶', py: 'cha2', de: 'Tee' },
        }),
      },
    ]);
  if (mode === 'badword')
    return msg([
      {
        type: 'text',
        text: JSON.stringify({ answer: 'Hm.', topic_ok: false, word: { zh: '<script>', py: 'x!', de: 'y' } }),
      },
    ]);
  if (mode === 'refusal') return msg([], 'refusal');
  if (mode === 'malformed') return msg([{ type: 'text', text: 'kein json' }]);
  return new Response('{"error":{"type":"api_error","message":"boom"}}', {
    status: 500,
    headers: { 'content-type': 'application/json' },
  });
};

const { GET, POST } = await import('../api/chat.ts');
const req = (body, headers = {}) =>
  new Request('http://x/api/chat', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'x-forwarded-for': '1.1.1.1', ...headers },
  });
const call = async (r) => {
  const res = await POST(r);
  return [res.status, await res.json()];
};

// ohne Schlüssel
delete process.env.ANTHROPIC_API_KEY;
assert.deepEqual(await (await GET()).json(), { enabled: false, maxChars: 200 });
let [s, b] = await call(req({ who: 'jackie', message: 'Hallo' }));
assert.equal(s, 503);
assert.equal(b.fallback, true);

process.env.ANTHROPIC_API_KEY = 'test';
assert.equal((await (await GET()).json()).enabled, true);

// Eingaben
[s] = await call(req('kein json'));
assert.equal(s, 400);
[s] = await call(req({ who: 'nobody', message: 'x' }));
assert.equal(s, 400);
[s] = await call(req({ who: 'yao', message: '' }));
assert.equal(s, 400);
[s, b] = await call(req({ who: 'yao', message: 'a'.repeat(201) }));
assert.equal(s, 400);
assert.equal(b.reason, 'too_long');
[s] = await call(req({ who: 'yao', message: 'x'.repeat(7000) }));
assert.equal(s, 413);
assert.equal(calls, 0, 'ungültige Eingaben dürfen die API nicht erreichen');

// Erfolg + Wort
[s, b] = await call(
  req(
    {
      who: 'jackie',
      message: 'Was trinkst du gern?',
      history: [
        { role: 'assistant', content: 'x' },
        { role: 'user', content: 'y' },
      ],
    },
    { 'x-forwarded-for': '2.2.2.2' },
  ),
);
assert.equal(s, 200);
assert.equal(b.ok, true);
assert.equal(b.word.zh, '茶');
assert.equal(calls, 1);

// ungültiges Wort wird verworfen
mode = 'badword';
[s, b] = await call(req({ who: 'yao', message: 'Hi' }, { 'x-forwarded-for': '3.3.3.3' }));
assert.equal(b.ok, true);
assert.equal(b.word, null);
assert.equal(b.topicOk, false);

// Refusal, Müll, Fehler -> Fallback
for (const m of ['refusal', 'malformed', 'error']) {
  mode = m;
  [s, b] = await call(req({ who: 'yao', message: 'Hi' }, { 'x-forwarded-for': `4.4.4.${m.length}` }));
  assert.equal(b.fallback, true, m);
}

// Origin-Prüfung
process.env.ALLOWED_ORIGIN = 'https://teehaus.example';
mode = 'ok';
[s] = await call(
  req({ who: 'yao', message: 'Hi' }, { origin: 'https://evil.example', 'x-forwarded-for': '5.5.5.5' }),
);
assert.equal(s, 403);
[s] = await call(
  req({ who: 'yao', message: 'Hi' }, { origin: 'https://teehaus.example', 'x-forwarded-for': '5.5.5.5' }),
);
assert.equal(s, 200);
delete process.env.ALLOWED_ORIGIN;

// Rate-Limit: 12 pro Fenster und IP
let last;
for (let i = 0; i < 14; i++)
  [last, b] = await call(req({ who: 'yao', message: 'Hi' }, { 'x-forwarded-for': '9.9.9.9' }));
assert.equal(last, 429);
assert.equal(b.reason, 'rate');
console.log('chat: alle Tests bestanden');
