import { fireEvent, render, screen } from '@testing-library/react-native';

import { ConfirmDialog, type ConfirmDialogProps } from '../ConfirmDialog';

/**
 * Confirm dialog (§7.6, ADR-12): own modal, modal semantics for VoiceOver,
 * focus order title → message → cancel → confirm, and the Android back button
 * bound to the safe option.
 */

function makeProps(overrides: Partial<ConfirmDialogProps> = {}): ConfirmDialogProps {
  return {
    visible: true,
    title: '¿Reiniciar la partida?',
    message: 'Se perderán las 23 extracciones. El historial de esta partida se archivará.',
    confirmLabel: 'Reiniciar',
    onCancel: jest.fn(),
    onConfirm: jest.fn(),
    ...overrides,
  };
}

describe('ConfirmDialog — copy and semantics (§7.6)', () => {
  it('prints the exact restart copy', async () => {
    await render(<ConfirmDialog {...makeProps()} />);

    expect(screen.getByText('¿Reiniciar la partida?')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Se perderán las 23 extracciones. El historial de esta partida se archivará.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Cancelar')).toBeOnTheScreen();
    expect(screen.getByText('Reiniciar')).toBeOnTheScreen();
  });

  it('marks itself modal so VoiceOver stays inside', async () => {
    await render(<ConfirmDialog {...makeProps()} />);

    expect(screen.getByTestId('confirm-dialog').props.accessibilityViewIsModal).toBe(true);
  });

  it('focuses title, then message, then the two buttons in order', async () => {
    await render(<ConfirmDialog {...makeProps()} />);

    expect(screen.getByRole('header')).toHaveTextContent('¿Reiniciar la partida?');
    expect(screen.getAllByRole('button').map((node) => node.props.accessibilityLabel)).toEqual([
      'Cancelar',
      'Reiniciar',
    ]);
  });

  it('renders nothing while hidden', async () => {
    await render(<ConfirmDialog {...makeProps({ visible: false })} />);

    expect(screen.queryByTestId('confirm-dialog')).toBeNull();
  });
});

describe('ConfirmDialog — actions (§7.6)', () => {
  it('confirms without cancelling', async () => {
    const props = makeProps();
    await render(<ConfirmDialog {...props} />);

    await fireEvent.press(screen.getByTestId('confirm-confirm'));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('cancels without confirming', async () => {
    const props = makeProps();
    await render(<ConfirmDialog {...props} />);

    await fireEvent.press(screen.getByTestId('confirm-cancel'));

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('maps the Android back button to the safe option', async () => {
    const props = makeProps();
    await render(<ConfirmDialog {...props} />);

    // `requestClose` is what the Android hardware back button triggers.
    fireEvent(screen.getByTestId('confirm-modal'), 'requestClose');

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});
