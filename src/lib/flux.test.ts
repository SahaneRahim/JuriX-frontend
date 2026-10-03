import { describe, expect, it } from 'vitest';
import { lireEvenements } from './flux';

/** Une réponse dont le corps arrive dans les morceaux donnés, tels quels. */
function reponse(morceaux: string[]): Response {
  const encodeur = new TextEncoder();
  const corps = new ReadableStream<Uint8Array>({
    start(controle) {
      for (const m of morceaux) controle.enqueue(encodeur.encode(m));
      controle.close();
    },
  });
  return new Response(corps);
}

async function tous(response: Response) {
  const evenements = [];
  for await (const e of lireEvenements(response)) evenements.push(e);
  return evenements;
}

describe('lireEvenements', () => {
  it('rend les événements dans l’ordre', async () => {
    const evenements = await tous(
      reponse([
        'data: {"chunk":"Selon ","done":false}\n\n',
        'data: {"chunk":"l’article 33","done":false}\n\n',
        'data: {"chunk":"","done":true,"session_id":"s1"}\n\n',
      ]),
    );
    expect(evenements.map((e) => e.chunk)).toEqual(['Selon ', 'l’article 33', '']);
    expect(evenements[2]).toMatchObject({ done: true, session_id: 's1' });
  });

  it('recolle un événement coupé par le réseau', async () => {
    const evenements = await tous(
      reponse(['data: {"chunk":"Le per', 'mis","done":false}', '\n', '\ndata: {"done":true}\n\n']),
    );
    expect(evenements).toEqual([{ chunk: 'Le permis', done: false }, { done: true }]);
  });

  it('sépare plusieurs événements reçus d’un bloc', async () => {
    const evenements = await tous(
      reponse(['data: {"chunk":"a"}\n\ndata: {"chunk":"b"}\n\ndata: {"chunk":"c"}\n\n']),
    );
    expect(evenements.map((e) => e.chunk)).toEqual(['a', 'b', 'c']);
  });

  it('ne coupe pas un caractère accentué partagé entre deux morceaux', async () => {
    const octets = new TextEncoder().encode('data: {"chunk":"é"}\n\n');
    const corps = new ReadableStream<Uint8Array>({
      start(controle) {
        controle.enqueue(octets.slice(0, 13));
        controle.enqueue(octets.slice(13));
        controle.close();
      },
    });
    expect(await tous(new Response(corps))).toEqual([{ chunk: 'é' }]);
  });

  it('lit un dernier événement sans ligne vide finale', async () => {
    expect(await tous(reponse(['data: {"done":true,"error_code":"quota"}']))).toEqual([
      { done: true, error_code: 'quota' },
    ]);
  });

  it('ignore les commentaires et les événements illisibles', async () => {
    const evenements = await tous(
      reponse([': maintien\n\n', 'data: {pas du json\n\n', 'data: {"chunk":"ok"}\n\n']),
    );
    expect(evenements).toEqual([{ chunk: 'ok' }]);
  });
});
