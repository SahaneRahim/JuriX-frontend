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
    const { getByText } = render(PersonaSelectionModal, { isOpen: true });
    expect(getByText(/Avocat/)).toBeTruthy();
    expect(getByText(/Entrepreneur/)).toBeTruthy();
    expect(getByText(/Citoyen/)).toBeTruthy();
    expect(getByText(/Étudiant/)).toBeTruthy();
  });

  it('should dispatch select event when persona is clicked', async () => {
    const component = render(PersonaSelectionModal, { isOpen: true });
    const selectHandler = vi.fn();
    component.component.$on('select', selectHandler);

    const lawyerCard = component.getByText(/Avocat/).closest('button');
    if (lawyerCard) {
      await fireEvent.click(lawyerCard);
      expect(selectHandler).toHaveBeenCalled();
    }
  });

  it('should close when close button is clicked', async () => {
    const component = render(PersonaSelectionModal, { isOpen: true });
    const closeHandler = vi.fn();
    component.component.$on('close', closeHandler);

    const closeButton = component.container.querySelector('.close-btn');
    if (closeButton) {
      await fireEvent.click(closeButton);
      expect(closeHandler).toHaveBeenCalled();
    }
  });
});
