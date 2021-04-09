const router = require('express').Router()
const bcrypt = require('bcryptjs')
const passport = require('passport')
const { ensureAuthenthicated } = require('../config/auth')
const recaptcha = require('../config/recaptchaVerification')

const User = require('../models/User')
const Company = require('../models/Company')

//@TODO Add recaptcha middleware
router.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/users/success',
    failureRedirect: '/users/failure'
  })(req, res, next)
})

router.get('/success', (req, res) => {
  return res.status(200).json({
    message: 'logged In'
  })
})

router.get('/failure', (req, res) => {
  return res.status(400).json({
    message: 'log in denied'
  })
})

router.get('/dashboard', ensureAuthenthicated, (req, res) => {
  return res.status(400).json({
    message: req.user.name + ' Logged In'
  })
})

router.get('/getAppliedCompanies',ensureAuthenthicated,(req,res)=>{
    return res.status(200).json({
      appliedCompanies: req.user.booked
    })
})

router.post('/apply', ensureAuthenthicated, (req,res)=>{
  if (!req.body.companyName || !req.body.companyId || !req.body.slotId) {
      return res.status(400).json({
        erroMessage: 'missing required parameters. refer documentation'
      })
  }

  if(req.user.booked.length == 2)
  {
      return res.status(400).json({
        erroMessage: 'cannot apply to more than two'
      })
  }

  for(let i=0;i<req.user.booked.length;i++)
  {
      if(req.user.booked[i].companyId === req.body.companyId)
      {
        return res.status(400).json({
          erroMessage: 'cannot apply to same company twice'
        })
      }
  }
  
  if(req.user.approvalStatus)
  {
    Company.findOne({ _id: req.body.companyId })
      .then((company)=>{
        if (!company) {
            return res.status(400).json({
              erroMessage: 'company does not exist'
            })
        }
        else{
          
            const slots = company.slots
            var startTime;
            for (let i = 0; i < slots.length; i++) 
            {
                if (slots[i]._id.equals(req.body.slotId)) 
                {
                    
                    for(let j=0;j<req.user.booked.length;j++)
                    { 
                        if(req.user.booked[j].startTime === slots[i].startTime)
                        {
                          return res.status(400).json({
                            erroMessage: 'cannot apply to two compaies as same time'
                          })
                        }
                    }                         

                    if(slots[i].available > 0)
                    {
                        for(let j = 0; j<slots[i].bookedBy.length; j++)
                        {
                            if(slots[i].bookedBy[j]._id.equals(req.user._id))
                            {
                              return res.status(400).json({
                                erroMessage: 'cannot book twice in same slot'
                              })
                            }
                        }
                        slots[i].bookedBy.push(req.user)
                        startTime = slots[i].startTime
                        slots[i].available = slots[i].available - 1;
                        break;
                    }
                    else
                    {
                      return res.status(400).json({
                        erroMessage: 'no slots available'
                      })
                    }
                }
            }

            Company.updateOne({ _id: req.body.companyId },
                { $set: { slots: slots} })
                .then((update) => {
                    
                  User.findOne({email: req.user.email})
                    .then((user)=>{
                      if(!user)
                      {
                          return res.status(400).json({
                            erroMessage: 'user doesnt exists. please login'
                          })
                      }
                      else
                      {

                          const booked = user.booked
              
                          const bookedData = {
                              companyName: req.body.companyName,
                              companyId: req.body.companyId,
                              slotId: req.body.slotId,
                              startTime: startTime
                          }
              
                          booked.push(bookedData)

                          User.updateOne({ email: req.user.email },
                            { $set: { booked: booked } })
                            .then((update) => {
                              res.status(200).json({
                                message: 'booked updated in db'
                              })
                            })
                            .catch((err) => {
                              console.log('Error:', err)
                            })
                      }
                    })
                    .catch((err) => {
                      console.log('Error:', err)
                    })

                })
                .catch((err) => {
                  console.log('Error:', err)
                })

        }
      })
      .catch((err) => {
        console.log('Error:', err)
      })
  }
  else
  {
    return res.status(400).json({
      erroMessage: 'approval status false'
    })
  }
})


router.get('/profile', ensureAuthenthicated, (req, res) => {
  return res.status(400).json({
    name: req.user.name,
    email: req.user.email,
    phoneNo: req.user.phoneNo,
    resumeLink: req.user.resumeLink
  })
})

router.patch('/update',ensureAuthenthicated,(req,res)=>{
  if (!req.body.name || !req.body.resumeLink || !req.body.phoneNo) {
    return res.status(400).json({
      erroMessage: 'missing required parameters. refer documentation'
    })
  }

  User.findOne({email: req.user.email})
    .then((user)=>{
      if(!user)
      {
          return res.status(400).json({
            erroMessage: 'user doesnt exists. please login'
          })
      }
      else
      {
          User.updateOne({ email: req.user.email },
            { $set: { name: req.body.name, resumeLink: req.body.resumeLink, phoneNo: req.body.phoneNo } })
            .then((update) => {
              res.status(200).json({
                message: 'details updated in db'
              })
            })
            .catch((err) => {
              console.log('Error:', err)
            })
      }
    })
    .catch((err) => {
      console.log('Error:', err)
    })

})

router.get('/logout', (req, res) => {
  req.logout()
  return res.status(200).json({
    message: 'logged out'
  })
})

router.post('/register', (req, res) => {
  if (!req.body.name || !req.body.email || !req.body.password || !req.body.phoneNo) {
    return res.status(400).json({
      erroMessage: 'missing required parameters. refer documentation'
    })
  }

  User.findOne({ email: req.body.email })
    .then((user) => {
      if (user) {
        return res.status(400).json({
          erroMessage: 'user already exists. please login'
        })
      } else {
        const name = req.body.name
        const email = req.body.email
        const phoneNo = req.body.phoneNo
        const password = req.body.password
        const resumeLink = req.body.resumeLink

        const newUser = new User({
          name,
          password,
          email,
          phoneNo,
          resumeLink
        })

        // hash
        bcrypt.genSalt(10, (err, salt) => {
          if (err) {
            return res.status(400).json({
              erroMessage: err
            })
          }
          bcrypt.hash(newUser.password, salt, (err, hash) => {
            if (err) {
              return res.status(400).json({
                erroMessage: err
              })
            }

            newUser.password = hash
            newUser.save()
              .then((user) => {
                return res.status(200).json({
                  message: 'success'
                })
              })
              .catch((err) => {
                return res.status(400).json({
                  erroMessage: err
                })
              })
          })
        })
      }
    })
    .catch((err) => {
      console.log('Error:', err)
    })
})

module.exports = router
