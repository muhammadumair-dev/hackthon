const mongoose = require('mongoose')

const CONNECTION_PROMISE_KEY = '__hcmLiteMongoConnectionPromise'

const connectMongo = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required.')
  }
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection
  }
  if (mongoose.connection.readyState !== 2) {
    globalThis[CONNECTION_PROMISE_KEY] = null
  }
  if (globalThis[CONNECTION_PROMISE_KEY]) {
    return globalThis[CONNECTION_PROMISE_KEY]
  }

  const connectionPromise = mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  })
  globalThis[CONNECTION_PROMISE_KEY] = connectionPromise
  try {
    await connectionPromise
    return mongoose.connection
  } catch (error) {
    if (globalThis[CONNECTION_PROMISE_KEY] === connectionPromise) {
      globalThis[CONNECTION_PROMISE_KEY] = null
    }
    throw error
  }
}

const ensureMongoConnection = async (req, res, next) => {
  try {
    await connectMongo()
    next()
  } catch (error) {
    console.error('MongoDB connection is unavailable.', {
      name: error.name,
      code: error.code,
    })
    res.status(503).json({
      message: 'Database is temporarily unavailable. Please try again shortly.',
    })
  }
}

module.exports = { connectMongo, ensureMongoConnection }
