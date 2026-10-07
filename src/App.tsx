import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import RegisterPatient from './pages/RegisterPatient'
import PatientProfile from './pages/PatientProfile'
import Consultation from './pages/Consultation'
import Nursing from './pages/Nursing'
import Laboratory from './pages/Laboratory'
import Pharmacy from './pages/Pharmacy'
import Inventory from './pages/Inventory'
import Accounting from './pages/Accounting'
import Radiology from './pages/Radiology'
import Admissions from './pages/Admissions'
import Services from './pages/Services'
import ProcedureInventory from './pages/ProcedureInventory'

function Guard({ children }: { children: React.ReactElement }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
          <Route path="/patients" element={<Guard><Patients /></Guard>} />
          <Route path="/register" element={<Guard><RegisterPatient /></Guard>} />
          <Route path="/patients/:id" element={<Guard><PatientProfile /></Guard>} />
          <Route path="/consultation" element={<Guard><Consultation /></Guard>} />
          <Route path="/nursing" element={<Guard><Nursing /></Guard>} />
          <Route path="/lab" element={<Guard><Laboratory /></Guard>} />
          <Route path="/pharmacy" element={<Guard><Pharmacy /></Guard>} />
          <Route path="/inventory" element={<Guard><Inventory /></Guard>} />
          <Route path="/accounting" element={<Guard><Accounting /></Guard>} />
          <Route path="/radiology" element={<Guard><Radiology /></Guard>} />
          <Route path="/admissions" element={<Guard><Admissions /></Guard>} />
          <Route path="/services" element={<Guard><Services /></Guard>} />
          {/* Procedure / amount / quantity inventory — Accountant, Doctors & Nurses. */}
          <Route path="/inventory/procedures" element={<Guard><ProcedureInventory /></Guard>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}