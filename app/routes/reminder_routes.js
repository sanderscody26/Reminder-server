// Express docs: http://expressjs.com/en/api.html
const express = require('express')
// Passport docs: http://www.passportjs.org/docs/
const passport = require('passport')

// pull in Mongoose model for examples
const Reminder = require('../models/reminders')

// this is a collection of methods that help us detect situations when we need
// to throw a custom error
const customErrors = require('../../lib/custom_errors')

// we'll use this function to send 404 when non-existent document is requested
const handle404 = customErrors.handle404
// we'll use this function to send 401 when a user tries to modify a resource
// that's owned by someone else
const requireOwnership = customErrors.requireOwnership

// this is middleware that will remove blank fields from `req.body`, e.g.
// { example: { title: '', text: 'foo' } } -> { example: { text: 'foo' } }
const removeBlanks = require('../../lib/remove_blank_fields')
// passing this as a second argument to `router.<verb>` will make it
// so that a token MUST be passed for that route to be available
// it will also set `req.user`
const requireToken = passport.authenticate('bearer', { session: false })

// instantiate a router (mini app that only handles routes)
const router = express.Router()

// INDEX
// GET /examples
router.get('/reminder', requireToken, (req, res, next) => {
  Reminder.find()
    .then((reminder) => {
      return reminder.filter((reminder) => {
        return reminder.owner == req.user.id
      })
      // `examples` will be an array of Mongoose documents
      // we want to convert each one to a POJO, so we use `.map` to
      // apply `.toObject` to each one
    })
    .then((reminder) => {
      return reminder.map((reminder) => reminder.toObject())
    })
    // respond with status 200 and JSON of the examples
    .then((reminder) => res.status(200).json({ reminder: reminder }))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// SHOW
// GET /examples/5a7db6c74d55bc51bdf39793
router.get('/reminder/:id', requireToken, (req, res, next) => {
  // req.params.id will be set based on the `:id` in the route
  Reminder.findById(req.params.id)
    .then(handle404)
    // if `findById` is succesful, respond with 200 and "example" JSON
    .then((reminder) => res.status(200).json({ reminder: reminder.toObject() }))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// CREATE
// POST /examples
router.post('/reminder', requireToken, (req, res, next) => {
  // set owner of new example to be current user
  req.body.reminder.owner = req.user.id

  Reminder.create(req.body.game)
    // respond to successful `create` with status 201 and JSON of new "example"
    .then((reminder) => {
      res.status(201).json({ reminder: reminder.toObject() })
    })
    // if an error occurs, pass it off to our error handler
    // the error handler needs the error message and the `res` object so that it
    // can send an error message back to the client
    .catch(next)
})

// UPDATE
// PATCH /examples/5a7db6c74d55bc51bdf39793
router.patch('/reminder/:id', requireToken, removeBlanks, (req, res, next) => {
  // if the client attempts to change the `owner` property by including a new
  // owner, prevent that by deleting that key/value pair
  delete req.body.reminder.owner

  Reminder.findById(req.params.id)
    .then(handle404)
    .then((reminder) => {
      // pass the `req` object and the Mongoose record to `requireOwnership`
      // it will throw an error if the current user isn't the owner
      requireOwnership(req, reminder)

      // pass the result of Mongoose's `.update` to the next `.then`
      return reminder.updateOne(req.body.reminder)
    })
    // if that succeeded, return 204 and no JSON
    .then(() => res.sendStatus(204))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// DESTROY
// DELETE /examples/5a7db6c74d55bc51bdf39793
router.delete('/reminder/:id', requireToken, (req, res, next) => {
  Reminder.findById(req.params.id)
    .then(handle404)
    .then((reminder) => {
      // throw an error if current user doesn't own `example`
      requireOwnership(req, reminder)
      // delete the example ONLY IF the above didn't throw
      reminder.deleteOne()
    })
    // send back 204 and no content if the deletion succeeded
    .then(() => res.sendStatus(204))
    // if an error occurs, pass it to the handler
    .catch(next)
})

module.exports = router
