const queries = require('../../database/queries')

module.exports = app => {

  app.get('/phases', app.ensureTrailingSlash, (request, response, next) => {
    response.renderMarkdownFile(`/phases/README.md`)
  })


  app.get('/phases/:phaseNumber', app.ensureTrailingSlash)

  app.use('/phases/:phaseNumber', (request, response, next) => {
    const { phaseNumber } = request.params
    response.locals.phase = request.phase = response.digest.phases[phaseNumber]
    next()
  })

  app.get('/phases/:phaseNumber', (request, response, next) => {
    const { phaseNumber } = request.params
    response.renderMarkdownFile(`/phases/${phaseNumber}/README.md`)
  })

  app.get('/phases/:phaseNumber/schedule.md', (request, response, next) => {
    const { phaseNumber } = request.params
    response.redirect(`/phases/${phaseNumber}/schedule`)
  })

  app.get('/phases/:phaseNumber/schedule', (request, response, next) => {
    response.render("phases/schedule")
  })

  app.get('/phases/:phaseNumber/skills', (request, response, next) => {
    const userId = request.user.id
    const labels = request.phase.skills
    queries.getChecksForUserAndLabels({userId, labels})
      .then(checks => {
        const skills = request.phase.skills.map(skillId =>
          Object.assign({}, response.digest.skills[skillId], {checked: !!checks[skillId]})
        )
        response.render('phases/skills', {skills})
      })
      .catch(next)
  })

  app.get('/phases/3/goals', (request, response, next) => {
    response.render('phases/goals')
  })

  app.use('/phases/:phaseNumber/dashboard', app.ensureAdmin)

  app.get('/phases/:phaseNumber/dashboard', (request, response, next) => {
    response.render('phases/dashboard/index')
  })

  app.get('/phases/:phaseNumber/dashboard/progress', (request, response, next) => {
    const { phase } = request
    request.getUsersForPhaseWithCheckLog(phase.number)
      .then(learners => {
        learners.forEach(learner => {
          calculatePhaseProgressForLearner(phase, learner)
        })
        learners.sort((a,b)=>
          b.skillsNumerator - a.skillsNumerator
        )
        response.render('phases/dashboard/progress', {learners})
      })
      .catch(next)
  })

  app.get('/phases/:phaseNumber/dashboard/learners', (request, response, next) => {
    request.backOffice.getAllLearners({
      phase: request.phase.number
    })
      .then(learners => {
        response.render('phases/dashboard/learners/index', {learners})
      })
      .catch(next)
  })

  app.get('/phases/:phaseNumber/dashboard/learners/:learnerHandle', (request, response, next) => {
    const { learnerHandle } = request.params

    request.getUserWithCheckLog(learnerHandle)
      .then(learner => {
        response.render('phases/dashboard/learners/show', {learner})
      })
      .catch(next)
  })

  app.get('/phases/:phaseNumber/dashboard/learners/:learnerHandle/skills', (request, response, next) => {
    const { learnerHandle } = request.params

    request.getUserWithCheckLog(learnerHandle)
      .then(learner => {
        response.render('phases/dashboard/learners/skills', {learner})
      })
      .catch(next)
  })

  app.get('/phases/:phaseNumber/dashboard/learners/:learnerHandle/check-log', (request, response, next) => {
    const { learnerHandle } = request.params

    request.getUserWithCheckLog(learnerHandle)
      .then(learner => {
        response.render('phases/dashboard/learners/check-log', {learner})
      })
      .catch(next)
  })

  app.get('/phases/:phaseNumber/*', (request, response, next) => {
    response.renderFile(request.path)
  })
}

const calculatePhaseProgressForLearner = (phase, learner) => {
  const p = learner.phaseProgress = {}
  p.progressNumerator = learner.checkedSkills.filter(skill => phase.skills.includes(skill)).length
  p.progressDenominator = phase.skills.length
  p.phaseNumerator = learner.currentPhaseWeekNumber
  p.phaseDenominator = 8
  p.expectedProgressNumerator = (
    Math.round(p.progressDenominator / p.phaseDenominator) * p.phaseNumerator
  )
  p.expectedProgressDenominator = p.progressDenominator
  p.onTrack = p.progressNumerator >= p.expectedProgressNumerator
}
