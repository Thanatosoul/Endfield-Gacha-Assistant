// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToggleSwitch } from '@/components/ToggleSwitch';

afterEach(cleanup);

describe('ToggleSwitch', () => {
  it('exposes switch semantics and reflects the checked state', () => {
    render(<ToggleSwitch checked onChange={() => {}} label="启用加密" />);
    const toggle = screen.getByRole('switch', { name: '启用加密' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('is unchecked by default when checked is false', () => {
    render(<ToggleSwitch checked={false} onChange={() => {}} label="启用加密" />);
    expect(screen.getByRole('switch', { name: '启用加密' })).toHaveAttribute('aria-checked', 'false');
  });

  it('emits the negated value on click', () => {
    const onChange = vi.fn();
    render(<ToggleSwitch checked={false} onChange={onChange} label="启用加密" />);
    fireEvent.click(screen.getByRole('switch', { name: '启用加密' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not emit when disabled', () => {
    const onChange = vi.fn();
    render(<ToggleSwitch checked={false} onChange={onChange} label="启用加密" disabled />);
    const toggle = screen.getByRole('switch', { name: '启用加密' });
    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(onChange).not.toHaveBeenCalled();
  });
});
