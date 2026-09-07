import * as Device from 'expo-device';

export type DeviceSpecs = {
  name: string;
  model: string;
  manufacturer: string;
  os: string;
  abi: string;
  yearClass: string;
  totalRam: number;
  appMaxRam: number | null;
  isDevice: boolean;
};

export async function getDeviceSpecs(): Promise<DeviceSpecs> {
  let appMaxRam: number | null = null;
  try {
    appMaxRam = await Device.getMaxMemoryAsync();
  } catch {
    appMaxRam = null;
  }

  return {
    name: Device.deviceName ?? 'This device',
    model: Device.modelName ?? 'Unknown model',
    manufacturer: Device.manufacturer ?? Device.brand ?? 'Unknown',
    os: [Device.osName, Device.osVersion].filter(Boolean).join(' '),
    abi: Device.supportedCpuArchitectures?.join(', ') ?? 'Unknown ABI',
    yearClass: Device.deviceYearClass != null ? String(Device.deviceYearClass) : 'Unknown',
    totalRam: Device.totalMemory ?? 0,
    appMaxRam,
    isDevice: Device.isDevice,
  };
}
