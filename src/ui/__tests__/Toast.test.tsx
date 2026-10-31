import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { Toast, TOAST_MS, useToast } from '../Toast';

/**
 * Toast behaviour (§7.4): transient, announced politely and replaced — never
 * queued. The duration is injected here so the suite does not wait 2.5 s.
 */

const SHORT_MS = 30;

function Host({ message = 'Bola 67 devuelta al bombo' }: { readonly message?: string }) {
  const toast = useToast(SHORT_MS);
  return (
    <>
      <Pressable testID="show" onPress={() => toast.show(message)}>
        <Text>show</Text>
      </Pressable>
      <Toast message={toast.message} />
    </>
  );
}

describe('Toast (§7.4)', () => {
  it('renders nothing until a message arrives', async () => {
    await render(<Host />);

    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('announces the message and removes it after the duration', async () => {
    await render(<Host />);

    await fireEvent.press(screen.getByTestId('show'));

    const toast = screen.getByTestId('toast');
    expect(toast.props.accessibilityLiveRegion).toBe('polite');
    expect(toast.props.accessibilityLabel).toBe('Bola 67 devuelta al bombo');

    await waitFor(() => expect(screen.queryByTestId('toast')).toBeNull());
  });

  it('replaces the current message instead of queueing a second one', async () => {
    await render(<Host />);

    await fireEvent.press(screen.getByTestId('show'));
    await fireEvent.press(screen.getByTestId('show'));

    expect(screen.getAllByTestId('toast')).toHaveLength(1);
  });

  it('documents the production duration', () => {
    expect(TOAST_MS).toBe(2500);
  });
});
