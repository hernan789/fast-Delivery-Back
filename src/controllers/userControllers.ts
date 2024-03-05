import { Request, Response } from "express";
import User from "../models/User";
import Affidavit from "../models/Affidavit.ts";
import { generateToken } from "../config/token";
import { LoginRequestBody, CreateUserRequestBody } from "../types/userTypes";
import validate from "../utils/validations";
import { transporter } from "../config/mailTRansporter";
import emailTemplates from "../utils/emailTemplates.ts";
import { Payload } from "../types/userTypes";
import jwt from "jsonwebtoken";

interface CustomRequest extends Request {
  user?: {
    id: number;
  };
}
const userController = {
  register: async (req: Request, res: Response): Promise<Response> => {
    try {
      const { name, surname, email, password, isAdmin }: CreateUserRequestBody =
        req.body;

      if (!validate.email(email)) {
        return res
          .status(400)
          .json({ message: "El email tiene un formato incorrecto." });
      }

      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res
          .status(400)
          .json({ error: "El correo electrónico ya está registrado." });
      }
      const newUser = await User.create({
        name,
        surname,
        email,
        password,
        isAdmin,
      });
      const userResponse = { ...newUser.toJSON(), password: undefined };
      const mailOptions = emailTemplates.welcome(userResponse);
      await transporter.sendMail(mailOptions);
      res.status(201).json(userResponse);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
  login: async (req: Request, res: Response): Promise<Response> => {
    const { email, password }: LoginRequestBody = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email no proporcionado." });
    }
    if (!validate.email(email)) {
      return res
        .status(400)
        .json({ message: "El formato de correo electrónico es inválido." });
    }
    if (!password) {
      return res.status(400).json({ message: "Contraseña no proporcionada." });
    }
    try {
      const existingUser = await User.findOne({ where: { email } });
      if (!existingUser) {
        return res.status(400).json({ error: "Usuario no encontrado." });
      }

      const isOk = await existingUser.validatePassword(password);
      if (!isOk) return res.sendStatus(401);

      const existingUserToJson = existingUser.toJSON();

      const token = generateToken({
        id: existingUserToJson.id,
        isAdmin: existingUserToJson.isAdmin,
      });
      res.cookie("token", token, { httpOnly: true });
      return res.status(200).json({ message: "Usuario logeado con éxito." });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Error interno del servidor." });
    }
  },
  logout: async (req: Request, res: Response): Promise<Response> => {
    if (!req.cookies || !req.cookies.token) {
      return res.status(400).json({ message: "No hay sesión iniciada." });
    }
    res.clearCookie("token");
    return res.status(204).json({ message: "Sesión cerrada satisfactoriamente." });
  },
  me: async (req: CustomRequest, res: Response): Promise<Response> => {
    const userId = req.user.id;
    if (!userId) {
      return res.status(400).json({ message: "id no encontrado en el token." });
    }
    try {
      const user = await User.findOne({
        where: { id: userId },
        attributes: ["name", "surname", "email", "isAdmin", "profileImage"],
      });
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado." });
      }
      return res
        .json({
          id: userId,
          ...user.get({ plain: true }),
        })
        .status(200);
    } catch (error) {
      console.error(error);
      return res.status(500).send("Error de servidor");
    }
  },
  mailForgotPassword: async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { email } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ message: "El campo email es obligatorio." });
    if (!validate.email(email))
      return res
        .status(400)
        .json({ message: "El formato de correo electrónico es inválido." });
    try {
      const user = await User.findOne({ where: { email } });
      if (!user)
        return res.status(404).json({ message: "Usuario no registrado." });
      const userToJson = user.toJSON();

      const resetToken = generateToken({
        id: userToJson.id,
        isAdmin: userToJson.isAdmin,
      });
      userToJson.resetPasswordToken = resetToken;
      await user.save();
      const mailOptions = emailTemplates.forgotPassword(userToJson, resetToken);
      await transporter.sendMail(mailOptions);
      res.json({
        message:
          "Se envió un correo electrónico con instrucciones para restablecer la contraseña.",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
    }
  },
  mailResetPassword: async (req: Request, res: Response): Promise<Response> => {
    const { token, newPassword } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Se requiere un token." });
    }
    if (!newPassword) {
      return res
        .status(400)
        .json({ message: "Se requiere ingresar una nueva contraseña." });
    }
    if (!validate.password(newPassword)) {
      return res.status(400).json({
        message:
          "La nueva contraseña no cumple con los requisitos mínimos:\n" +
          "✓ Solo letras y números.\n" +
          "✓ 1 letra mayúscula.\n" +
          "✓ 1 letra minúscula.\n" +
          "✓ 1 número.\n" +
          "✓ 8 caracteres de largo.",
      });
    }
    try {
      const user = await User.findOne({
        where: {
          resetPasswordToken: token,
        },
      });
      if (!user) {
        return res.status(400).json({ message: "Token inválido o expirado." });
      }
      const hashedPassword = await user.hash(
        newPassword,
        user.getDataValue("salt")
      );
      user.password = hashedPassword;
      user.resetPasswordToken = null;
      await user.save();
      const confirmMailOptions = emailTemplates.resetPasswordConfirmation(user);
      await transporter.sendMail(confirmMailOptions);
      res.json({ message: "Contraseña actualizada con éxito." });
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
    }
  },
  deleteUserById: async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ message: "ID de usuario inválido." });
    }
    try {
      const userId = parseInt(id);
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado." });
      }
      await user.destroy();
      return res.json({ message: "Usuario eliminado con éxito." });
    } catch (error) {
      console.error(error);
      return res.status(500).json(error);
    }
  },
  getAllUsers: async (req: Request, res: Response) => {
    try {
      const users = await User.findAll({
        where: { isAdmin: false },
        attributes: ["id", "name", "isDisabled", "isAdmin"],
        order: [["createdAt", "DESC"]],
        limit: 20,
      });
      res.json(users).status(200);
    } catch (error) {
      console.error("Error al obtener usuarios:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  },
  getUserById: async (req: Request, res: Response) => {
    const userId: string = req.params.id;
    try {
      const user = await User.findByPk(userId, {
        attributes: ["name", "isDisabled"],
      });

      if (!user)
        return res.status(404).json({ error: "Usuario no encontrado" });

      res.json(user);
    } catch (error) {
      console.error("Error al obtener usuario por ID:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  },
  affidavit: async (req: CustomRequest, res: Response): Promise<Response> => {
    const token = req.cookies.token;
    console.log("req de DECLARACION JURADA", req.body);
    if (!token) {
      return res
        .status(401)
        .json({ message: "No token, authorization denied" });
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
        user: Payload;
      };
      req.user = decoded.user;

      Affidavit.create({
        userId: req.user.id,
        consmuedAlcohol: req.body.drunk,
        consumedPsychotropics: req.body.consumedPsychot,
        isDepressed: req.body.depressed,
      });
    } catch (error) {
      res.status(500).json({
        error:
          "Error interno del servidor al intentar guardar la declaración jurada",
      });
    }
  },
  getProfileImage: async (req: CustomRequest, res: Response) => {
    try {
      const user = await User.findAll({
        where: { id: req.user.id },
        attributes: ["profileImage"],
      });
      res.json(user).status(200);
    } catch (error) {
      console.error("Error al obtener usuario:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  },
  postProfileImage: async (req: CustomRequest, res: Response) => {
    try {
      const { id } = req.user;
      const { profileImage } = req.body;

      // Verificar que se proporciona una cadena Base64
      if (!profileImage) {
        return res.status(400).json({
          error:
            "La cadena Base64 de la imagen es requerida en el cuerpo de la solicitud",
        });
      }

      // Actualizar la imagen de perfil en la base de datos
      const [updateCount] = await User.update(
        { profileImage: profileImage },
        { where: { id } }
      );

      if (updateCount > 0) {
        return res
          .status(200)
          .json({ message: "Se actualizó la imagen de perfil correctamente" });
      } else {
        return res.status(404).json({
          error: "Usuario no encontrado o la imagen no pudo ser actualizada",
        });
      }
    } catch (error) {
      console.error("Error al actualizar la imagen de perfil:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  },
  deleteProfileImage: async (req: CustomRequest, res: Response) => {
    try {
      const { id } = req.user;
      const { profileImage } = req.body;

      // Actualizar la imagen de perfil en la base de datos
      const [updateCount] = await User.update(
        { profileImage: "" },
        { where: { id } }
      );

      if (updateCount > 0) {
        return res
          .status(200)
          .json({ message: "Se eliminó la imagen de perfil correctamente" });
      } else {
        return res.status(404).json({
          error: "Usuario no encontrado o la imagen no pudo ser eliminada",
        });
      }
    } catch (error) {
      console.error("Error al eliminar la imagen de perfil:", error);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  },
};

export default userController;
