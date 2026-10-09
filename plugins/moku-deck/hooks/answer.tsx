import type { ClientModule } from 'claude-code'

type Kind = 'next' | 'primary' | 'optional' | 'deletes' | 'plain'

type Props = { label: string; kind: Kind }

/** The body, the body under the pointer or a press, and the label, for each kind of control. */
const LOOKS: Record<Kind, { rest: string; lit: string; text: string }> = {
  // The next step is the one loud thing in the bar: solid mint
  next: { rest: '#7be0c3', lit: '#a8f0dc', text: '#0a0b12' },
  // The main action of a pane, and the open tab: light, as the app's own primary button
  primary: { rest: '#f2eff9', lit: '#cfc9ec', text: '#0a0b12' },
  optional: { rest: '#2b2c3f', lit: '#3d3e5a', text: '#f2eff9' },
  // An answer that deletes is dark with a pink label: it is seen, and it does not invite a press
  deletes: { rest: '#3d1423', lit: '#5a1c33', text: '#ff7a9c' },
  // A quiet control has no body until the pointer is on it
  plain: { rest: '', lit: '#2b2c3f', text: '#cfc9ec' },
}

/**
 * How tall the body is, in lines of text. Only a frame has round corners, and a frame alone makes the body two lines
 * tall, so the height is set outright: the one number that makes the body thicker or thinner.
 */
const HEIGHT = 1.5

/**
 * One control of the deck, drawn by the mod itself. The app's own button has one height, and on a desktop its
 * first click only gives the pane the focus: a press is taken here on the way down. This body is a
 * little taller, so it is easier to hit. A press on it is posted to the hooks module.
 *
 * @example
 * <Client key="quick-0" module="./answer.tsx" props={{ label: 'pr S6', kind: 'next' }} />
 */
const Answer: ClientModule<Props, { isDown: boolean }> = (props, surface) => {
  const { Box, Text } = surface.elements
  const isDown = surface.state?.isDown === true
  const look = LOOKS[props.kind] ?? LOOKS.optional
  const body = isDown ? look.lit : look.rest

  // The press is taken on the way down. The first click on the bar also gives it the focus, and the release
  // of that click does not always arrive: an answer that waited for it needed a second click.
  surface.onPointer(event => {
    if (event.type === 'down') {
      surface.setState({ isDown: true })
      surface.post({ press: true })
    }

    if (event.type === 'up' || event.type === 'leave') surface.setState({ isDown: false })
  })

  // A quiet control at rest is its label alone, with the same room around it so nothing moves under the pointer
  if (body === '') {
    return (
      <Box key="body" hover={{ backgroundColor: look.lit }} paddingX={1} height={HEIGHT} alignItems="center">
        <Text color={look.text}>{props.label}</Text>
      </Box>
    )
  }

  return (
    <Box
      key="body"
      borderStyle="round"
      borderColor={body}
      backgroundColor={body}
      hover={{ backgroundColor: look.lit, borderColor: look.lit }}
      paddingX={2}
      height={HEIGHT}
      alignItems="center"
    >
      <Text color={look.text} bold={props.kind === 'next' || props.kind === 'primary'}>
        {props.label}
      </Text>
    </Box>
  )
}

export default Answer
