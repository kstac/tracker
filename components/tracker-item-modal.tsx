import {Button, Modal, RadioButton, Text, TextInput} from "react-native-paper";
import {View} from "react-native";
import {useState} from "react";
import {TrackerType} from "@/constants/Tracker";

export interface TrackerItemModalProps {
  visible: boolean;
  onSubmit: (trackerText: string, trackerType: TrackerType) => void;
  onClose: () => void;
}

export default function TrackerItemModal(props: TrackerItemModalProps) {
  const [trackerText, setTrackerText] = useState('');
  const [trackerType, setTrackerType] = useState(TrackerType.COUNT);

  const radioOptions = Object.keys(TrackerType)
    .filter((type: string) => isNaN(parseInt(type)))
    .map((type: string) => {
      return (
        <View style={{flexDirection: "row", alignItems: "center"}}>
          <RadioButton key={type} value={type}/>
          <Text>{type}</Text>
        </View>
      )
    });

  return (
      <Modal
        visible={props.visible}
        onDismiss={() => props.onClose()}
        style={{padding: 0}}
      >
        <View style={{backgroundColor: "white", padding: 20, borderRadius: 10}}>
          <TextInput label="Name" mode="outlined" autoFocus={true}
                     onChangeText={text => setTrackerText(text)}
                     onSubmitEditing={() => props.onSubmit(trackerText, trackerType)}/>

          <RadioButton.Group
            value={TrackerType[trackerType]}
            onValueChange={newValue => setTrackerType(TrackerType[newValue as keyof typeof TrackerType])}>
            {radioOptions}
          </RadioButton.Group>
          <View style={{flexDirection: "row", alignItems: "center", justifyContent: "flex-end"}}>
            <Button mode='outlined' style={{marginLeft: 5}} onPress={props.onClose}>Cancel</Button>
            <Button mode='contained' style={{marginLeft: 5}} onPress={() => props.onSubmit(trackerText, trackerType)}>Submit</Button>
          </View>
        </View>
      </Modal>
    );
}