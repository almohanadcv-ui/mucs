import jwt from 'jsonwebtoken';

const generateToken = (id, role, companyId) => {
  return jwt.sign({ id, role, companyId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
};

export default generateToken;
