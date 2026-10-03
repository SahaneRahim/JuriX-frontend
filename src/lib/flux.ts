/**
 * Lecture d'un flux d'événements serveur (SSE) reçu par `fetch`.
 *
 * `EventSource` ne convient pas au chat : il n'envoie que des GET, sans corps
 * ni en-tête d'autorisation, alors que `POST /rag/ask/stream` attend la
 * question en JSON et le jeton de l'utilisateur. On lit donc le corps de la
 * réponse au fil de l'eau.
 *
 * Le réseau découpe le flux où il veut : un événement peut arriver en deux
 * morceaux, ou trois événements dans un seul. Seule la ligne vide qui clôt un
 * événement fait foi.
 */

/** Un événement du chat en flux, tel que l'émet `RAGStreamChunk`. */
export interface EvenementDeFlux {
  chunk?: string;
  done?: boolean;
  sources?: unknown[];
  confidence?: number;
  session_id?: string;
  intent?: string;
  error?: string;
  error_code?: 'quota' | 'overloaded' | 'server';
}

/** Les lignes `data:` d'un événement, recollées ; `null` s'il n'en a aucune. */
function donneesDe(bloc: string): string | null {
  const lignes = bloc
    .split(/\r?\n/)
    .filter((ligne) => ligne.startsWith('data:'))
    .map((ligne) => ligne.slice(5).replace(/^ /, ''));
  return lignes.length ? lignes.join('\n') : null;
}

/**
 * Les événements JSON d'une réponse SSE, dans l'ordre d'arrivée.
 *
 * Un événement illisible est ignoré plutôt que de rompre le flux : la suite
 * de la réponse vaut mieux qu'une erreur.
 */
export async function* lireEvenements(response: Response): AsyncGenerator<EvenementDeFlux> {
  if (!response.body) return;
  const lecteur = response.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = '';

  const extraire = function* (): Generator<EvenementDeFlux> {
    let fin = tampon.search(/\r?\n\r?\n/);
    while (fin !== -1) {
      const bloc = tampon.slice(0, fin);
      tampon = tampon.slice(fin).replace(/^\r?\n\r?\n/, '');
      const donnees = donneesDe(bloc);
      if (donnees !== null) {
        try {
          yield JSON.parse(donnees) as EvenementDeFlux;
        } catch {
          // événement tronqué ou étranger : ignoré
        }
      }
      fin = tampon.search(/\r?\n\r?\n/);
    }
  };

  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    tampon += decodeur.decode(value, { stream: true });
    yield* extraire();
  }
  // Dernier événement sans ligne vide finale
  tampon += decodeur.decode();
  if (tampon.trim()) {
    tampon += '\n\n';
    yield* extraire();
  }
}
