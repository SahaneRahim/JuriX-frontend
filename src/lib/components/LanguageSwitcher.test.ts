import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import LanguageSwitcher from './LanguageSwitcher.svelte';
import { language } from '$lib/stores/language';

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
    expect(enButton).toBeTruthy();

    await fireEvent.click(enButton!);

    // switchLanguage met a jour le store ; elle ne recharge PAS la page. Le
    // test attendait window.location.reload(), qui n'est appelee nulle part.
    expect(get(language).current).toBe('en');
  });
});
