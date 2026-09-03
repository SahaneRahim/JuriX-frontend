import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PersonaSelectionModal from './PersonaSelectionModal.svelte';

describe('PersonaSelectionModal', () => {
  it('should not render when isOpen is false', () => {
    const { container } = render(PersonaSelectionModal, { isOpen: false });
    expect(container.querySelector('.modal-backdrop')).toBeFalsy();
  });

  it('should render when isOpen is true', () => {
    const { container } = render(PersonaSelectionModal, { isOpen: true });
    expect(container.querySelector('.modal-backdrop')).toBeTruthy();
  });

  it('should display all 4 persona options', () => {
    const { container } = render(PersonaSelectionModal, { props: { isOpen: true } });

    // Lecture des intitules eux-memes, pas d'un getByText en expression
    // reguliere : "Citoyen" et "Etudiant" figurent aussi dans les descriptions,
    // et getByText leve des qu'il trouve plusieurs correspondances.
    const names = Array.from(container.querySelectorAll('.persona-name')).map(
      (node) => node.textContent?.trim()
    );

    expect(names).toEqual(['Avocat / Juriste', 'Entrepreneur', 'Citoyen', 'Étudiant']);
  });

  it('should dispatch select event when persona is clicked', async () => {
    const selectHandler = vi.fn();
    // Svelte 5 a retire l'API d'instance $on. Les evenements de
    // createEventDispatcher se branchent a la construction, via l'option
    // `events` de mount, que @testing-library transmet telle quelle.
    const { getByText } = render(PersonaSelectionModal, {
      props: { isOpen: true },
      events: { select: selectHandler }
    });

    const lawyerCard = getByText(/Avocat/).closest('button');
    expect(lawyerCard).toBeTruthy();

    await fireEvent.click(lawyerCard!);
    expect(selectHandler).toHaveBeenCalled();
  });

  it('should close when close button is clicked', async () => {
    const closeHandler = vi.fn();
    // Svelte 5 a retire l'API d'instance $on. Les evenements de
    // createEventDispatcher se branchent a la construction, via l'option
    // `events` de mount, que @testing-library transmet telle quelle.
    const { container } = render(PersonaSelectionModal, {
      props: { isOpen: true },
      events: { close: closeHandler }
    });

    const closeButton = container.querySelector('.close-btn');
    expect(closeButton).toBeTruthy();

    await fireEvent.click(closeButton!);
    expect(closeHandler).toHaveBeenCalled();
  });
});
