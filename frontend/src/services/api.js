import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('dg_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('dg_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const register    = d  => api.post('/auth/register', d)
export const login       = d  => api.post('/auth/login', d)

// Datasets
export const listDatasets    = (fmt) => api.get('/datasets/', { params: fmt ? { format_type: fmt } : {} })
export const myDatasets      = ()    => api.get('/datasets/my')
export const uploadDataset   = (fd)  => api.post('/datasets/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
export const getPublicKey    = ()    => api.get('/datasets/public_key')

// Data API
export const getDatasetInfo  = (id)             => api.get('/data/info',    { params: { dataset_id: id } })
export const getFeatureSchema= (id)             => api.get('/data/schema',  { params: { dataset_id: id } })
export const getFeatures     = (id, sparse=true)=> api.get('/data/features',{ params: { dataset_id: id, sparse } })
export const getBatchData    = (id, size=10, offset=0, sparse=true) =>
  api.get('/data/batch', { params: { dataset_id: id, batch_size: size, offset, sparse } })

// Access
export const requestAccess   = (d)  => api.post('/access/request', d)
export const decideAccess    = (d)  => api.post('/access/decide', d)
export const incomingRequests= ()   => api.get('/access/incoming')
export const outgoingRequests= ()   => api.get('/access/outgoing')

// Credits
export const getBalance      = ()   => api.get('/credits/balance')
export const getCreditHistory= ()   => api.get('/credits/history')
export const getQueryLogs    = ()   => api.get('/credits/query_logs')

export default api
