import express from 'express';
import {
  registerCompany,
  registerEmployee,
  loginUser,
  logoutUser,
  getUserProfile,
  checkRequestStatus,
  changeFirstPassword,
  forgotPassword
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const requireSetupKey = (req, res, next) => {
  const provided = req.headers['x-setup-key'] || req.body?.setupKey;
  if (!process.env.SETUP_KEY) {
    return res.status(503).json({ message: 'Company registration is disabled.' });
  }
  if (provided !== process.env.SETUP_KEY) {
    return res.status(403).json({ message: 'Invalid setup key.' });
  }
  return next();
};

router.post('/register', requireSetupKey, registerCompany);
router.post('/employee-register', registerEmployee);
router.post('/check-status', checkRequestStatus);
router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);
router.post('/change-password', changeFirstPassword);
router.post('/forgot-password', forgotPassword);
router.get('/profile', protect, getUserProfile);

export default router;
