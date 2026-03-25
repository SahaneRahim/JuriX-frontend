import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SourceCard from './SourceCard.svelte';

const mockSource = {
  law_id: 1,
  law_reference: 'LOI-2024-001',
  article_id: 10,
  article_number: '5',
  excerpt: 'Le capital social minimum est fixé à...',
  relevance: 0.92
};

describe('SourceCard', () => {
  it('should render source information', () => {
    const { getByText } = render(SourceCard, { source: mockSource });
    expect(getByText('LOI-2024-001')).toBeTruthy();
    expect(getByText(/Article 5/)).toBeTruthy();
    expect(getByText(/Le capital social minimum/)).toBeTruthy();
  });

  it('should display relevance score', () => {
    const { getByText } = render(SourceCard, { source: mockSource });
    expect(getByText('92%')).toBeTruthy();
  });

  it('should not display relevance if not provided', () => {
    const sourceWithoutRelevance = { ...mockSource, relevance: undefined };
    const { container } = render(SourceCard, { source: sourceWithoutRelevance });
    expect(container.querySelector('.relevance-badge')).toBeFalsy();
  });

  it('should dispatch click event when clicked', async () => {
    const component = render(SourceCard, { source: mockSource });
    const clickHandler = vi.fn();
    component.component.$on('click', clickHandler);

    const card = component.container.querySelector('.source-card');
    if (card) {
      await fireEvent.click(card);
      expect(clickHandler).toHaveBeenCalled();
    }
  });
});
