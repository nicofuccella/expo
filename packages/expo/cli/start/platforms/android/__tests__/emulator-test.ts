import spawnAsync from '@expo/spawn-async';
import { spawn } from 'child_process';

import * as ADB from '../adb';
import { listAvdsAsync, startDeviceAsync } from '../emulator';

jest.mock('../adb', () => ({
  getAttachedDevicesAsync: jest.fn(),
  isBootAnimationCompleteAsync: jest.fn(),

  listDevicesAsync: jest.fn(() => Promise.resolve([])),
  startDeviceAsync: jest.fn(() => Promise.resolve()),
}));

const asMock = <T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> =>
  fn as jest.MockedFunction<T>;

jest.mock('@expo/spawn-async');

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

describe(listAvdsAsync, () => {
  it(`returns list of avds`, async () => {
    asMock(spawnAsync)
      .mockReset()
      .mockResolvedValueOnce({
        stdout: ['avd1', 'avd2'].join(jest.requireActual('os').EOL),
      } as any);

    await expect(listAvdsAsync()).resolves.toStrictEqual([
      { isAuthorized: true, isBooted: false, name: 'avd1', type: 'emulator' },
      { isAuthorized: true, isBooted: false, name: 'avd2', type: 'emulator' },
    ]);
  });
  it(`returns an empty list when emulator fails`, async () => {
    asMock(spawnAsync)
      .mockReset()
      .mockRejectedValueOnce({
        stderr: 'err',
      } as any);

    await expect(listAvdsAsync()).resolves.toStrictEqual([]);
  });
});

describe(startDeviceAsync, () => {
  it(`times out waiting for an emulator to start`, async () => {
    asMock(ADB.getAttachedDevicesAsync).mockClear().mockResolvedValue([]);

    asMock(spawn).mockClear().mockReturnValueOnce({
      unref: jest.fn(),
      on: jest.fn(),
    });

    await expect(startDeviceAsync({ name: 'foo' }, { timeout: 5 })).rejects.toThrow(
      /It took too long to start the Android emulator/
    );
  });
  it(`starts an emulator`, async () => {
    asMock(ADB.getAttachedDevicesAsync)
      .mockClear()
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          name: 'foo',
        },
      ]);
    asMock(ADB.isBootAnimationCompleteAsync).mockClear().mockResolvedValueOnce(true);

    asMock(spawn).mockClear().mockReturnValueOnce({
      unref: jest.fn(),
      on: jest.fn(),
    });

    await expect(
      startDeviceAsync({ name: 'foo' }, { timeout: 500, interval: 10 })
    ).resolves.toStrictEqual({
      name: 'foo',
    });
  });
});
