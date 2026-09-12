import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { DotsIcon, MenuIcon, MicIcon, PlusIcon, WaveformIcon } from './icons';

const Ink = '#0D0D0D';
const Muted = '#8E8E93';
const Bubble = '#F4F4F4';
const Hairline = '#E5E5E5';

/**
 * A ChatGPT-style transcript.
 *
 * Long-form text on a near-white ground is the least forgiving thing you can
 * put under the fold — every seam in the blur ramp and every degree of
 * perspective shows up in the letterforms — which makes it a far better
 * demo surface than a deck of colourful cards.
 */
export function DemoScreen({ onSettingsPress }: { onSettingsPress: () => void }) {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton}>
          <MenuIcon />
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
        {/* The overflow menu doubles as the way into the fold's controls. */}
        <TouchableOpacity style={styles.headerButton} onPress={onSettingsPress}>
          <DotsIcon />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <UserMessage>
          How good is the iPhone Duo actually? Thinking about saving up for one.
        </UserMessage>

        <AssistantMessage>
          <Paragraph>
            It&apos;s the most interesting thing Apple has shipped in years — but &quot;worth
            it&quot; depends a lot on what you&apos;d use it for.
          </Paragraph>
          <Paragraph>
            <Bold>What reviewers like:</Bold> the outer screen is a normal phone, so you never
            feel like you&apos;re carrying a compromise. Unfolded you get a small tablet for
            reading, split-screen notes and video, and the crease is genuinely hard to see
            head-on.
          </Paragraph>
          <Paragraph>
            <Bold>The trade-offs:</Bold> it&apos;s heavier than a Pro, battery life is a little
            shorter when you live on the big screen, and the hinge is one more thing that can
            fail. A lot of apps still letterbox instead of using the extra space.
          </Paragraph>
          <Paragraph>
            At $2,000 it&apos;s a luxury, not an upgrade. If your current phone works, the honest
            answer is that waiting a generation usually gets you a thinner hinge and a lower
            price.
          </Paragraph>
        </AssistantMessage>

        <UserMessage>
          I&apos;m 16 though. How would I even find $2000 for it?
        </UserMessage>

        <AssistantMessage>
          <Paragraph>
            Totally doable in a school year if you treat it like a project rather than a wish.
            Here&apos;s the math first: <Bold>$2,000 over 9 months is about $56 a week.</Bold>
          </Paragraph>
          <ListItem index={1} title="Get one steady thing">
            A weekend shift at a café, grocery store or cinema usually lands somewhere around
            $120–200 a week after taxes. That alone finishes the job by spring.
          </ListItem>
          <ListItem index={2} title="Sell what you already know">
            If you&apos;re good at maths, guitar or a game, tutoring pays far better per hour than
            most first jobs — and neighbours and younger students are the easiest first clients.
          </ListItem>
          <ListItem index={3} title="Clear out the closet">
            Old console, bike, shoes, the phone you&apos;re replacing. Most people are sitting on
            $200–400 of things they&apos;ll never use again.
          </ListItem>
          <ListItem index={4} title="Automate the saving">
            Move the money the day it lands, into an account without a card attached. What you
            can&apos;t see, you don&apos;t spend.
          </ListItem>
          <Paragraph>
            One caution worth saying out loud: by the time you&apos;ve saved it, the next model
            will be close. Decide now whether the goal is the phone or the $2,000 — a lot of
            people get to the end and find they&apos;d rather keep it.
          </Paragraph>
          <Paragraph>Want me to build you a week-by-week savings plan?</Paragraph>
        </AssistantMessage>
      </ScrollView>

      <View style={styles.composer}>
        <View style={styles.inputPill}>
          <PlusIcon />
          <Text style={styles.placeholder}>Ask ChatGPT</Text>
          <MicIcon />
          <View style={styles.voiceButton}>
            <WaveformIcon />
          </View>
        </View>
      </View>
    </View>
  );
}

function UserMessage({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.userRow}>
      <View style={styles.userBubble}>
        <Text style={styles.userText}>{children}</Text>
      </View>
    </View>
  );
}

function AssistantMessage({ children }: { children: React.ReactNode }) {
  return <View style={styles.assistant}>{children}</View>;
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

function Bold({ children }: { children: React.ReactNode }) {
  return <Text style={styles.bold}>{children}</Text>;
}

function ListItem({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.listItem}>
      <Text style={styles.listIndex}>{index}.</Text>
      <Text style={styles.body}>
        <Text style={styles.bold}>{title}:</Text> {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 60,
    paddingBottom: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F4F4F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { flex: 1 },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 24 },

  userRow: { alignItems: 'flex-end', marginTop: 18 },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: Bubble,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  userText: { fontSize: 16, lineHeight: 22, color: Ink },

  assistant: { marginTop: 20 },
  body: { fontSize: 16, lineHeight: 24, color: Ink, marginBottom: 14 },
  bold: { fontWeight: '600' },

  listItem: { flexDirection: 'row', paddingLeft: 4 },
  listIndex: { fontSize: 16, lineHeight: 24, color: Ink, width: 22 },

  composer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Hairline,
    backgroundColor: '#FFFFFF',
  },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 25,
    paddingLeft: 16,
    paddingRight: 6,
    borderWidth: 1,
    borderColor: Hairline,
  },
  placeholder: { flex: 1, marginLeft: 12, fontSize: 16, color: Muted },
  voiceButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginLeft: 12,
    backgroundColor: Ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
