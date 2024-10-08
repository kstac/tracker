import {Button, Modal, TextInput} from "react-native-paper";
import {ScrollView, View} from "react-native";
import {Tracker} from "@/constants/Tracker";
import {useEffect, useState} from "react";

export interface DebugModalProps {
  visible: boolean;
  onClose: () => void;
  trackerData: Tracker[];
  updateTrackerData: (trackerData: Tracker[]) => void;
}

export default function DebugModal(props: DebugModalProps) {
  const [debugTrackerText, setDebugTrackerText] = useState('');
  useEffect(() => {
    setDebugTrackerText(JSON.stringify(props.trackerData, null, 4))
  }, [props.trackerData]);

  return (
    <Modal
      visible={props.visible}
      onDismiss={props.onClose}
      style={{padding: 0}}
    >
      <View style={{backgroundColor: "white", padding: 20, borderRadius: 10}}>
        <ScrollView style={{paddingBottom: 20}}>
          <TextInput value={debugTrackerText} multiline={true} onChangeText={(text) => setDebugTrackerText(text)}/>
        </ScrollView>
        <Button mode='contained' style={{marginTop: "auto"}} onPress={() => props.updateTrackerData(JSON.parse(debugTrackerText))}>Update Data</Button>
      </View>
    </Modal>
  );
}