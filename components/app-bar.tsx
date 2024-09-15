import {Appbar} from "react-native-paper";

export interface AppBarProps {
  title: string;
  onLeftAction: () => void;
  onRightAction: () => void;
}

export default function AppBar(props: AppBarProps) {
  return (
    <Appbar.Header style={{backgroundColor: "white"}}>
      <Appbar.Action icon={"magnify"} onPress={props.onLeftAction}/>
      <Appbar.Content
        title={props.title}
        titleStyle={{alignSelf: "center"}}
        onPress={() => {}}
      />
      <Appbar.Action icon={"plus"} onPress={props.onRightAction}/>
    </Appbar.Header>

  );
}