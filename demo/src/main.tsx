import ReactDOM from 'react-dom/client'

import App from './App'
import Themed from './Themed'
import '@channel.io/bezier-react/styles.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Themed>
    <App />
  </Themed>
)
