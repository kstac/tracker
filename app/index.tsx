import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useEffect, useState} from "react";
import {Button, IconButton, List, Modal, Text, TextInput} from "react-native-paper";
import {Tracker, TrackerType} from "@/constants/Tracker";
import {getTrackerData, storeTrackerData} from "@/util/Storage";
import TrackerItemModal from "@/components/tracker-item-modal";
import DebugModal from "@/components/debug-modal";

export default function HomeScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [debugModalVisible, setDebugModalVisible] = useState(false);
  const [storedTrackers, setStoredTrackers] = useState<Tracker[]>([]);

  useEffect(() => {
    getTrackerData().then((tracker) => setStoredTrackers([...tracker]));
  }, []);

  const handleModalSubmit = (trackerText: string, trackerType: TrackerType) => {
    const currentTrackers = [...storedTrackers];
    currentTrackers.push({label: trackerText, type: trackerType, dateAwareValues: {}})
    setStoredTrackers(currentTrackers);
    setModalVisible(false);
    storeTrackerData(currentTrackers);
  }

  const handleDebugModalSubmit = (trackerData: Tracker[]) => {
    setStoredTrackers(trackerData);
    setDebugModalVisible(false);
    storeTrackerData(trackerData);
  }

  const changeCount = (label: string, value: number) => {
    const newTrackers: Tracker[] = [];
    for (let tracker of storedTrackers) {
      if (tracker.label === label) {
        const currentDate = new Date().toLocaleDateString();
        tracker.dateAwareValues[currentDate] = (tracker.dateAwareValues[currentDate] || 0) + value
      }
      newTrackers.push(tracker);
    }
    setStoredTrackers(newTrackers);
    storeTrackerData(newTrackers);
  }

  // TODO - Move items into their own component
  const trackerItems = storedTrackers.map((storedTracker) => {
    return (
      <List.Item title={storedTracker.label} titleStyle={{fontWeight: 'bold'}}
                 right={() => {
                   return (
                     <View style={{flexDirection: 'row', alignItems:'center'}}>
                       <IconButton icon='minus' mode='contained' onPress={() => changeCount(storedTracker.label, -1)}/>
                       <Text>{storedTracker.dateAwareValues[new Date().toLocaleDateString()] || 0}</Text>
                       <IconButton icon='plus' mode='contained' onPress={() => changeCount(storedTracker.label, 1)}/>
                     </View>
                   );
                 }}
      />
    );
  });

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setModalVisible(!modalVisible)}>
        <Text style={styles.buttonText}>Add new item to track</Text>
      </Pressable>

      {/*TODO - Move section into it's own component*/}
      <List.Section>
        {trackerItems}
      </List.Section>
      <Button mode='contained' onPress={() => setDebugModalVisible(true)}>Raw Data</Button>

      <TrackerItemModal
        visible={modalVisible}
        onSubmit={handleModalSubmit}
        onClose={() => setModalVisible(false)}
      />
      <DebugModal
        visible={debugModalVisible}
        onClose={() => setDebugModalVisible(false)}
        trackerData={storedTrackers}
        updateTrackerData={handleDebugModalSubmit}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
