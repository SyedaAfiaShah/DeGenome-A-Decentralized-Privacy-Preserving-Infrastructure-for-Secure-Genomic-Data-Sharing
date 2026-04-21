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
export const register   = d    => api.post('/auth/register', d)
export const login      = d    => api.post('/auth/login', d)
export const switchRole = role => api.patch('/auth/role', { role })

// API Keys — auto-issued on approval, not manually created
export const getMyKeys  = ()       => api.get('/auth/my-keys')
export const revokeKey  = (keyId)  => api.delete(`/auth/api-keys/${keyId}`)

// Datasets
export const listDatasets          = (fmt) => api.get('/datasets/', { params: fmt ? { format_type: fmt } : {} })
export const myDatasets            = ()    => api.get('/datasets/my')
export const getPresignedUploadUrl = (filename, format_type) => api.get('/datasets/presign', { params: { filename, format_type } })
export const registerDataset       = (body) => api.post('/datasets/register', body)

// Data API
export const getDatasetInfo  = (id)              => api.get('/data/info',    { params: { dataset_id: id } })
export const getFeatureSchema= (id)              => api.get('/data/schema',  { params: { dataset_id: id } })
export const getFeatures     = (id, sparse=true) => api.get('/data/features',{ params: { dataset_id: id, sparse } })
export const getBatchData    = (id, size=10, offset=0, sparse=true) =>
  api.get('/data/batch', { params: { dataset_id: id, batch_size: size, offset, sparse } })
export const queryFeatures   = (body) => api.post('/data/query', body)
export const getRawFileUrl   = (datasetId, apiKey = null) => {
  // If an API key string is provided, use it as the bearer token instead of the stored JWT
  const config = apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {}
  return api.get(`/data/raw-file/${datasetId}`, config)
}

// Access
export const requestAccess   = (datasetId, purpose, accessType = 'feature_access') =>
  api.post('/access/request', { dataset_id: datasetId, purpose, access_type: accessType })
export const decideAccess    = (d)  => api.post('/access/decide', d)
export const incomingRequests= ()   => api.get('/access/incoming')
export const outgoingRequests= ()   => api.get('/access/outgoing')

// Credits
export const getBalance      = ()   => api.get('/credits/balance')
export const getCreditHistory= ()   => api.get('/credits/history')
export const getQueryLogs    = ()   => api.get('/credits/query_logs')

export default api
