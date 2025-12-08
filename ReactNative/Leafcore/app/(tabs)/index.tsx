import { Image } from 'expo-image';
import { 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Platform, 
  Alert 
} from 'react-native';
import { useState, useEffect } from 'react';
import { Button, Text } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { HelloWave } from '@/components/hello-wave';
import { Link } from 'expo-router';

// Import our new custom hooks
import { useBluetooth } from '@/hooks/use-bluetooth';
import { useWifi } from '@/hooks/use-wifi';

export default function HomeScreen() {
  // --- 1. Call our hooks ---
  const { 
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
  } = useBluetooth(); // <--- IT IS CALLED RIGHT HERE

  const { ssid, setSsid, getCurrentWifiSsid } = useWifi();
  
  // Only the password stays as local state
  const [wifiPassword, setWifiPassword] = useState('');

  // --- 2. Logic to run when things change ---
  useEffect(() => {
    // When we connect, automatically get the current Wi-Fi SSID
    if (connectedDevice) {
      getCurrentWifiSsid();
    }
  }, [connectedDevice, getCurrentWifiSsid]);

  // --- 3. Helper to render the current UI state ---
  const renderContent = () => {
    // ---- State 1: Connected ----
    if (connectedDevice) {
      return (
        <ThemedView style={styles.stepContainer}>
          <ThemedText type="subtitle">Connected to {connectedDevice.name}</ThemedText>
          <ThemedText type="subtitle">Connect to Wi-Fi</ThemedText>
          
          <Text style={styles.label}>Network Name (SSID):</Text>
          <TextInput
            style={styles.input}
            value={ssid}
            onChangeText={setSsid}
            placeholder="Your Wi-Fi network name"
            placeholderTextColor="#888"
          />
          <Text style={styles.label}>Password:</Text>
          <TextInput
            style={styles.input}
            value={wifiPassword}
            onChangeText={setWifiPassword}
            placeholder="Your Wi-Fi password"
            placeholderTextColor="#888"
            secureTextEntry
          />
          <Button 
            title={isSending ? "Sending..." : "Send Credentials"} 
            onPress={() => sendWifiCredentials(ssid, wifiPassword)} 
            disabled={isSending}
          />
          <Button 
            title="Disconnect" 
            onPress={disconnect} 
            color="red"
          />
        </ThemedView>
      );
    }

    // ---- State 2: Permissions not granted ----
    if (!isPermissionsGranted) {
      return (
        <ThemedView style={styles.stepContainer}>
          <ThemedText>Press the button to begin registration.</ThemedText>
          <Button
            title="Begin Device Registration"
            onPress={requestAllPermissions}
          />
        </ThemedView>
      );
    }
    
    // ---- State 3: Permissions granted, scanning/connecting ----
    return (
      <ThemedView style={styles.stepContainer}>
        <Button 
          title={isScanning ? "Scanning..." : "Scan for Greenhouses"} 
          onPress={scanForDevices} 
          disabled={isScanning || isConnecting}
        />
        
        {isScanning && <ActivityIndicator style={{ marginVertical: 10 }} size="large" color="#0000ff" />}
        
        {discoveredDevices.map(device => (
          <TouchableOpacity 
            key={device.id}
            style={styles.deviceItem} 
            onPress={() => connectToDevice(device)}
            disabled={isConnecting}
          >
            <Text style={styles.deviceText}>
              {isConnecting ? "Connecting..." : (device.name || 'Unnamed Device')}
            </Text>
          </TouchableOpacity>
        ))}
      </ThemedView>
    );
  };

  // --- 4. The main render ---
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
        <ThemedText type="title">Greenhouse Setup</ThemedText>
        <HelloWave />
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="title">Device Registration</ThemedText>
      </ThemedView>

      {/* This function renders our different UI states */}
      {renderContent()}

      {/* Original placeholder content */}
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
            <Link.MenuAction title="Action" icon="cube" onPress={() => Alert.alert('Action pressed')} />
            <Link.MenuAction
              title="Share"
              icon="square.and.arrow.up"
              onPress={() => Alert.alert('Share pressed')}
            />
            <Link.Menu title="More" icon="ellipsis">
              <Link.MenuAction
                title="Delete"
                icon="trash"
                destructive
                onPress={() => Alert.alert('Delete pressed')}
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

// --- 5. Styles (unchanged) ---
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