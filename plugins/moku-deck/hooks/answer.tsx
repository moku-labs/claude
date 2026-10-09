import type { ClientModule } from 'claude-code'

type Kind = 'next' | 'optional' | 'deletes'

type Props = { label: string; kind: Kind }

/** The body, the body under the pointer or a press, and the label, for each kind of answer. */
const LOOKS: Record<Kind, { rest: string; lit: string; text: string }> = {
  // The next step is the one loud thing in the bar: solid mint
  next: { rest: '#7be0c3', lit: '#a8f0dc', text: '#0a0b12' },
  optional: { rest: '#2b2c3f', lit: '#3d3e5a', text: '#f2eff9' },
  // An answer that deletes is dark with a pink label: it is seen, and it does not invite a press
  deletes: { rest: '#3d1423', lit: '#5a1c33', text: '#ff7a9c' },
}

/**
 * How tall the body is, in lines of text. Only a frame has round corners, and a frame alone makes the body two lines
 * tall, so the height is set outright: the one number that makes the body thicker or thinner.
 */
const HEIGHT = 1.5

/**
 * One answer of the reply bar, drawn by the mod itself: the app's own button has one height, and this body is a
 * little taller, so it is easier to hit. A press inside it is posted to the hooks module.
 *
 * @example
 * <Client key="quick-0" module="./answer.tsx" props={{ label: 'pr S6', kind: 'next' }} />
 */
const Answer: ClientModule<Props, { isDown: boolean }> = (props, surface) => {
  const { Box, Text } = surface.elements
  const isDown = surface.state?.isDown === true
  const look = LOOKS[props.kind] ?? LOOKS.optional
  const body = isDown ? look.lit : look.rest

  surface.onPointer(event => {
    const isInside = event.x >= 0 && event.y >= 0 && event.x < surface.columns && event.y < surface.rows

    if (event.type === 'down') surface.setState({ isDown: true })
    if (event.type !== 'up') return

    surface.setState({ isDown: false })
    if (isInside) surface.post({ press: true })
  })

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
      <Text color={look.text} bold={props.kind === 'next'}>
        {props.label}
      </Text>
    </Box>
  )
}

export default Answer
