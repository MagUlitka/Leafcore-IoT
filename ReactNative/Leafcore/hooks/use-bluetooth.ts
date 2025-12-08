import { useState, useEffect} from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { BleManager as BleManagerPLX, Device, BleError } from 'react-native-ble-plx';
import { PERMISSIONS, RESULTS, request, requestMultiple } from 'react-native-permissions';
import { promptForEnableLocationIfNeeded } from 'react-native-android-location-enabler';
import { Base64 } from 'js-base64';

import {
  LEAFCORE_SERVICE_UUID,
  SSID_CHAR_UUID,
  PASS_CHAR_UUID,
  SSID_EXEC_CHAR_UUID,
  PASS_EXEC_CHAR_UUID,
  DEVICE_NAME_PREFIX,
} from '@/constants/ble_constants'; 

const manager = new BleManagerPLX();

/**
 * A custom hook to manage all Bluetooth logic.
 */
export function useBluetooth() {

  /* Stany używane w tym komponencie - czyli nasze zmienne trzymające informacje o: połączonym urządzeniu, wykrytych urządzeniach (urządzeniach rozgłąszających serwis
  LC_Greenhouse (uwaga: nie wyświetlać urządzeń które już są zarejestrowane), 
  flagi o nadanych uprawnieniach do lokalizacji i bluetootha, czy obecnie telefon skanuje w poszukaniu urządzeń -> czy jest w trakcie łączenia się z urządzeniem -> czy wysyła dane do Wifi*/
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<Device[]>([]);
  
  const [isPermissionsGranted, setIsPermissionsGranted] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  /* pozwala na wykonywanie czynności pobocznych niezwiązanych z renderowanie UI elementu tj. API etc. 
  i synchronizuje komponent z systemem zewnętrznym (BLE managerem).
  Jest odpalany za każdym razem gdy zmieni się stan użyty w drugim argumencie (dependencies)
  
  async jest tu probably niepotrzebny? Sprawdzic*/
  useEffect(() => {
    const subscription = manager.onStateChange(async (state) => {
      if (state === 'PoweredOn' && isPermissionsGranted) {
        scanForDevices();
      } else if (state === 'PoweredOff') {
        Alert.alert("Bluetooth is Off", "Please turn on Bluetooth to use this app.");
      }
    }, true);
    return () => subscription.remove();
  }, [isPermissionsGranted]);

  /**
   * Opens the phone's settings so the user can enable Bluetooth.
   */
  const openBluetoothSettings = () => {
    if (Platform.OS !== 'android') return;
    Alert.alert(
      "Enable Bluetooth",
      "Please enable Bluetooth in your settings.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() }
      ]
    );
  };

  /**
   * Runs the entire permissions check flow for Android.
   */
  const requestAllPermissions = async () => {
    if (Platform.OS !== 'android') {
      return;
    }

    // 1. Check Location Permission
    const locationResult = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    if (locationResult !== RESULTS.GRANTED) {
      Alert.alert("Permission Denied", "Location permission is required for Bluetooth.");
      return;
    }

    // 2. Check Location Service
    try {
      const enableResult = await promptForEnableLocationIfNeeded();
      if (enableResult !== 'enabled' && enableResult !== 'already-enabled') {
        Alert.alert("Location is off", "Please enable location services.");
        return;
      }
    } catch (error) {
      Alert.alert("Error", "An error occurred enabling location services.");
      return;
    }

    // 3. Check Bluetooth Permissions (Android 12+)
    if (Platform.Version >= 31) {
      const blePermissions = await requestMultiple([
        PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
        PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
      ]);
      const scanPermission = blePermissions[PERMISSIONS.ANDROID.BLUETOOTH_SCAN];
      const connectPermission = blePermissions[PERMISSIONS.ANDROID.BLUETOOTH_CONNECT];

      if (scanPermission !== RESULTS.GRANTED || connectPermission !== RESULTS.GRANTED) {
        Alert.alert("Permission Denied", "Bluetooth permissions are required.");
        return;
      }
    }

    // 4. Check Bluetooth Power
    const state = await manager.state();
    if (state !== 'PoweredOn') {
      try {
        await manager.enable();
      } catch (error) {
        openBluetoothSettings();
        return;
      }
    }
    setIsPermissionsGranted(true);
  };

  /**
   * Scans for devices advertising the Greenhouse service.
   */
  const scanForDevices = async () => {
    const state = await manager.state();
    if (state !== 'PoweredOn') {
      Alert.alert("Bluetooth is Off", "Please enable Bluetooth to scan.");
      return;
    }

    setIsScanning(true);
    setDiscoveredDevices([]); 
    
    manager.startDeviceScan([LEAFCORE_SERVICE_UUID], null, (error, foundDevice) => {
      if (error) {
        Alert.alert("Scan Error", error.message);
        setIsScanning(false);
        return;
      }

      /* Tutaj do ifa trzeba dać sprawdzenie czy urządzenie o danym id serwisu (hardcoded w OrangePi) 
      jest już w bazie zarejestrowanych urządzeń (parent: LC_Greenhouse_1234 => czy 1234 jest zarejestrowane?) */
      if (foundDevice?.name?.startsWith(DEVICE_NAME_PREFIX)) {
        setDiscoveredDevices((prev) => {
          if (!prev.some((d) => d.id === foundDevice.id)) {
            return [...prev, foundDevice];
          }
          return prev;
        });
      }
    });
  };

  /**
   * Connects to a discovered device and discovers services.
   */
  const connectToDevice = async (device: Device) => {
    manager.stopDeviceScan();
    setIsScanning(false);
    setIsConnecting(true);
    try {
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      setConnectedDevice(connected);
      setDiscoveredDevices([]); // Clear list after connection
    } catch (error) {
      Alert.alert("Connection Failed", `Could not connect to ${device.name}.`);
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Disconnects from the currently connected device.
   */
  const disconnect = async () => {
    if (connectedDevice) {
      await connectedDevice.cancelConnection();
      setConnectedDevice(null);
    }
  };

  /**
   * Sends the Wi-Fi credentials to the connected device.
   */
  const sendWifiCredentials = async (ssid: string, password: string) => {
    if (!connectedDevice || !ssid || !password) {
      Alert.alert("Missing Information", "Device not connected or Wi-Fi info is incomplete.");
      return;
    }

    setIsSending(true);
    try {
      // Send SSID
      const ssidBase64 = Base64.encode(ssid);
      await connectedDevice.writeCharacteristicWithoutResponseForService(
        LEAFCORE_SERVICE_UUID, SSID_CHAR_UUID, ssidBase64
      );
      await connectedDevice.writeCharacteristicWithResponseForService(
        LEAFCORE_SERVICE_UUID, SSID_EXEC_CHAR_UUID, Base64.encode("1")
      );

      // Send Password
      const passBase64 = Base64.encode(password);
      await connectedDevice.writeCharacteristicWithoutResponseForService(
        LEAFCORE_SERVICE_UUID, PASS_CHAR_UUID, passBase64
      );
      await connectedDevice.writeCharacteristicWithResponseForService(
        LEAFCORE_SERVICE_UUID, PASS_EXEC_CHAR_UUID, Base64.encode("1")
      );
      
      Alert.alert("Success", "Wi-Fi credentials sent!");
      await connectedDevice.cancelConnection();
      setConnectedDevice(null);

    } catch (error) {
      console.error("FULL SEND ERROR:", error);
      if (error instanceof BleError) {
        Alert.alert("Send Error", `Reason: ${error.reason || error.message}\nError Code: ${error.errorCode}`);
      } else {
        Alert.alert("Send Error", "An unknown error occurred.");
      }
    } finally {
      setIsSending(false);
    }
  };

  // Return all the state and functions the UI will need
  return {
    requestAllPermissions,
    isPermissionsGranted,
    scanForDevices,
    isScanning,
    discoveredDevices,
    connectToDevice,
    isConnecting,
    connectedDevice,
    sendWifiCredentials,
    isSending,
    disconnect,
  };
}