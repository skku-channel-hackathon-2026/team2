import type { ReactNode } from 'react'
import { AppProvider } from '@channel.io/bezier-react'

/** Bezier treats light and dark as equals, but the demo pins light so the
 *  page and the embedded Channel messenger — whose interior this app cannot
 *  restyle — read as one surface. */
function Themed({ children }: { children: ReactNode }) {
  return <AppProvider themeName="light">{children}</AppProvider>
}

export default Themed
