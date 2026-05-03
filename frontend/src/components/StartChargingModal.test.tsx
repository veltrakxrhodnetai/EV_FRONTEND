import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  postMock: vi.fn(),
  requestUseMock: vi.fn(),
}));

vi.mock('axios', () => {
  const instance = {
    post: mocks.postMock,
    get: vi.fn(),
    interceptors: {
      request: {
        use: mocks.requestUseMock,
      },
    },
  };

  return {
    default: {
      create: vi.fn(() => instance),
    },
    create: vi.fn(() => instance),
  };
});

import StartChargingModal from './StartChargingModal';

describe('StartChargingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fills amount mode, pays, and calls onStarted from /api/sessions/start response', async () => {
    mocks.postMock.mockResolvedValue({
      data: {
        sessionId: 'session-123',
        preAuthAmount: 100,
        preAuthId: 'preauth-1',
      },
    });

    const onStarted = vi.fn();
    const user = userEvent.setup();

    render(
      <StartChargingModal
        chargerId="CHARGER-01"
        connectorNumber={1}
        onStarted={onStarted}
      />
    );

    await user.click(screen.getByLabelText('Amount'));

    const limitInput = screen.getByLabelText('Limit Value');
    await user.clear(limitInput);
    await user.type(limitInput, '250');

    await user.click(screen.getByRole('button', { name: 'Pay' }));

    await waitFor(() => {
      expect(mocks.postMock).toHaveBeenCalledWith('/api/sessions/start', {
        chargerId: 'CHARGER-01',
        connectorNumber: 1,
        limitType: 'Amount',
        limitValue: 250,
      });
    });

    await waitFor(() => {
      expect(onStarted).toHaveBeenCalledWith('session-123');
    });
  });
});
