import { Avatar } from '@channel.io/bezier-react/beta'

import { characterUrl } from '../characters'

/**
 * A person's portrait. `seed` is a stable identity (a nickname), so the same
 * person keeps the same face here and on the demo page.
 */
function Portrait({
  seed,
  size = '36',
}: {
  seed: string
  size?: '24' | '30' | '36' | '42' | '48'
}) {
  return (
    <Avatar
      name={seed}
      avatarUrl={characterUrl(seed)}
      size={size}
    />
  )
}

export default Portrait
