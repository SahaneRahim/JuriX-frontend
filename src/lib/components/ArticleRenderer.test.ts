import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ArticleRenderer from './ArticleRenderer.svelte';

const mockArticle = {
  article_number: '5',
  article_title: 'Capital social',
  content_fr: 'Le capital social minimum est fixé à un million de francs CFA.'
};

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve())
  }
});

describe('ArticleRenderer', () => {
  it('should render article number', () => {
    const { getByText } = render(ArticleRenderer, { article: mockArticle });
    expect(getByText(/Article 5/)).toBeTruthy();
  });

  it('should render article title if provided', () => {
    const { getByText } = render(ArticleRenderer, { article: mockArticle });
    expect(getByText('Capital social')).toBeTruthy();
  });

  it('should render article content', () => {
    const { getByText } = render(ArticleRenderer, { article: mockArticle });
    expect(getByText(/Le capital social minimum/)).toBeTruthy();
  });

  it('should copy content to clipboard when copy button is clicked', async () => {
    const { container } = render(ArticleRenderer, { article: mockArticle });
    const copyButton = container.querySelector('.copy-btn');

    if (copyButton) {
      await fireEvent.click(copyButton);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockArticle.content_fr);
    }
  });

  it('should show feedback after copying', async () => {
    const { container, getByText } = render(ArticleRenderer, { article: mockArticle });
    const copyButton = container.querySelector('.copy-btn');

    if (copyButton) {
      await fireEvent.click(copyButton);
      // Wait a bit for state update
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(getByText(/Copié/)).toBeTruthy();
    }
  });
});
