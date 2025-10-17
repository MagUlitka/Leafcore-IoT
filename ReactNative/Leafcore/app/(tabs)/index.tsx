import { Image } from 'expo-image';
import { Platform, StyleSheet, Alert, Linking } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Link } from 'expo-router';
import { useState, useEffect } from 'react';
import { Text, View, Button, FlatList } from 'react-native';
import { BleManager as BleManagerPLX } from 'react-native-ble-plx';
import BleManager from 'react-native-ble-manager';
import { promptForEnableLocationIfNeeded } from 'react-native-android-location-enabler';
import { PERMISSIONS, RESULTS, request, requestMultiple } from 'react-native-permissions';

const GREENHOUSE_SERVICE_UUID = "12345678-1234-5678-1234-567890abcdef";
const SSID_CHAR_UUID    = "12345678-1234-5678-1234-567890abcde1";
const PASS_CHAR_UUID    = "12345678-1234-5678-1234-567890abcde2";
const DEVICE_NAME_PREFIX = "LC-Greenhouse";

const [wifiSsid, setWifiSsid] = useState('');
const [wifiPassword, setWifiPassword] = useState('');

const manager = new BleManagerPLX();

//Notes: check for other results states: RESULTS.UNAVAILABLE	This feature is not available (on this device / in this context)
                                       //  RESULTS.DENIED	The permission has not been requested / is denied but requestable
                                      //   RESULTS.BLOCKED	The permission is denied and not requestable
                                       //  RESULTS.GRANTED
// catch errors and display info to the user

export default function HomeScreen() {

  const scanForDevices = () => {
    manager.startDeviceScan([GREENHOUSE_SERVICE_UUID],null,(error,foundDevice) => {
      if (error) {
        Alert.alert("Scan Error", error.message);
        return;
      }

      if (foundDevice?.name?.startsWith(DEVICE_NAME_PREFIX)) {
        
      }

    })

  }
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
    const bluetoothPermissions = await requestMultiple([
        PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
        PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
    ]);
   const scanPermission = bluetoothPermissions[PERMISSIONS.ANDROID.BLUETOOTH_SCAN];
   const connectPermission = bluetoothPermissions[PERMISSIONS.ANDROID.BLUETOOTH_CONNECT];

   if (scanPermission !== RESULTS.GRANTED || connectPermission !== RESULTS.GRANTED) {
         Alert.alert("Permission Denied", "Bluetooth permissions are required for registration process.");
         return;
       }
       console.log("Bluetooth permissions granted.");
       console.log("Step 4: Checking Bluetooth state...");

       const state = await manager.state();

       if (state !== 'PoweredOn') {
          console.log("Bluetooth is off. Requesting to enable it...");
      try {
        await BleManager.enableBluetooth();
        console.log("Bluetooth has been enabled by the user.");
      } catch (error) {
        console.log("User did not enable Bluetooth. Opening settings as a fallback.");
        openBluetoothSettings();
        return;
      }
           }

           console.log("All permissions granted and services are on. Ready to start scanning!");
           Alert.alert("Success!", "All permissions are granted. Ready to start the pairing process.");
           //here add:
           //1. pairing
           //2. prompting user to choose a device
           //3. wifi permissions
           //4. wifi access
           //5. sending wifi data
           //6. wait for device's confirmation
           //7. turn bluetooth off
           //8. wait for device's data over wifi
           //9. make a post request to server
          }
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
});
