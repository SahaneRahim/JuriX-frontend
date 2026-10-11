import { describe, expect, it } from 'vitest';

import { cleDErreurHttp } from './chat-erreurs';

describe('cleDErreurHttp', () => {
  it.each([
    [503, null, 'chat.errorOverloaded'],
    [429, null, 'chat.errorQuota'],
    [404, null, 'chat.errorConversationGone'],
    [500, null, 'chat.errorServer'],
    [422, { detail: [{ loc: ['body', 'persona'], msg: 'Profil inconnu' }] }, 'chat.errorPersona'],
    [422, { detail: [{ loc: ['body', 'question'], msg: 'trop court' }] }, 'chat.errorInvalid'],
    [422, null, 'chat.errorInvalid'],
  ])('%i -> %s', (statut, corps, cle) => {
    expect(cleDErreurHttp(statut, corps)).toBe(cle);
  });
});
