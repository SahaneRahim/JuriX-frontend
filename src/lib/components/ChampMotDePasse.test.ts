import { createEvent, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChampMotDePasse from './ChampMotDePasse.svelte';

/**
 * Le champ de mot de passe et son bouton « Afficher / Masquer ».
 *
 * POURQUOI CES TESTS. Le bouton vit DANS un formulaire de connexion : un
 * oubli de `type="button"` en ferait un bouton d'envoi, et basculer
 * l'affichage enverrait le formulaire. Il ne doit pas non plus voler le focus
 * (le clavier du téléphone se refermerait à chaque appui), ni toucher à ce
 * que les pages et les gestionnaires de mots de passe lisent : l'id visé par
 * le `<label for>`, `autocomplete`, `data-testid`.
 */

/** Un formulaire avec son libellé, comme dans les pages, où monter le champ. */
function formulaire(): HTMLFormElement {
  const form = document.createElement('form');
  form.innerHTML = '<label for="mdp">Mot de passe</label>';
  document.body.appendChild(form);
  return form;
}

function monter(props: Record<string, unknown> = {}) {
  const form = formulaire();
  const rendu = render(ChampMotDePasse, {
    target: form,
    props: { id: 'mdp', autocomplete: 'current-password', 'data-testid': 'login-password', ...props },
  });
  const champ = form.querySelector('input') as HTMLInputElement;
  const bouton = form.querySelector('button') as HTMLButtonElement;
  return { ...rendu, form, champ, bouton };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ChampMotDePasse', () => {
  it('masque la saisie par défaut et reste rattaché au libellé de la page', () => {
    const { champ, bouton, getByLabelText } = monter();

    expect(champ.type).toBe('password');
    expect(getByLabelText('Mot de passe')).toBe(champ);
    expect(champ.getAttribute('data-testid')).toBe('login-password');
    expect(bouton.getAttribute('type')).toBe('button');
    expect(bouton.getAttribute('aria-pressed')).toBe('false');
    expect(bouton.getAttribute('aria-label')).toBe('Afficher le mot de passe');
    expect(bouton.getAttribute('aria-controls')).toBe('mdp');
    expect(bouton.querySelector('[data-icone="eye"]')).not.toBeNull();
  });

  it('affiche puis masque la saisie, et le dit', async () => {
    const { champ, bouton } = monter();

    await fireEvent.click(bouton);
    expect(champ.type).toBe('text');
    expect(bouton.getAttribute('aria-pressed')).toBe('true');
    expect(bouton.getAttribute('aria-label')).toBe('Masquer le mot de passe');
    expect(bouton.querySelector('[data-icone="eye-off"]')).not.toBeNull();

    await fireEvent.click(bouton);
    expect(champ.type).toBe('password');
    expect(bouton.getAttribute('aria-pressed')).toBe('false');
    expect(bouton.querySelector('[data-icone="eye"]')).not.toBeNull();
  });

  it('ne change ni autocomplete, ni la saisie, ni les attributs de la page', async () => {
    const { champ, bouton } = monter({
      autocomplete: 'new-password',
      required: true,
      minlength: '8',
      'aria-describedby': 'aide',
    });
    await fireEvent.input(champ, { target: { value: 'MotDePasse1' } });

    await fireEvent.click(bouton);

    expect(champ.autocomplete).toBe('new-password');
    expect(champ.value).toBe('MotDePasse1');
    expect(champ.required).toBe(true);
    expect(champ.getAttribute('minlength')).toBe('8');
    expect(champ.getAttribute('aria-describedby')).toBe('aide');
    // En clair, le clavier du téléphone ne doit ni corriger ni capitaliser.
    expect(champ.getAttribute('autocapitalize')).toBe('off');
    expect(champ.getAttribute('autocorrect')).toBe('off');
    expect(champ.getAttribute('spellcheck')).toBe('false');
  });

  it('laisse le focus et le curseur dans le champ', async () => {
    const { champ, bouton } = monter();
    await fireEvent.input(champ, { target: { value: 'MotDePasse1' } });
    champ.focus();
    champ.setSelectionRange(2, 5);

    // Le clic commence par `mousedown`, dont l'effet par défaut (donner le
    // focus au bouton) doit être annulé.
    const appui = createEvent.mouseDown(bouton);
    await fireEvent(bouton, appui);
    expect(appui.defaultPrevented).toBe(true);
    await fireEvent.click(bouton);

    expect(champ.type).toBe('text');
    expect(document.activeElement).toBe(champ);
    expect([champ.selectionStart, champ.selectionEnd]).toEqual([2, 5]);
  });

  it('activé au clavier, garde le focus sur le bouton', async () => {
    const { champ, bouton } = monter();
    bouton.focus();

    await fireEvent.click(bouton);

    expect(champ.type).toBe('text');
    expect(document.activeElement).toBe(bouton);
  });

  it("n'envoie jamais le formulaire", async () => {
    const { form, bouton } = monter();
    const envoi = vi.fn((evenement: Event) => evenement.preventDefault());
    form.addEventListener('submit', envoi);

    await fireEvent.click(bouton);
    await fireEvent.click(bouton);
    expect(envoi).not.toHaveBeenCalled();

    // Garde-fou du test lui-même : un envoi réel est bien vu.
    form.requestSubmit();
    expect(envoi).toHaveBeenCalledTimes(1);
  });

  it("masque de nouveau la saisie à l'envoi du formulaire", async () => {
    const { form, champ, bouton } = monter();
    form.addEventListener('submit', (evenement) => evenement.preventDefault());
    await fireEvent.click(bouton);
    expect(champ.type).toBe('text');

    form.requestSubmit();

    // Tout de suite, sans attendre la mise à jour du composant.
    expect(champ.type).toBe('password');
    await Promise.resolve();
    expect(bouton.getAttribute('aria-pressed')).toBe('false');
  });
});
