const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const Company = require('../models/company.model')
const User = require('../models/user.model')
const AppError = require('../utils/app-error')
const serializeUser = require('../utils/serialize-user')

const getSetupStatus = async () => ({
  setupComplete: Boolean(await User.exists({})),
})

const createInitialCompanyAndAdmin = async ({ companyName, adminName, email, password }) => {
  await Promise.all([Company.init(), User.init()])

  if (await User.exists({})) {
    throw new AppError(403, 'Initial setup has already been completed.')
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const session = await mongoose.startSession()

  try {
    let createdCompany
    let createdAdmin

    await session.withTransaction(async () => {
      if (await User.exists({}).session(session)) {
        throw new AppError(403, 'Initial setup has already been completed.')
      }

      const [company] = await Company.create(
        [{ _id: 'primary', name: companyName }],
        { session },
      )
      const [admin] = await User.create(
        [{
          name: adminName,
          email,
          passwordHash,
          role: 'admin',
          employeeId: null,
          isActive: true,
          mustChangePassword: false,
        }],
        { session },
      )

      createdCompany = company
      createdAdmin = admin
    })

    return {
      company: {
        id: createdCompany._id,
        name: createdCompany.name,
      },
      user: serializeUser(createdAdmin),
    }
  } catch (error) {
    if (error.code === 11000) {
      if (await User.exists({})) {
        throw new AppError(403, 'Initial setup has already been completed.')
      }

      if (error.keyPattern?.email) {
        throw new AppError(409, 'An account with this email already exists.')
      }
    }

    throw error
  } finally {
    await session.endSession()
  }
}

module.exports = { getSetupStatus, createInitialCompanyAndAdmin }
