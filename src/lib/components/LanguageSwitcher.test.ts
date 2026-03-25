import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import LanguageSwitcher from './LanguageSwitcher.svelte';
import { language } from '$lib/stores/language';

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true
});

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    language.set({ current: 'fr', showAllLanguages: false });
  });

  it('should render language buttons', () => {
    const { getByText } = render(LanguageSwitcher);
    expect(getByText('FR')).toBeTruthy();
    expect(getByText('EN')).toBeTruthy();
  });

  it('should show current language as active', () => {
    const { container } = render(LanguageSwitcher);
    const buttons = container.querySelectorAll('.language-btn');
    const frButton = Array.from(buttons).find(btn => btn.textContent?.includes('FR'));
    expect(frButton?.classList.contains('active')).toBe(true);
  });

  it('should call switchLanguage when clicking language button', async () => {
    const { getByText } = render(LanguageSwitcher);
    const enButton = getByText('EN').closest('button');

    if (enButton) {
      await fireEvent.click(enButton);
      // Note: window.location.reload() is called by switchLanguage
      expect(mockReload).toHaveBeenCalled();
    }
  });
});
