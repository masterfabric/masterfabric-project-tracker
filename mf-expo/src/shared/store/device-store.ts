/**
 * Device store — user-scoped device state.
 * Devices are kept under the authenticated user; cleared on logout.
 */

import { create } from 'zustand';
import type { UserDevicePayload } from '../services/mf-go-api';

export type DeviceRegistrationStatus = 'idle' | 'pending' | 'registered' | 'failed';

export type AppLifecyclePhase = 'boot' | 'splash' | 'relaunch';

interface DeviceState {
  /** User's devices from mf-go myDevices (user-scoped) */
  userDevices: UserDevicePayload[];

  /** Current device ID (persistent, local) */
  currentDeviceId: string | null;

  /** Last successful registration timestamp */
  lastRegisteredAt: number | null;

  /** User ID when last registered (to detect user switch) */
  lastRegisteredUserId: string | null;

  /** Registration status */
  registrationStatus: DeviceRegistrationStatus;

  /** Last lifecycle phase that triggered registration */
  lastLifecyclePhase: AppLifecyclePhase | null;

  // Actions
  setUserDevices: (devices: UserDevicePayload[]) => void;
  setCurrentDeviceId: (id: string | null) => void;
  setLastRegisteredAt: (ts: number | null) => void;
  setLastRegisteredUserId: (userId: string | null) => void;
  setRegistrationStatus: (status: DeviceRegistrationStatus) => void;
  setLastLifecyclePhase: (phase: AppLifecyclePhase | null) => void;
  /** Reset device state (e.g. on logout) — keeps currentDeviceId */
  resetForLogout: () => void;
}

const initialState = {
  userDevices: [],
  currentDeviceId: null as string | null,
  lastRegisteredAt: null as number | null,
  lastRegisteredUserId: null as string | null,
  registrationStatus: 'idle' as DeviceRegistrationStatus,
  lastLifecyclePhase: null as AppLifecyclePhase | null,
};

export const useDeviceStore = create<DeviceState>((set, get) => ({
  ...initialState,

  setUserDevices: (userDevices) => set({ userDevices }),
  setCurrentDeviceId: (currentDeviceId) => set({ currentDeviceId }),
  setLastRegisteredAt: (lastRegisteredAt) => set({ lastRegisteredAt }),
  setLastRegisteredUserId: (lastRegisteredUserId) => set({ lastRegisteredUserId }),
  setRegistrationStatus: (registrationStatus) => set({ registrationStatus }),
  setLastLifecyclePhase: (lastLifecyclePhase) => set({ lastLifecyclePhase }),

  resetForLogout: () =>
    set({
      userDevices: [],
      lastRegisteredAt: null,
      lastRegisteredUserId: null,
      registrationStatus: 'idle',
      lastLifecyclePhase: null,
    }),
}));
