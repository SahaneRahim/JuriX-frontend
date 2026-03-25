import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import StatusBadge from './StatusBadge.svelte';

describe('StatusBadge', () => {
  it('should render with draft status', () => {
    const { getByText } = render(StatusBadge, { status: 'draft' });
    expect(getByText('Brouillon')).toBeTruthy();
  });

  it('should render with active status', () => {
    const { getByText } = render(StatusBadge, { status: 'active' });
    expect(getByText('Actif')).toBeTruthy();
  });

  it('should render with repealed status', () => {
    const { getByText } = render(StatusBadge, { status: 'repealed' });
    expect(getByText('Abrogé')).toBeTruthy();
  });

  it('should apply correct color for status', () => {
    const { container } = render(StatusBadge, { status: 'active' });
    const badge = container.querySelector('.status-badge');
    expect(badge?.getAttribute('data-color')).toBe('green');
  });

  it('should render with small size', () => {
    const { container } = render(StatusBadge, { status: 'draft', size: 'sm' });
    const badge = container.querySelector('.status-badge');
    expect(badge?.classList.contains('sm')).toBe(true);
  });

  it('should render with medium size by default', () => {
    const { container } = render(StatusBadge, { status: 'draft' });
    const badge = container.querySelector('.status-badge');
    expect(badge?.classList.contains('md')).toBe(true);
  });

  it('should render with large size', () => {
    const { container } = render(StatusBadge, { status: 'draft', size: 'lg' });
    const badge = container.querySelector('.status-badge');
    expect(badge?.classList.contains('lg')).toBe(true);
  });
});
