import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CopyButton from './CopyButton.jsx';

describe('CopyButton', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue() } });
  });

  it('copies the given value and shows confirmation', async () => {
    render(<CopyButton value="abc-123" />);
    fireEvent.click(screen.getByRole('button'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('abc-123');
    await waitFor(() => expect(screen.getByText('Copied!')).toBeInTheDocument());
  });

  it('renders a custom label when provided', () => {
    render(<CopyButton value="x" label="Copy ID" />);
    expect(screen.getByText('Copy ID')).toBeInTheDocument();
  });
});
