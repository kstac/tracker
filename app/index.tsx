import {StyleSheet, View} from 'react-native';
import {useEffect, useState} from "react";
import {Button, Icon, List} from "react-native-paper";
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
                   style={{flexDirection: 'row', paddingLeft: '3%', paddingRight: '3%', margin: '1%', backgroundColor: "white", borderRadius: 10}}
                   left={() => {
                     return (
                       <View style={{flexDirection: 'row', alignItems:'center'}}>
                         <Icon source={'reorder-horizontal'} size={10}/>
                       </View>
                     );
                   }}
                   right={() => {
                     return (
                       <View style={{flexDirection: 'row', alignItems:'center'}}>
                         <Button mode={'outlined'}
                                 style={{margin: 10}}
                                 labelStyle={{marginHorizontal: 5, marginVertical: 3}}
                                 compact={true}
                                 onPress={() => changeCount(storedTracker.label, 1)}>
                           {storedTracker.dateAwareValues[new Date().toLocaleDateString()] || 0}
                         </Button>
                       </View>
                     );
                   }}
        />
    );
  });

  return (
    <View style={styles.container}>
      {/*TODO - Move section into it's own component*/}
      <List.Section style={{position: 'absolute'}}>
        {trackerItems}
      </List.Section>
      <View style={{flexDirection: 'row', marginTop: 'auto', marginBottom: 10}}>
        <Button mode='contained' onPress={() => setDebugModalVisible(true)}>Raw Data</Button>
        <Button mode='contained' onPress={() => setModalVisible(true)}>New item</Button>
      </View>

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
