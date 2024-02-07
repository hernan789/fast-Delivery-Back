import S from "sequelize";
const bcrypt = require("bcrypt");
import db from "../config/index";
import { Hooks } from "sequelize/lib/hooks";

interface Users {
  name: string;
  surname: string;
  email: string;
  password: string;
  isAdmin: boolean;
  salt?: string;
}
class User extends S.Model<Users> {

  public hash(password: string, salt: string): Promise<string> {
    return bcrypt.hash(password, salt);
  }

  public async validatePassword(password: string): Promise<boolean> {
    const currentSalt = this.getDataValue("salt");
    const newHash = await this.hash(password, currentSalt);
    return newHash === this.getDataValue("password");
  }
}

User.init(
  {
    name: {
      type: S.STRING,
      allowNull: false,
    },
    surname: {
      type: S.STRING,
      allowNull: false,
    },
    email: {
      type: S.STRING,
      allowNull: false,
    },
    password: {
      type: S.STRING,
      allowNull: false,
    },
    isAdmin: {
      type: S.BOOLEAN,
      defaultValue: false,
    },
    salt: {
      type: S.STRING,
    },
  },
  { sequelize: db, modelName: "users" }
);

User.addHook("beforeCreate", async (user:User) => {
  const saltRounds = 10;
  try {
    const salt = await bcrypt.genSalt(saltRounds);
    user.setDataValue("salt", salt);
    const psw = await user.hash(user.getDataValue("password"), salt);
    user.setDataValue("password", psw);
  } catch (error) {
    throw new Error("HASHING ERROR");
  }
});

export default User;