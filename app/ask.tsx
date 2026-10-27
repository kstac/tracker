import {useEffect, useRef, useState} from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, View} from 'react-native';
import {router} from 'expo-router';
import {ActivityIndicator, Button, Chip, IconButton, Text, TextInput} from 'react-native-paper';
import {Panel, PanelHeader} from '@/components/ui/Panel';
import {askClaude, buildContext, ChatMessage, getApiKey} from '@/lib/ai';
import {today} from '@/lib/dates';
import {useAppData} from '@/providers/AppData';
import {useAppTheme} from '@/theme';

const STARTERS = [
  'Why is my readiness what it is today?',
  'What affects my sleep the most?',
  'How has this month compared with last month?',
  'Am I training too much or too little?',
  'What one change would help my recovery most?',
];

export default function AskScreen() {
  const {chart, colors} = useAppTheme();
  const {report, daily, tags, tagEntries} = useAppData();
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    getApiKey().then((k) => setHasKey(!!k));
  }, []);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || !report || busy) return;
    const next: ChatMessage[] = [...messages, {role: 'user', content: q}];
    setMessages(next);
    setText('');
    setBusy(true);
    setError(null);
    try {
      const answer = await askClaude(next, buildContext({report, daily, tags, tagEntries, today: today()}));
      setMessages([...next, {role: 'assistant', content: answer}]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMessages(messages);
      setText(q);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({animated: true}), 50);
    }
  };

  if (hasKey === false) {
    return (
      <ScrollView style={{backgroundColor: chart.page}} contentContainerStyle={{paddingTop: 12}}>
        <Panel>
          <PanelHeader title="Ask about your data" subtitle="Uses Claude with your own Anthropic API key" icon="chat-question-outline" color={colors.primary} />
          <Text variant="bodyMedium" style={{color: chart.inkSecondary, marginBottom: 12}}>
            Add an API key in Settings to ask questions in plain language. Each question sends a summary of your recent data (scores, sleep, training, tags and patterns) to Anthropic to answer it.
          </Text>
          <Button mode="contained" style={{alignSelf: 'flex-start'}} onPress={() => router.push('/settings')}>Open settings</Button>
        </Panel>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{flex: 1, backgroundColor: chart.page}} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
      <ScrollView ref={scroll} contentContainerStyle={{paddingTop: 12, paddingBottom: 16}} keyboardShouldPersistTaps="handled">
        {messages.length === 0 && (
          <Panel>
            <PanelHeader title="Ask about your data" subtitle="Answers use only the numbers the app has computed" icon="chat-question-outline" color={colors.primary} />
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
              {STARTERS.map((s) => <Chip key={s} disabled={!report} onPress={() => send(s)}>{s}</Chip>)}
            </View>
          </Panel>
        )}
        {messages.map((m, i) => (
          <View
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'stretch',
              maxWidth: m.role === 'user' ? '85%' : undefined,
              marginHorizontal: 16,
              marginBottom: 10,
              padding: 12,
              borderRadius: 16,
              backgroundColor: m.role === 'user' ? colors.primaryContainer : chart.surface,
              borderWidth: m.role === 'user' ? 0 : 1,
              borderColor: colors.outlineVariant,
            }}
          >
            <Text selectable variant="bodyMedium" style={{color: m.role === 'user' ? colors.onPrimaryContainer : chart.inkPrimary}}>{m.content}</Text>
          </View>
        ))}
        {busy && <ActivityIndicator style={{marginVertical: 12}} />}
        {error && <Text style={{color: chart.status.critical, marginHorizontal: 16}}>{error}</Text>}
      </ScrollView>
      <View style={{flexDirection: 'row', alignItems: 'center', padding: 8, gap: 4, borderTopWidth: 1, borderTopColor: colors.outlineVariant, backgroundColor: chart.surface}}>
        <TextInput mode="outlined" dense style={{flex: 1}} value={text} onChangeText={setText} placeholder="Ask a question" onSubmitEditing={() => send(text)} returnKeyType="send" />
        <IconButton icon="send" mode="contained" disabled={busy || !text.trim()} onPress={() => send(text)} />
        {messages.length > 0 && <IconButton icon="broom" onPress={() => setMessages([])} accessibilityLabel="Start over" />}
      </View>
    </KeyboardAvoidingView>
  );
}
