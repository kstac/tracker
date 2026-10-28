import {buildChatRequest, ChatMessage, parseChatResponse} from '@/lib/ai';

jest.mock('expo-secure-store', () => ({}));
jest.mock('@/db/repo', () => ({}));

const messages: ChatMessage[] = [
  {role: 'user', content: 'How did I sleep?'},
  {role: 'assistant', content: 'Well.'},
  {role: 'user', content: 'Why?'},
];

describe('buildChatRequest', () => {
  it('sends Gemini the data as a system instruction and maps assistant turns to model', () => {
    const req = buildChatRequest('gemini', 'gemini-flash-latest', 'AIzaKEY', messages, 'DATA');
    const system = (req.body as {systemInstruction: {parts: {text: string}[]}}).systemInstruction.parts[0].text;
    expect(system).toContain('<data>\nDATA\n</data>');
    expect(req).toEqual({
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
      headers: {'content-type': 'application/json', 'x-goog-api-key': 'AIzaKEY'},
      body: {
        systemInstruction: {parts: [{text: system}]},
        contents: [
          {role: 'user', parts: [{text: 'How did I sleep?'}]},
          {role: 'model', parts: [{text: 'Well.'}]},
          {role: 'user', parts: [{text: 'Why?'}]},
        ],
      },
    });
  });

  it('sends Anthropic the messages unchanged with the data in the system prompt', () => {
    const req = buildChatRequest('anthropic', 'claude-opus-5-5', 'sk-ant-KEY', messages, 'DATA');
    const system = (req.body as {system: string}).system;
    expect(system).toContain('<data>\nDATA\n</data>');
    expect(req).toEqual({
      url: 'https://api.anthropic.com/v1/messages',
      headers: {'content-type': 'application/json', 'x-api-key': 'sk-ant-KEY', 'anthropic-version': '2023-06-01'},
      body: {model: 'claude-opus-5-5', max_tokens: 1200, system, messages},
    });
  });
});

describe('parseChatResponse', () => {
  it('joins Gemini text parts and skips thoughts', () => {
    const body = {candidates: [{content: {parts: [{text: 'thinking', thought: true}, {text: 'Slept '}, {text: 'well.'}]}}]};
    expect(parseChatResponse('gemini', body)).toBe('Slept well.');
  });

  it('reports a blocked Gemini prompt', () => {
    expect(() => parseChatResponse('gemini', {promptFeedback: {blockReason: 'SAFETY'}})).toThrow('Gemini declined to answer (SAFETY).');
  });

  it('returns nothing when Gemini sends no candidates', () => {
    expect(parseChatResponse('gemini', {})).toBe('');
  });

  it('joins Anthropic text blocks', () => {
    expect(parseChatResponse('anthropic', {content: [{type: 'text', text: 'A'}, {type: 'tool_use'}, {type: 'text', text: 'B'}]})).toBe('A\nB');
  });
});
