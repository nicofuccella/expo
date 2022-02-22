import * as Log from '../../../../log';
import { AppleDeviceManager } from '../AppleDeviceManager';
import { ApplePlatformManager } from '../ApplePlatformManager';
import { assertSystemRequirementsAsync } from '../assertSystemRequirements';
import * as SimControl from '../simctl';

jest.mock('fs');
jest.mock(`../../../../log`);
jest.mock('../simctl');
jest.mock(`../assertSystemRequirements`);
jest.mock('../../ExpoGoInstaller');
jest.mock('../ensureSimulatorAppRunning');

const asMock = (fn: any): jest.Mock => fn;

afterAll(() => {
  AppleDeviceManager.resolveAsync = originalResolveDevice;
});

const originalResolveDevice = AppleDeviceManager.resolveAsync;

jest.mock('@expo/config', () => ({
  getConfig: jest.fn(() => ({
    pkg: {},
    exp: {
      sdkVersion: '45.0.0',
      name: 'my-app',
      slug: 'my-app',
    },
  })),
}));

describe('openAsync', () => {
  beforeEach(() => {
    asMock(assertSystemRequirementsAsync).mockReset();
    asMock(Log.log).mockReset();
    asMock(Log.warn).mockReset();
    asMock(Log.error).mockReset();
    AppleDeviceManager.resolveAsync = jest.fn(
      async () => new AppleDeviceManager({ udid: '123', name: 'iPhone 13' } as any)
    );
  });

  it(`opens a project in Expo Go`, async () => {
    const getExpoGoUrl = jest.fn(() => 'exp://localhost:19000/');
    const manager = new ApplePlatformManager('/', 19000, {
      getCustomRuntimeUrl: jest.fn(),
      getDevServerUrl: jest.fn(),
      getExpoGoUrl,
    });

    expect(await manager.openAsync({ runtime: 'expo' })).toStrictEqual({
      url: 'exp://localhost:19000/',
    });

    expect(AppleDeviceManager.resolveAsync).toHaveBeenCalledTimes(1);
    expect(assertSystemRequirementsAsync).toHaveBeenCalledTimes(1);
    expect(getExpoGoUrl).toHaveBeenCalledTimes(1);

    // Logging
    expect(Log.log).toHaveBeenCalledWith(expect.stringMatching(/Opening.*on.*iPhone/));
    expect(Log.warn).toHaveBeenCalledTimes(0);
    expect(Log.error).toHaveBeenCalledTimes(0);
  });

  it(`opens a project in a web browser`, async () => {
    const getDevServerUrl = jest.fn(() => 'http://localhost:19000/');
    const manager = new ApplePlatformManager('/', 19000, {
      getCustomRuntimeUrl: jest.fn(),
      getDevServerUrl,
      getExpoGoUrl: jest.fn(),
    });

    expect(await manager.openAsync({ runtime: 'web' })).toStrictEqual({
      url: 'http://localhost:19000/',
    });

    expect(AppleDeviceManager.resolveAsync).toHaveBeenCalledTimes(1);
    expect(assertSystemRequirementsAsync).toHaveBeenCalledTimes(1);
    expect(getDevServerUrl).toHaveBeenCalledTimes(1);

    // Logging
    expect(Log.log).toHaveBeenCalledWith(expect.stringMatching(/Opening.*on.*iPhone/));
    expect(Log.warn).toHaveBeenCalledTimes(0);
    expect(Log.error).toHaveBeenCalledTimes(0);
  });
  it(`opens a project in a custom development client`, async () => {
    const getCustomRuntimeUrl = jest.fn(() => 'custom://path');
    const manager = new ApplePlatformManager('/', 19000, {
      getCustomRuntimeUrl,
      getDevServerUrl: jest.fn(),
      getExpoGoUrl: jest.fn(),
    });
    manager._getAppIdResolver = jest.fn(() => ({
      getAppIdAsync: jest.fn(() => 'dev.bacon.app'),
    }));

    expect(await manager.openAsync({ runtime: 'custom' })).toStrictEqual({
      url: 'custom://path',
    });

    // Internals
    expect(AppleDeviceManager.resolveAsync).toHaveBeenCalledTimes(1);
    expect(getCustomRuntimeUrl).toHaveBeenCalledTimes(1);
    expect(assertSystemRequirementsAsync).toHaveBeenCalledTimes(1);

    // Logging
    expect(Log.log).toHaveBeenCalledWith(expect.stringMatching(/Opening.*on.*iPhone/));
    expect(Log.warn).toHaveBeenCalledTimes(0);
    expect(Log.error).toHaveBeenCalledTimes(0);
  });

  it(`opens a project in a custom development client using app identifier`, async () => {
    const getCustomRuntimeUrl = jest.fn(() => null);
    const manager = new ApplePlatformManager('/', 19000, {
      getCustomRuntimeUrl,
      getDevServerUrl: jest.fn(),
      getExpoGoUrl: jest.fn(),
    });
    manager._getAppIdResolver = jest.fn(() => ({
      getAppIdAsync: jest.fn(() => 'dev.bacon.app'),
    }));
    SimControl.openAppIdAsync = jest.fn(async () => ({ status: 0 }));

    expect(await manager.openAsync({ runtime: 'custom' })).toStrictEqual({
      url: 'dev.bacon.app',
    });

    // Internals
    expect(AppleDeviceManager.resolveAsync).toHaveBeenCalledTimes(1);
    expect(getCustomRuntimeUrl).toHaveBeenCalledTimes(1);
    expect(assertSystemRequirementsAsync).toHaveBeenCalledTimes(1);

    // Logging
    expect(Log.log).toHaveBeenCalledWith(expect.stringMatching(/Opening.*on.*iPhone/));
    expect(Log.warn).toHaveBeenCalledTimes(0);
    expect(Log.error).toHaveBeenCalledTimes(0);

    // Native invocation
    expect(SimControl.openAppIdAsync).toBeCalledWith(
      { name: 'iPhone 13', udid: '123' },
      { appId: 'dev.bacon.app' }
    );
  });
});
