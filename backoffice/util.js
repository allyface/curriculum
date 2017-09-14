const PHASES = [0,1,2,3,4,5]

const isValidPhase = phase =>
  PHASES.includes(phase)

const isUserStaff = user =>
  user.roles.includes('staff')

const isUserALearner = user =>
  !isUserStaff(user) && user.roles.includes('learner')



module.exports = {
  isValidPhase,
  isUserStaff,
  isUserALearner,
}
