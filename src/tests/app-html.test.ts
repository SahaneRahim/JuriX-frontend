// @vitest-environment node
import { describe, expect, it } from 'vitest';
import gabarit from '../app.html?raw';

/**
 * src/app.html est le gabarit de CHAQUE page HTML, envoyé tel quel : SvelteKit
 * n'en retire aucun commentaire. Les raisons du préchargement sont donc écrites
 * dans svelte.config.js, loin de l'attribut qu'elles justifient ; ce test garde
 * les deux d'accord, et le <body> sans long commentaire (celui qui expliquait
 * le préchargement pesait 863 octets, dans chaque page).
 *
 * Le <head> n'est pas contrôlé : ses commentaires mettent en garde contre des
 * « corrections » faites sur place (zoom bloqué, script du thème retiré), et
 * doivent rester sous les yeux de qui y touche.
 */
const APRES_LE_HEAD = gabarit.slice(gabarit.indexOf('</head>'));
const BALISE_BODY = /<body\b[^>]*>/.exec(APRES_LE_HEAD)?.[0] ?? '';

describe('src/app.html', () => {
  it('précharge les pages au survol, données et code ensemble', () => {
    expect(BALISE_BODY).toContain('data-sveltekit-preload-data="hover"');
    // preload-data charge déjà le code de la route avec ses données, et
    // preload-code="viewport" est écarté (svelte.config.js) : aucun attribut
    // preload-code sur le <body>.
    expect(BALISE_BODY).not.toContain('data-sveltekit-preload-code');
  });

  it("ne garde après le <head> que des commentaires d'une ligne", () => {
    const commentaires = APRES_LE_HEAD.match(/<!--[\s\S]*?-->/g) ?? [];
    for (const commentaire of commentaires) {
      expect(commentaire).not.toContain('\n');
    }
  });
});
