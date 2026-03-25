import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ShowAllLanguagesToggle from './ShowAllLanguagesToggle.svelte';
import { language } from '$lib/stores/language';

describe('ShowAllLanguagesToggle', () => {
  beforeEach(() => {
    language.set({ current: 'fr', showAllLanguages: false });
  });

  it('should render toggle with correct initial state', () => {
    const { getByText } = render(ShowAllLanguagesToggle);
    expect(getByText(/Filtering by FR/i)).toBeTruthy();
  });

  it('should show "Showing all languages" when toggle is on', () => {
    language.set({ current: 'fr', showAllLanguages: true });
    const { getByText } = render(ShowAllLanguagesToggle);
    expect(getByText(/Showing all languages/i)).toBeTruthy();
  });

  it('should toggle state when clicked', async () => {
    const { container } = render(ShowAllLanguagesToggle);
    const checkbox = container.querySelector('input[type="checkbox"]');

    expect(get(language).showAllLanguages).toBe(false);

    if (checkbox) {
      await fireEvent.change(checkbox);
      expect(get(language).showAllLanguages).toBe(true);
    }
  });
});
