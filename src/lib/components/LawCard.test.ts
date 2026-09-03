import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import LawCard from './LawCard.svelte';

const mockLaw = {
  id: 1,
  reference: 'LOI-2024-001',
  title_fr: 'Loi sur les sociétés commerciales',
  type: 'law',
  category: 'Droit Commercial',
  status: 'active' as const,
  article_count: 150
};

describe('LawCard', () => {
  it('should render law information', () => {
    const { getByText } = render(LawCard, { law: mockLaw });
    expect(getByText('LOI-2024-001')).toBeTruthy();
    expect(getByText('Loi sur les sociétés commerciales')).toBeTruthy();
  });

  it('should display status badge', () => {
    const { getByText } = render(LawCard, { law: mockLaw });
    expect(getByText('Actif')).toBeTruthy();
  });

  it('should show metadata in full view', () => {
    const { getByText } = render(LawCard, { law: mockLaw, compact: false });
    expect(getByText(/Droit Commercial/)).toBeTruthy();
    expect(getByText(/150/)).toBeTruthy();
  });

  it('should hide metadata in compact view', () => {
    const { container } = render(LawCard, { law: mockLaw, compact: true });
    const metadata = container.querySelector('.metadata');
    expect(metadata).toBeFalsy();
  });

  it('should dispatch click event when clicked', async () => {
    const clickHandler = vi.fn();
    // Svelte 5 a retire l'API d'instance $on. Les evenements de
    // createEventDispatcher se branchent a la construction, via l'option
    // `events` de mount, que @testing-library transmet telle quelle.
    const { container } = render(LawCard, {
      props: { law: mockLaw },
      events: { click: clickHandler }
    });

    const card = container.querySelector('.law-card');
    expect(card).toBeTruthy();

    await fireEvent.click(card!);
    expect(clickHandler).toHaveBeenCalled();
  });
});
