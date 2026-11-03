// Yuklangan fayllar joylashuvi (STORAGE_DIR ichida)
import { resolve } from 'node:path'
import { config } from './config.js'

export const uploadsDir = () => resolve(config.storageDir, 'uploads')
