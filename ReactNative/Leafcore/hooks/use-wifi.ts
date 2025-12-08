import { useState } from 'react';
import { Alert } from 'react-native';
import WifiManager from 'react-native-wifi-reborn';

/**
 * A custom hook to manage Wi-Fi state.
 */
export function useWifi() {
  const [ssid, setSsid] = useState('');

  const getCurrentWifiSsid = async () => {
    try {
      const currentSsid = await WifiManager.getCurrentWifiSSID();
      setSsid(currentSsid);
    } catch (error) {
      Alert.alert("Wi-Fi Error", "Could not get current Wi-Fi network name.");
    }
  };

  return {
    ssid,
    setSsid,
    getCurrentWifiSsid,
  };
}