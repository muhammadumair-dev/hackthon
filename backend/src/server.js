require('dotenv').config()

const app = require('./app')
const { connectMongo } = require('./utils/mongo-connection')
const { validateRuntimeConfig } = require('./utils/runtime-config')

const startServer = async () => {
  try {
    validateRuntimeConfig()
    await connectMongo()
  } catch (error) {
    console.error(error.message)
    process.exit(1)
    return
  }

  const port = process.env.PORT || 5000
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`)
  })
}

startServer()
