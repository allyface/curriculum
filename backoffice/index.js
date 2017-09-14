require('../environment')
const { idmGraphQLFetch } = require('@learnersguild/idm-jwt-auth/lib/utils')
const { IDMClient } = require('./idm')
const { EchoClient } = require('./echo')
const hubspot = require('./hubspot')
const { isValidPhase, isUserALearner, isUserActive } = require('./util')

const ROBOT_HANDLES = ['echo-bot','lg-bot']

module.exports = class BackOffice {

  constructor(lgJWT){
    this.idm = new IDMClient(lgJWT)
    this.echo = new EchoClient(lgJWT)
    this.hubspot = hubspot
  }

  getAllUsers(options={}){
    options = Object.assign(
      // default options
      {
        active: true,
        learners: false,
        phase: undefined,
        includePhases: false,
        includeHubspotData: false,
      },
      options
    )

    if (isValidPhase(options.phase)){
      options.includePhases = true
    }else{
      delete options.phase
    }

    return this.idm.getAllUsers()
      .then(users => {
        if (!Array.isArray(users)){
          throw new Error(`${typeof users} is not array`)
        }

        // filters
        if (options.learners) users = users.filter(isUserALearner)
        if (options.active) users = users.filter(isUserActive)

        // load extra data
        const promises = []
        if (options.includePhases) promises.push(this.getPhasesForUsers(users))
        if (options.includeHubspotData) promises.push(this.getHubspotDataForUsers(users))

        return Promise.all(promises).then(_ => users)
      })
      .then(users =>
        options.phase
          ? users.filter(user => user.phase === options.phase)
          : users
      )
  }

  getAllLearners(options={}){
    options.learners = true
    return this.getAllUsers(options)
  }

  getUserByHandle(handle, options={}){
    options = Object.assign(
      // default options
      {
        includeHubspotData: false,
      },
      options
    )
    return this.idm
      .getLearnerByHandle(handle)
      .then(user => {
        if (!user) return user
        if (options.includeHubspotData) return getHubspotDataForUser(user)
        return user
      })
  }


  getPhasesForUsers(users){
    return this.echo.getPhasesForUsers(users)
  }

  getHubspotDataForUsers(users){
    const emails = users.map(user => user.email)
    return this.hubspot.getContactsByEmail(emails).then(contacts => {
      users.forEach(user => {
        const contact = contacts.find(contact =>
          contact.email === user.email
        )
        if (contact) mergeHubspotContactIntoUser(user, contact)
      })
    })
  }
}

const getHubspotDataForUser = user =>
  hubspot.getContactByEmail(user.email)
    .then(hubspotContact =>
      mergeHubspotContactIntoUser(user, hubspotContact)
    )
    .catch(error => {
      if (error.message.includes('contact does not exist')) return user
      throw error
    })

const mergeHubspotContactIntoUser = (user, contact) => {
  user.errors = user.errors || []
  user.vid = contact.vid

  user.enrolleeStartDate = contact.enrollee_start_date

  user.phase1StartDate = contact.date_phase_1
  user.phase2StartDate = contact.date_phase_2
  user.phase3StartDate = contact.date_phase_3
  user.phase4StartDate = contact.date_phase_4
  user.phase5StartDate = contact.date_phase_5
  user.currentPhaseWeekNumber = contact.phase_week

  user.phase = (
    isValidPhase(user.phase) ? user.phase :
    isValidPhase(contact.phase) ? contact.phase :
    user.phase5StartDate ? 5 :
    user.phase4StartDate ? 4 :
    user.phase3StartDate ? 3 :
    user.phase2StartDate ? 2 :
    user.phase1StartDate ? 1 :
    null
  )

  return user
}
