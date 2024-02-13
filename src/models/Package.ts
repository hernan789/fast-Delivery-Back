import S, { EnumDataType } from "sequelize";
import db from "../config/index";

enum PackageStatus {
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
  PENDING = "pending",
}
class Package extends S.Model {
  address: string;
  status: PackageStatus;
  owner: string;
  weight: number;
  date: Date;
}

Package.init(
  {
    address: {
      type: S.STRING,
      allowNull: false,
    },
    status: {
      type: S.ENUM(
        PackageStatus.DELIVERED,
        PackageStatus.CANCELLED,
        PackageStatus.PENDING
      ),
      allowNull: false,
      defaultValue : PackageStatus.PENDING
      
    },
    owner: {
      type: S.STRING,
      allowNull: false,
    },
    weight: {
      type: S.INTEGER,
      allowNull: false,
    },
    date: {
      type: S.DATE,
      allowNull: false,
      defaultValue: Date.now()
    },
  },
  { sequelize: db, modelName: "packages" }
);

export default Package;