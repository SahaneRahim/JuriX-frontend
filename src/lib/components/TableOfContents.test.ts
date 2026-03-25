import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import TableOfContents from './TableOfContents.svelte';

const mockArticles = [
  { id: 1, article_number: '1', article_title: 'Définitions' },
  { id: 2, article_number: '2', article_title: 'Champ d\'application' },
  { id: 3, article_number: '3' }
];

describe('TableOfContents', () => {
  it('should render all articles', () => {
    const { getByText } = render(TableOfContents, { articles: mockArticles });
    expect(getByText(/Art\. 1/)).toBeTruthy();
    expect(getByText(/Art\. 2/)).toBeTruthy();
    expect(getByText(/Art\. 3/)).toBeTruthy();
  });

  it('should display article titles when provided', () => {
    const { getByText } = render(TableOfContents, { articles: mockArticles });
    expect(getByText('Définitions')).toBeTruthy();
    expect(getByText(/Champ d'application/)).toBeTruthy();
  });

  it('should highlight active article', () => {
    const { container } = render(TableOfContents, {
      articles: mockArticles,
      activeArticle: 1
    });
    const links = container.querySelectorAll('.toc-link');
    expect(links[0].classList.contains('active')).toBe(true);
    expect(links[1].classList.contains('active')).toBe(false);
  });

  it('should dispatch navigate event when article is clicked', async () => {
    const component = render(TableOfContents, { articles: mockArticles });
    const navigateHandler = vi.fn();
    component.component.$on('navigate', navigateHandler);

    const firstLink = component.container.querySelector('.toc-link');
    if (firstLink) {
      await fireEvent.click(firstLink);
      expect(navigateHandler).toHaveBeenCalled();
    }
  });
});
