import AsyncStorage from "@react-native-async-storage/async-storage";
import {Tracker} from "@/constants/Tracker";

export const TRACKER_STORAGE_KEY = 'tracker-items'
export const storeTrackerData = async (value: Tracker[]) => {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(TRACKER_STORAGE_KEY, jsonValue)
  } catch (e) {
    console.log(`Error when storing tracker data: ${e}`);
  }
}

export const getTrackerData = async (): Promise<Tracker[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(TRACKER_STORAGE_KEY);

    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.log(`Error when fetching tracker data: ${e}`);
    return [];
  }
}