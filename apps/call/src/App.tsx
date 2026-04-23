import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Room from './pages/Room'
import Modal from './components/Modal'
import ToastContainer from './components/ToastContainer'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>
      <Modal />
      <ToastContainer />
    </BrowserRouter>
  )
}