import jwt from "jsonwebtoken";
import { Payload } from "../types/userTypes";

export const generateToken = (payload: Payload): string => {
  return jwt.sign({ user: payload }, process.env.JWT_SECRET || '', { expiresIn: '2d' });
};

export const validateToken = (token: string): Payload | null => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as { user: Payload };
    return decoded.user;
  } catch (error) {
    return null;
  }
};