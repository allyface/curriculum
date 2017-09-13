require('../environment')
const { idmGraphQLFetch } = require('@learnersguild/idm-jwt-auth/lib/utils')
const { IDMClient } = require('./idm')
const { EchoClient } = require('./echo')
const hubspot = require('./hubspot')

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
        active: false,
        learners: false,
        includePhases: false,
        includeHubspotData: false,
      },
      options
    )

    return this.idm.getAllUsers()
      .then(users => {
        if (options.learners) users = users.filter(filterForLearners)
        if (options.active) users = users.filter(filterForActiveUsers)
        const promises = []
        if (options.includePhases) promises.push(this.getPhasesForUsers(users))
        if (options.includeHubspotData) promises.push(this.getHubspotDataForUsers(users))
        return Promise.all(promises).then(_ => users)
      })
  }

  getActiveUsers(options={}){
    options.active = true
    return this.getAllUsers(options)
  }

  getAllLearners(options={}){
    options.learners = true
    return this.getAllUsers(options)
  }

  getActiveLearners(){
    return this.getAllLearners().then(filterForActiveUsers)
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

const filterForLearners = users =>
  users.filter(user =>
    user.roles.includes('learner') && !user.roles.includes('staff')
  )

const filterForActiveUsers = users =>
  users.filter(user => user.active)


const getHubspotDataForUser = user =>
  hubspot.getContactByEmail(user.email).then(hubspotContact =>
    mergeHubspotContactIntoUser(user, hubspotContact)
  )

const mergeHubspotContactIntoUser = (user, contact) => {
  user.errors = []
  user.vid = contact.vid

  if (
    typeof user.phase === 'number' &&
    user.phase !== contact.phase
  ){
    user.errors.push('phases in IDM and hubspot do not mach')
  }

  user.enrolleeStartDate = contact.enrollee_start_date

  user.phase1StartDate = contact.date_phase_1
  user.phase2StartDate = contact.date_phase_2
  user.phase3StartDate = contact.date_phase_3
  user.phase4StartDate = contact.date_phase_4
  user.phase5StartDate = contact.date_phase_5
  user.currentPhaseStartDate = contact.phase_week


  user.hubspot = contact // TEMP
  return user
}
