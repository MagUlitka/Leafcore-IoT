import { Image } from 'expo-image';
import { Alert, Linking, Platform, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';
import { Base64 } from 'js-base64';
import { useState } from 'react';
import { Button, Text } from 'react-native';
import { promptForEnableLocationIfNeeded } from 'react-native-android-location-enabler';
import { BleManager as BleManagerPLX, Device, BleError } from 'react-native-ble-plx';
import { PERMISSIONS, RESULTS, request, requestMultiple } from 'react-native-permissions';
import WifiManager from 'react-native-wifi-reborn';

const GREENHOUSE_SERVICE_UUID = "12345678-1234-5678-1234-567890abcdef";
const SSID_CHAR_UUID    = "12345678-1234-5678-1234-567890abcde1";
const PASS_CHAR_UUID    = "12345678-1234-5678-1234-567890abcde2";
const SSID_EXEC_CHAR_UUID = "12345678-1234-5678-1234-567890abcde3";
const PASS_EXEC_CHAR_UUID = "12345678-1234-5678-1234-567890abcde4";
const DEVICE_NAME_PREFIX = "Greenhouse";

const manager = new BleManagerPLX();

//Notes: check for other results states: RESULTS.UNAVAILABLE	This feature is not available (on this device / in this context)
                                       //  RESULTS.DENIED	The permission has not been requested / is denied but requestable
                                      //   RESULTS.BLOCKED	The permission is denied and not requestable
                                       //  RESULTS.GRANTED
// catch errors and display info to the user

export default function HomeScreen() {

  const [wifiSSID, setWifiSSID] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');

  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<Device[]>([]);

  const scanForDevices = async () => {

    const state = await manager.state();
    if (state !== 'PoweredOn') {
      Alert.alert(
        "Bluetooth is Off",
        "Please run 'Enable Location' first and ensure Bluetooth is enabled."
      );
      return;
    }
    manager.startDeviceScan([GREENHOUSE_SERVICE_UUID],null,(error,foundDevice) => {
      console.log("started scanning");
      if (error) {
        Alert.alert("Scan Error", error.message);
        return;
      }

      if (foundDevice?.name?.startsWith(DEVICE_NAME_PREFIX)) {
        setDiscoveredDevices((alreadyDiscoveredDevices) => {
          if (!alreadyDiscoveredDevices.some((device) => device.id === foundDevice.id)) {
            return [...alreadyDiscoveredDevices, foundDevice];
          }
          return alreadyDiscoveredDevices;
        });
        
      }

    })

  }

  const connectToFoundDevice = async (device: Device) => {
    manager.stopDeviceScan(); 
    try {
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      
      setConnectedDevice(connected);
      setDiscoveredDevices([]);

      getWifiSSID();

    } catch (error) {
      Alert.alert("Connection Failed", `Could not connect to ${device.name}.`);
    }
  };

  const getWifiSSID = async () => {
    try {
      const ssid = await WifiManager.getCurrentWifiSSID();
      setWifiSSID(ssid);
    } catch (error) {
      Alert.alert("Wi-Fi Error", "Could not get current Wi-Fi network name.");
    }
  };

  const sendWifiCredentials = async () => {
    if (!connectedDevice || !wifiSSID || !wifiPassword) {
      Alert.alert("Missing Information", "Device not connected or Wi-Fi info is incomplete.");
      return;
    }

    try {
      console.log("Encoding and sending SSID...");
      const ssidBase64 = Base64.encode(wifiSSID);
      await connectedDevice.writeCharacteristicWithoutResponseForService(
        GREENHOUSE_SERVICE_UUID, SSID_CHAR_UUID, ssidBase64
      );
      console.log("Sending SSID execute...");
      await connectedDevice.writeCharacteristicWithResponseForService(
        GREENHOUSE_SERVICE_UUID, SSID_EXEC_CHAR_UUID, Base64.encode("1")
      );

      console.log("Encoding and sending Password...");
      const passBase64 = Base64.encode(wifiPassword);
      await connectedDevice.writeCharacteristicWithoutResponseForService(
        GREENHOUSE_SERVICE_UUID, PASS_CHAR_UUID, passBase64
      );
      console.log("Sending Password execute...");
      await connectedDevice.writeCharacteristicWithResponseForService(
        GREENHOUSE_SERVICE_UUID, PASS_EXEC_CHAR_UUID, Base64.encode("1")
      );
      
      Alert.alert("Success", "Wi-Fi credentials sent!");
      await connectedDevice.cancelConnection();
      setConnectedDevice(null);

    } catch (error) {
       console.error("FULL SEND ERROR:", error);
       if (error instanceof BleError) {
         Alert.alert(
           "Send Error",
           `Reason: ${error.reason || error.message}\nError Code: ${error.errorCode}`
         );
       } else {
         Alert.alert("Send Error", "An unknown error occurred.");
       }
    }
  };

  const openBluetoothSettings = () => {
     if (Platform.OS !== 'android') {
    return;
  }
  
  Alert.alert(
    "Enable Bluetooth", 
    "To continue the registration process, please enable Bluetooth in your settings.", 
    [
      { 
        text: "Cancel",
        style: "cancel" 
      },
      { 
        text: "Open Settings", 
        onPress: () => Linking.openSettings() 
      }
    ]
  );
    }
  async function beginDeviceRegistrationProcess() {
      if (Platform.OS !== 'android') {
            return;
          }
      console.log("Step 1: Requesting Fine Location permission...");

      const accessFineLocationResult = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);

      if(accessFineLocationResult !== RESULTS.GRANTED){
           Alert.alert("Permission Denied", "Fine Location permission is required for the device registration process.");
           return;
           }

      console.log("Fine Location permission granted.");
      console.log("Step 2: Checking if Location service is enabled...");

      try {
        const enableResult = await promptForEnableLocationIfNeeded();
        console.log('enableResult', enableResult);
        if (enableResult !== 'enabled' && enableResult !== 'already-enabled') {
                Alert.alert("Location is off", "Please enable the location service to continue the registration process.");
                return;
              }
        console.log("Location service is on.");
    } 
    catch (error: unknown) {
      if (error instanceof Error) {
          Alert.alert("Error", "An error occurred while trying to enable location services.");
        console.error(error.message);
      }
    }
    console.log("Step 3: Requesting Bluetooth permissions...");
    let bluetoothPermissionsGranted = false;

  if (Platform.Version >= 31) { 
    const bluetoothPermissions = await requestMultiple([
      PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
      PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
    ]);
    const scanPermission = bluetoothPermissions[PERMISSIONS.ANDROID.BLUETOOTH_SCAN];
    const connectPermission = bluetoothPermissions[PERMISSIONS.ANDROID.BLUETOOTH_CONNECT];
    console.log('Scan Permission (Android 12+):', scanPermission);
    console.log('Connect Permission (Android 12+):', connectPermission);
    if (scanPermission !== RESULTS.GRANTED || connectPermission !== RESULTS.GRANTED) {
         Alert.alert("Permission Denied", "Bluetooth permissions are required for registration process.");
         return;
       }
    else {bluetoothPermissionsGranted = true}
    }
  else { 
    console.log('Android version < 12. Assuming manifest permissions are granted.');
    bluetoothPermissionsGranted = true;
  }

  if (!bluetoothPermissionsGranted) {
    Alert.alert("Permission Denied", "Bluetooth permissions are required for the registration process.");
    openBluetoothSettings();
    return;
  }
  console.log("Bluetooth permissions granted or not required at runtime.");

       console.log("Bluetooth permissions granted.");
       console.log("Step 4: Checking Bluetooth state...");

       const state = await manager.state();

       if (state !== 'PoweredOn') {
          console.log("Bluetooth is off. Requesting to enable it...");
      try {
        await manager.enable();
        console.log("Bluetooth has been enabled by the user.");
      } catch (error) {
        console.log("User did not enable Bluetooth. Opening settings as a fallback.");
        openBluetoothSettings();
        return;
      }
           }

           console.log("All permissions granted and services are on. Ready to start scanning!");
           Alert.alert("Success!", "All permissions are granted. Ready to start the pairing process.");
           scanForDevices();
           //here add:
           //6. wait for device's confirmation
           //7. turn bluetooth off
           //8. wait for device's data over wifi
           //9. make a post request to server
          }

          const renderDeviceItem = ({ item }: { item: Device }) => (
    <TouchableOpacity style={styles.deviceItem} onPress={() => connectToFoundDevice(item)}>
      <Text style={styles.deviceText}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Hello World!</ThemedText>
        <HelloWave />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <Button
          title="Enable Location (Android)"
          onPress={beginDeviceRegistrationProcess}
        />
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="title">Device Registration</ThemedText>
      </ThemedView>
      {!connectedDevice && (
  <ThemedView style={styles.stepContainer}>
    <Button title="Scan for Greenhouses" onPress={scanForDevices} />
    {discoveredDevices.map(device => (
      <TouchableOpacity 
        key={device.id}
        style={styles.deviceItem} 
        onPress={() => connectToFoundDevice(device)}
      >
        <Text style={styles.deviceText}>{device.name || 'Unnamed Device'}</Text>
      </TouchableOpacity>
    ))}

  </ThemedView>
)}
      {connectedDevice && (
        <ThemedView style={styles.stepContainer}>
          <ThemedText type="subtitle">Connect to Wi-Fi</ThemedText>
          <Text style={styles.label}>Network Name (SSID):</Text>
          <TextInput
            style={styles.input}
            value={wifiSSID}
            onChangeText={setWifiSSID}
            placeholder="Your Wi-Fi network name"
          />
          <Text style={styles.label}>Password:</Text>
          <TextInput
            style={styles.input}
            value={wifiPassword}
            onChangeText={setWifiPassword}
            placeholder="Your Wi-Fi password"
            secureTextEntry
          />
          <Button title="Send Credentials to Greenhouse" onPress={sendWifiCredentials} />
        </ThemedView>
      )}
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 1: Try it</ThemedText>
        <ThemedText>
          Edit <ThemedText type="defaultSemiBold">app/(tabs)/index.tsx</ThemedText> to see changes.
          Press{' '}
          <ThemedText type="defaultSemiBold">
            {Platform.select({
              ios: 'cmd + d',
              android: 'cmd + m',
              web: 'F12',
            })}
          </ThemedText>{' '}
          to open developer tools.
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <Link href="/modal">
          <Link.Trigger>
            <ThemedText type="subtitle">Step 2: Explore</ThemedText>
          </Link.Trigger>
          <Link.Preview />
          <Link.Menu>
            <Link.MenuAction title="Action" icon="cube" onPress={() => alert('Action pressed')} />
            <Link.MenuAction
              title="Share"
              icon="square.and.arrow.up"
              onPress={() => alert('Share pressed')}
            />
            <Link.Menu title="More" icon="ellipsis">
              <Link.MenuAction
                title="Delete"
                icon="trash"
                destructive
                onPress={() => alert('Delete pressed')}
              />
            </Link.Menu>
          </Link.Menu>
        </Link>

        <ThemedText>
          {`Tap the Explore tab to learn more about what's included in this starter app.`}
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
        <ThemedText>
          {`When you're ready, run `}
          <ThemedText type="defaultSemiBold">npm run reset-project</ThemedText> to get a fresh{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> directory. This will move the current{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> to{' '}
          <ThemedText type="defaultSemiBold">app-example</ThemedText>.
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  deviceItem: { padding: 15, marginVertical: 5, backgroundColor: '#f0f0f0', borderRadius: 8 },
  deviceText: { fontSize: 16, fontWeight: 'bold' },
  label: { fontSize: 16, fontWeight: '500', marginTop: 10 },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginTop: 5,
    backgroundColor: '#fff',
  }
});
