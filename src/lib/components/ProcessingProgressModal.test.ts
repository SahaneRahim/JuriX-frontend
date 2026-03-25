import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ProcessingProgressModal from './ProcessingProgressModal.svelte';

describe('ProcessingProgressModal', () => {
  it('should not render when isOpen is false', () => {
    const { container } = render(ProcessingProgressModal, { isOpen: false, progress: 50 });
    expect(container.querySelector('.modal-backdrop')).toBeFalsy();
  });

  it('should render when isOpen is true', () => {
    const { container } = render(ProcessingProgressModal, { isOpen: true, progress: 50 });
    expect(container.querySelector('.modal-backdrop')).toBeTruthy();
  });

  it('should display progress percentage', () => {
    const { getByText } = render(ProcessingProgressModal, {
      isOpen: true,
      progress: 75,
      status: 'Processing...'
    });
    expect(getByText('75%')).toBeTruthy();
  });

  it('should show status message', () => {
    const { getByText } = render(ProcessingProgressModal, {
      isOpen: true,
      progress: 50,
      status: 'Analyzing document...'
    });
    expect(getByText('Analyzing document...')).toBeTruthy();
  });

  it('should display error message when error is present', () => {
    const { getByText } = render(ProcessingProgressModal, {
      isOpen: true,
      progress: 0,
      status: '',
      error: 'Failed to process document'
    });
    expect(getByText('Failed to process document')).toBeTruthy();
    expect(getByText(/Échec du traitement/)).toBeTruthy();
  });

  it('should show completion message when progress is 100%', () => {
    const { getByText } = render(ProcessingProgressModal, {
      isOpen: true,
      progress: 100,
      status: 'Complete'
    });
    expect(getByText(/Traitement terminé/)).toBeTruthy();
  });

  it('should clamp progress between 0 and 100', () => {
    const { getByText: getText1 } = render(ProcessingProgressModal, {
      isOpen: true,
      progress: 150
    });
    expect(getText1('100%')).toBeTruthy();

    const { getByText: getText2 } = render(ProcessingProgressModal, {
      isOpen: true,
      progress: -10
    });
    expect(getText2('0%')).toBeTruthy();
  });
});
