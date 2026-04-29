import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import useAuthStore from './store/authStore'
import Navbar from './components/Navbar'
import ToastContainer from './components/ToastContainer'

import Landing       from './pages/Landing'
import { Login, Register } from './pages/Auth'
import Dashboard     from './pages/Dashboard'
import Upload        from './pages/Upload'
import Explorer      from './pages/Explorer'
import AccessRequests from './pages/AccessRequests'
import DataAPI       from './pages/DataAPI'
import ApiDocs       from './pages/ApiDocs'

function ProtectedRoute({ children, role }) {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (role && user?.role !== role) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function Layout({ children }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  )
}

export default function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <>
    <ToastContainer />
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={
          isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Landing />
        } />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected — any authenticated user */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Layout><Dashboard /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/explorer" element={
          <ProtectedRoute>
            <Layout><Explorer /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/access" element={
          <ProtectedRoute>
            <Layout><AccessRequests /></Layout>
          </ProtectedRoute>
        } />

        {/* Contributor only */}
        <Route path="/upload" element={
          <ProtectedRoute role="contributor">
            <Layout><Upload /></Layout>
          </ProtectedRoute>
        } />

        {/* Researcher only */}
        <Route path="/api" element={
          <ProtectedRoute role="researcher">
            <Layout><DataAPI /></Layout>
          </ProtectedRoute>
        } />
        <Route path="/api-docs" element={
          <ProtectedRoute role="researcher">
            <Layout><ApiDocs /></Layout>
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </>
  )
}
